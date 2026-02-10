/**
 * trading_ops — Meta-tool that routes trading queries to appropriate sub-tools.
 * Follows the same pattern as financial_search for LLM-based routing.
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { TRADING_TOOLS, TRADING_TOOL_MAP } from './tools.js';

/** Format snake_case tool name to Title Case for progress messages */
function formatSubToolName(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function buildRouterPrompt(): string {
  return `You are a trading operations routing assistant for the Tino quantitative trading workbench.

Given a user's natural language query about trading operations, call the appropriate trading tool(s).

## Available Operations

### Data Management
- **ingest_data**: Download and catalog market data (e.g., "download AAPL daily data for 2024")
- **list_catalog**: Show what data is available in the local catalog

### Backtesting
- **run_backtest**: Execute a backtest with a strategy (e.g., "backtest ema_cross on AAPL from 2023-01-01 to 2024-01-01")

### Paper Trading (Simulated)
- **start_paper_trade**: Start paper trading with a strategy (safe, no real money)

### Live Trading (DANGEROUS)
- **start_live_trade**: Start live trading with REAL MONEY. ALWAYS set confirmed=true parameter. Warn the user this uses real money.

### Monitoring
- **get_positions**: Show current open positions and PnL
- **get_orders**: Show order history

### Emergency
- **stop_trading**: KILL SWITCH — stop all trading, cancel orders, flatten positions. HIGH PRIORITY — execute immediately if requested.

## Guidelines

1. **Safety First**: Default to paper trading. Only use start_live_trade when explicitly requested.
2. **Kill Switch Priority**: If the user says "stop", "kill", "emergency", "halt" — immediately call stop_trading.
3. **Data Before Backtest**: If the user wants to backtest, they may need data ingested first. Check list_catalog.
4. **Instrument Format**: Use standard symbols (AAPL, TSLA, BTCUSDT). Bar types default to 1-DAY-LAST-EXTERNAL.
5. **Strategy Paths**: Strategy paths point to Python files in the project's strategies directory.

Call the appropriate tool(s) now.`;
}

const TradingOpsInputSchema = z.object({
  query: z.string().describe('Natural language query about trading operations (data ingestion, backtesting, paper/live trading, positions, orders, or emergency stop)'),
});

/**
 * Create a trading_ops tool configured with the specified model.
 * Uses native LLM tool calling for routing queries to trading sub-tools.
 */
export function createTradingOps(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'trading_ops',
    description: `Intelligent meta-tool for quantitative trading operations. Routes natural language queries to the Tino trading daemon for data ingestion, backtesting, paper trading, live trading, position monitoring, and emergency stop. Requires the Tino daemon to be running.`,
    schema: TradingOpsInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // 1. Call LLM with trading tools bound (native tool calling)
      onProgress?.('Processing trading request...');
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt: buildRouterPrompt(),
        tools: TRADING_TOOLS,
      });
      const aiMessage = response as AIMessage;

      // 2. Check for tool calls
      const toolCalls = aiMessage.tool_calls as ToolCall[];
      if (!toolCalls || toolCalls.length === 0) {
        return formatToolResult({ error: 'No trading tools selected for query' }, []);
      }

      // 3. Execute tool calls sequentially (trading ops may have side effects)
      const results: Array<{
        tool: string;
        args: Record<string, unknown>;
        data: unknown;
        error: string | null;
      }> = [];

      for (const tc of toolCalls) {
        const toolName = formatSubToolName(tc.name);
        onProgress?.(`Executing ${toolName}...`);

        try {
          const tool = TRADING_TOOL_MAP.get(tc.name);
          if (!tool) {
            throw new Error(`Tool '${tc.name}' not found`);
          }
          const rawResult = await tool.invoke(tc.args, config);
          const result = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
          const parsed = JSON.parse(result);
          results.push({
            tool: tc.name,
            args: tc.args as Record<string, unknown>,
            data: parsed.data,
            error: null,
          });
        } catch (error) {
          results.push({
            tool: tc.name,
            args: tc.args as Record<string, unknown>,
            data: null,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // 4. Combine results
      const successfulResults = results.filter((r) => r.error === null);
      const failedResults = results.filter((r) => r.error !== null);

      const combinedData: Record<string, unknown> = {};

      for (const result of successfulResults) {
        combinedData[result.tool] = result.data;
      }

      if (failedResults.length > 0) {
        combinedData._errors = failedResults.map((r) => ({
          tool: r.tool,
          args: r.args,
          error: r.error,
        }));
      }

      return formatToolResult(combinedData, []);
    },
  });
}

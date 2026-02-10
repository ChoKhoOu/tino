import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { QUANT_TOOLS, QUANT_TOOL_MAP } from './tools.js';

/** Format snake_case tool name to Title Case for progress messages */
function formatSubToolName(name: string): string {
  return name.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** System prompt for the quant analysis router LLM */
function buildRouterPrompt(): string {
  return `You are a quantitative analysis routing assistant.

Given a user's natural language query about quantitative analysis, call the appropriate tool(s).

## Guidelines

1. **Indicator Queries**: Use calculate_indicators for any technical indicator calculation.
   - "Calculate RSI" / "SMA" / "MACD" / "Bollinger Bands" → calculate_indicators
   - The user must provide price data (closes, and optionally highs/lows/volumes)

2. **Risk Metrics**: Use calculate_risk_metrics for portfolio/strategy risk analysis.
   - "Sharpe ratio" / "max drawdown" / "VaR" / "Sortino" → calculate_risk_metrics
   - Requires an array of periodic returns

3. **Option Pricing**: Use price_option for Black-Scholes pricing and Greeks.
   - "Price a call option" / "What are the Greeks?" / "Implied volatility" → price_option

4. **Factor Analysis**: Use run_factor_analysis for Fama-French regression.
   - "Factor exposure" / "Fama-French" / "alpha" / "beta to market" → run_factor_analysis

5. **Portfolio Optimization**: Use optimize_portfolio for weight allocation.
   - "Optimize portfolio" / "mean-variance" / "minimum variance" / "risk parity" → optimize_portfolio

6. **Correlation**: Use analyze_correlation for cross-asset relationships.
   - "Correlation matrix" / "rolling correlation" → analyze_correlation

7. **Statistics**: Use calculate_statistics for general statistical analysis.
   - "Descriptive stats" / "regression" / "rolling mean" / "rolling std" → calculate_statistics

8. **Data Format**: All numeric data must be arrays of numbers. Returns are decimal format (0.01 = 1%).

Call the appropriate tool(s) now.`;
}

// Input schema for the quant_analysis meta-tool
const QuantAnalysisInputSchema = z.object({
  query: z.string().describe('Natural language query about quantitative analysis'),
});

/**
 * Create a quant_analysis meta-tool configured with the specified model.
 * Uses native LLM tool calling for routing queries to quant sub-tools.
 * Pure computation — no external API calls required.
 */
export function createQuantAnalysis(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'quant_analysis',
    description: `Intelligent meta-tool for quantitative analysis. Routes natural language queries to appropriate quantitative computation tools. Use for:
- Technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, Stochastic, OBV, VWAP)
- Risk metrics (Sharpe ratio, Sortino ratio, max drawdown, VaR, CVaR, Calmar ratio)
- Black-Scholes option pricing with full Greeks
- Fama-French factor analysis and factor exposure
- Portfolio optimization (mean-variance, min-variance, equal-weight, risk-parity)
- Correlation matrix analysis
- Descriptive statistics, regression, rolling statistics`,
    schema: QuantAnalysisInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // 1. Call LLM with quant tools bound (native tool calling)
      onProgress?.('Analyzing...');
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt: buildRouterPrompt(),
        tools: QUANT_TOOLS,
      });
      const aiMessage = response as AIMessage;

      // 2. Check for tool calls
      const toolCalls = aiMessage.tool_calls as ToolCall[];
      if (!toolCalls || toolCalls.length === 0) {
        return formatToolResult({ error: 'No quant tools selected for query' }, []);
      }

      // 3. Execute tool calls in parallel
      const toolNames = toolCalls.map((tc) => formatSubToolName(tc.name));
      onProgress?.(`Computing ${toolNames.join(', ')}...`);
      const results = await Promise.all(
        toolCalls.map(async (tc) => {
          try {
            const tool = QUANT_TOOL_MAP.get(tc.name);
            if (!tool) {
              throw new Error(`Tool '${tc.name}' not found`);
            }
            const rawResult = await tool.invoke(tc.args);
            const result = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
            const parsed = JSON.parse(result);
            return {
              tool: tc.name,
              args: tc.args,
              data: parsed.data,
              error: null,
            };
          } catch (error) {
            return {
              tool: tc.name,
              args: tc.args,
              data: null,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );

      // 4. Combine results
      const combinedData: Record<string, unknown> = {};

      for (const result of results) {
        if (result.error === null) {
          combinedData[result.tool] = result.data;
        }
      }

      const failedResults = results.filter((r) => r.error !== null);
      if (failedResults.length > 0) {
        combinedData._errors = failedResults.map((r) => ({
          tool: r.tool,
          args: r.args,
          error: r.error,
        }));
      }

      // No source URLs for pure-computation tools
      return formatToolResult(combinedData, []);
    },
  });
}

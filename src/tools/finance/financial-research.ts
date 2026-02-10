/**
 * financial_research meta-tool.
 * Routes natural language queries to the appropriate data source sub-tools
 * using the createMetaTool factory.
 */
import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { createMetaTool } from '../meta-tool.js';
import { getCurrentDate } from '../../agent/prompts.js';
import { getOptionalApiKey } from './shared.js';

// Import sub-tools from each source
import { FMP_TOOLS } from './fmp/tools.js';
import { FRED_TOOLS } from './fred/tools.js';
import { COINGECKO_TOOLS } from './coingecko/tools.js';
import { EDGAR_TOOLS } from './edgar/tools.js';
import { POLYGON_TOOLS } from './polygon/tools.js';
import { FINNHUB_TOOLS } from './finnhub/tools.js';

function buildRouterPrompt(): string {
  return `You are a financial data routing assistant for the Tino quantitative trading workbench.
Current date: ${getCurrentDate()}

Given a user's natural language query about financial data, call the appropriate data source tool(s).

## Data Source Routing Guide

- **Company fundamentals** (revenue, earnings, balance sheet, cash flow, ratios, DCF) → FMP tools (fmp_*)
- **Economic indicators** (GDP, CPI, Fed Funds, Treasury yields, unemployment) → FRED tools (fred_*)
- **Cryptocurrency data** (Bitcoin, Ethereum prices, market cap, volume) → CoinGecko tools (coingecko_*)
- **SEC filings** (10-K, 10-Q, 8-K, XBRL data) → EDGAR tools (edgar_*)
- **Historical price bars** (OHLCV, minute/hour/day bars) → Polygon tools (polygon_*)
- **Options chain data** → Polygon tools (polygon_options_chain)
- **News and sentiment** → Finnhub tools (finnhub_*)
- **Earnings calendar** → Finnhub tools (finnhub_earnings_calendar)
- **Insider trading** → FMP (fmp_insider_trades) or Finnhub (finnhub_insider_transactions)

## Guidelines

1. **Ticker Resolution**: Convert company names to ticker symbols (Apple → AAPL, Tesla → TSLA)
2. **Date Inference**: Convert relative dates to YYYY-MM-DD format
3. **Efficiency**: Use the most specific tool available. For comparisons, call the same tool for each ticker.
4. **Multiple sources**: If a query spans multiple data types, call multiple tools in parallel.

Call the appropriate tool(s) now.`;
}

/**
 * Collect all available sub-tools based on configured API keys.
 * EDGAR and CoinGecko are always available (no key required).
 */
function collectSubTools(): StructuredToolInterface[] {
  const tools: StructuredToolInterface[] = [];

  // Always available (no API key required)
  tools.push(...EDGAR_TOOLS);
  tools.push(...COINGECKO_TOOLS);

  // Conditional on API keys
  if (getOptionalApiKey('FMP_API_KEY')) {
    tools.push(...FMP_TOOLS);
  }
  if (getOptionalApiKey('FRED_API_KEY')) {
    tools.push(...FRED_TOOLS);
  }
  if (getOptionalApiKey('POLYGON_API_KEY')) {
    tools.push(...POLYGON_TOOLS);
  }
  if (getOptionalApiKey('FINNHUB_API_KEY')) {
    tools.push(...FINNHUB_TOOLS);
  }

  return tools;
}

const FinancialResearchSchema = z.object({
  query: z.string().describe('Natural language query about financial data from any source'),
});

/**
 * Create a financial_research meta-tool configured with the specified model.
 * Routes queries to FMP, FRED, CoinGecko, EDGAR, Polygon, and Finnhub sub-tools.
 */
export function createFinancialResearch(model: string): DynamicStructuredTool {
  const subTools = collectSubTools();

  return createMetaTool({
    name: 'financial_research',
    description: `Advanced financial research tool with access to multiple data sources. Routes queries to FMP (fundamentals), FRED (economics), CoinGecko (crypto), EDGAR (SEC filings), Polygon (prices/options), and Finnhub (news/sentiment). Use for comprehensive financial analysis across multiple data providers.`,
    schema: FinancialResearchSchema,
    systemPrompt: buildRouterPrompt(),
    subTools,
    model,
  });
}

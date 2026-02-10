/**
 * Rich description for the financial_research tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const FINANCIAL_RESEARCH_DESCRIPTION = `
Advanced multi-source financial research tool. Routes natural language queries to the most appropriate data provider from 6+ sources: FMP, FRED, CoinGecko, SEC EDGAR, Polygon.io, and Finnhub.

## When to Use

- Company fundamentals from FMP (income statements, balance sheets, cash flow, key metrics, ratios, DCF valuations)
- Economic indicators from FRED (GDP, CPI, Fed Funds rate, Treasury yields, unemployment)
- Cryptocurrency data from CoinGecko (prices, market cap, volume, historical data, top coins)
- SEC filings from EDGAR (10-K, 10-Q, 8-K search, XBRL structured data, company facts)
- Historical price bars from Polygon.io (minute/hour/day/week OHLCV data)
- Options chain data from Polygon.io (available contracts, strikes, expirations)
- Market news and company news from Finnhub
- Social sentiment analysis from Finnhub
- Earnings calendar and insider transactions from Finnhub
- Insider trading activity from FMP or Finnhub
- Earnings call transcripts from FMP
- Cross-source analysis (e.g., compare fundamentals with price action)

## When NOT to Use

- For existing Dexter-style financial data (use financial_search instead)
- For general web searches (use web_search)
- For quantitative analysis computations (use quant_analysis)
- For trading operations (use trading_ops)

## Usage Notes

- Call ONCE with the complete natural language query — routing is handled internally
- Available data sources depend on configured API keys (EDGAR and CoinGecko always available)
- Handles ticker resolution (Apple → AAPL) and date inference ("last quarter" → dates)
- Returns structured JSON data with source attribution
`.trim();

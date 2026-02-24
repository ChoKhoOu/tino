/**
 * Rich description for the fundamentals tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const FUNDAMENTALS_DESCRIPTION = `
Access company financial statements, ratios, analyst estimates, insider trades, news, and deep fundamental analysis from Financial Datasets, FMP, and Finnhub.

## When to Use

- Income statement data (revenue, gross profit, operating income, net income, EPS)
- Balance sheet data (assets, liabilities, equity, debt, cash)
- Cash flow data (operating cash flow, investing cash flow, free cash flow)
- Financial ratios (P/E, EV/EBITDA, ROE, ROA, margins, dividend yield)
- Company facts (sector, industry, employees, listing date, exchange)
- Analyst estimates and price targets
- Insider trading activity
- Company news and announcements
- Multi-company fundamental comparisons
- Deep dives: DCF valuation, earnings transcripts, segmented revenues, key metrics, sentiment

## When NOT to Use

- Stock prices or OHLCV bars (use market_data)
- Macroeconomic indicators (use macro_data)
- Quantitative calculations (use quant_compute)
- General web searches (use web_search)

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| income_statement | Income statements (annual/quarterly) | symbol |
| balance_sheet | Balance sheets (annual/quarterly) | symbol |
| cash_flow | Cash flow statements (annual/quarterly) | symbol |
| ratios | Key financial ratios and metrics | symbol |
| company_facts | Company profile (sector, industry, employees) | symbol |
| analyst_estimates | Consensus estimates and price targets | symbol |
| insider_trades | Insider buying/selling activity | symbol |
| news | Company-specific news articles | symbol |
| all_financials | All financial statements combined | symbol |
| deep_dive | Deep analysis by metric (dcf, earnings_transcripts, segmented_revenues, key_metrics, sentiment) | symbol, metric |

## Usage Notes

- Provider fallback: Financial Datasets → FMP → Finnhub (for supported actions)
- Use period param for annual vs quarterly data
- Deep dive accepts metric param: dcf, earnings_transcripts, segmented_revenues, key_metrics, sentiment
- Earnings transcripts require year and quarter params
`.trim();

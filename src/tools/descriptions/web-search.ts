export const WEB_SEARCH_DESCRIPTION = `
Search the web for current information on any topic. Supports multiple search providers (Exa, Tavily) with automatic fallback.

## When to Use

- Factual questions about entities where status can change (companies, people, organizations)
- Current events, breaking news, recent developments
- Technology updates, product announcements, industry trends
- Verifying claims about real-world state (public/private, active/defunct, current leadership)
- Research on topics outside of structured financial data

## When NOT to Use

- Financial data queries (use market_data or fundamentals — structured, reliable data)
- Stock prices, company financials, SEC filings, or analyst estimates
- Pure conceptual/definitional questions ("What is a DCF?") — answer directly
- Macroeconomic indicators (use macro_data)

## Usage Notes

- provider param: "auto" (default) tries Exa first then Tavily, or specify "exa" / "tavily"
- max_results: defaults to 5
- recency_days: filter to results from the last N days (useful for recent events)
- Requires EXASEARCH_API_KEY or TAVILY_API_KEY to be configured
`.trim();

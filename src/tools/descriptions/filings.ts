/**
 * Rich description for the filings tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const FILINGS_DESCRIPTION = `
Search and retrieve SEC EDGAR filings including full-text search, company submissions history, and structured company facts (XBRL data).

## When to Use

- Full-text search across SEC filings (10-K, 10-Q, 8-K, etc.)
- Company submission history (all filings by a company)
- Structured XBRL company facts (financial data points directly from SEC)
- Finding specific filing types for a company
- Analyzing SEC disclosure content

## When NOT to Use

- Financial statements in structured format (use fundamentals)
- Stock prices or market data (use market_data)
- Macroeconomic data (use macro_data)
- Company news not in SEC filings (use fundamentals with news action)
- General web searches (use web_search)

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| search | Full-text search across EDGAR filings | query |
| submissions | Company filing history by CIK | ticker |
| company_facts | Structured XBRL financial facts | ticker |

## Usage Notes

- EDGAR is always available (no API key required for basic access)
- Search supports dateRange and formType filters
- ticker param is used as CIK identifier for submissions and company_facts
- API calls can be slow — results are limited to avoid timeouts
`.trim();

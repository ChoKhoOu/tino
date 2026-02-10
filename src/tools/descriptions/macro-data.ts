/**
 * Rich description for the macro_data tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const MACRO_DATA_DESCRIPTION = `
Access FRED (Federal Reserve Economic Data) macroeconomic data including series search, historical observations, and series metadata.

## When to Use

- Economic indicators: GDP, CPI, unemployment rate, inflation
- Interest rates: Fed Funds rate, Treasury yields, LIBOR/SOFR
- Money supply: M1, M2, monetary base
- Employment data: nonfarm payrolls, labor force participation
- Housing data: home prices, housing starts, mortgage rates
- Trade data: balance of payments, import/export prices
- Any time-series economic data from the Federal Reserve

## When NOT to Use

- Company financial data (use fundamentals)
- Stock prices or market data (use market_data)
- SEC filings (use filings)
- Quantitative calculations (use quant_compute)
- General web searches (use web_search)

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| search | Search FRED for economic data series by keyword | query |
| series | Get historical observations for a FRED series | seriesId |
| series_info | Get metadata about a FRED series (units, frequency, dates) | seriesId |

## Common Series IDs

| Series | Description |
|--------|-------------|
| GDP | Gross Domestic Product |
| UNRATE | Unemployment Rate |
| CPIAUCSL | Consumer Price Index |
| FEDFUNDS | Federal Funds Effective Rate |
| DGS10 | 10-Year Treasury Constant Maturity Rate |
| M2SL | M2 Money Stock |

## Usage Notes

- Requires FRED_API_KEY to be configured
- Use search action to find series IDs when unknown
- series action supports startDate and endDate filters (YYYY-MM-DD)
- Data frequency varies by series (daily, weekly, monthly, quarterly, annual)
`.trim();

/**
 * Rich description for the quant_compute tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const QUANT_COMPUTE_DESCRIPTION = `
Perform quantitative computations including technical indicators, risk metrics, options pricing, factor analysis, portfolio optimization, correlation analysis, and statistical analysis. All computations are pure (no external API calls) — always available.

## When to Use

- Technical indicators: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, Stochastic, OBV, VWAP
- Risk metrics: Sharpe ratio, Sortino ratio, max drawdown, VaR, CVaR, Calmar ratio, win rate, profit factor
- Option pricing: Black-Scholes pricing, Greeks (delta, gamma, theta, vega, rho), implied volatility
- Factor analysis: Fama-French 3-factor regression, factor exposure (market, size, value)
- Portfolio optimization: Mean-variance (Markowitz), minimum variance, equal weight, risk parity
- Correlation analysis: Correlation matrix, rolling correlation
- Statistics: Descriptive stats, linear regression, rolling mean/std

## When NOT to Use

- Fetching market data (use market_data for prices)
- Company fundamentals (use fundamentals)
- Non-quantitative questions (use web_search or answer directly)
- Real-time trading (use trading_sim or trading_live)

## Actions

| Action | Description | Key Inputs |
|--------|-------------|------------|
| indicators | Technical analysis indicators | closes, highs, lows, volumes, indicator type, period |
| risk | Risk and performance metrics | returns array, riskFreeRate |
| options | Black-Scholes pricing and Greeks | spot, strike, rate, timeToExpiry, volatility |
| factor | Fama-French factor analysis | assetReturns, marketReturns, smbReturns, hmlReturns |
| portfolio | Portfolio optimization | returnsMatrix, method (markowitz/min_variance/equal/risk_parity) |
| correlation | Correlation analysis | seriesA, seriesB, window |
| stats | Descriptive statistics and regression | values, optional xValues for regression |

## Usage Notes

- All inputs go in the \`inputs\` object (e.g., inputs: { closes: [...], period: 14, indicator: "rsi" })
- Returns are in decimal format: 0.01 = 1%, -0.02 = -2%
- Option parameters use annualized values: rate=0.05 means 5%/year
- Portfolio returns matrix: each inner array is one asset's return series
- No API keys required — all computations run locally
`.trim();

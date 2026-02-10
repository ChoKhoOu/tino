/**
 * Rich description for the quant_analysis tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const QUANT_ANALYSIS_DESCRIPTION = `
Intelligent meta-tool for quantitative analysis computations. Routes natural language queries to appropriate quantitative sub-tools for technical analysis, risk assessment, option pricing, factor analysis, portfolio optimization, and statistical analysis.

## When to Use

- Technical indicators: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, Stochastic, OBV, VWAP
- Risk metrics: Sharpe ratio, Sortino ratio, max drawdown, Value at Risk (VaR), CVaR, Calmar ratio, win rate, profit factor
- Option pricing: Black-Scholes pricing, Greeks (delta, gamma, theta, vega, rho), implied volatility
- Factor analysis: Fama-French 3-factor regression, factor exposure (market, size, value)
- Portfolio optimization: Mean-variance (Markowitz), minimum variance, equal weight, risk parity
- Correlation analysis: Correlation matrix, rolling correlation
- Statistics: Descriptive stats, linear regression, rolling mean/std

## When NOT to Use

- Fetching market data (use financial_search for prices, fundamentals, etc.)
- Non-quantitative questions (use web_search or answer from knowledge)
- Real-time trading decisions (use trading tools)
- Advanced time-series models (ARIMA, GARCH) — not yet supported in TS

## Usage Notes

- All computations are pure (no external API calls) — always available regardless of API key configuration
- Price data must be provided as arrays of numbers (close, high, low, volume)
- Returns are in decimal format: 0.01 means 1%, -0.02 means -2%
- Option parameters use annualized values: rate=0.05 means 5%/year, timeToExpiry=0.5 means 6 months
- Portfolio returns matrix: each inner array is one asset's return series
- Returns structured JSON with computation results
`.trim();

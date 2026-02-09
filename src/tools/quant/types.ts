export interface OHLCV {
  timestamp?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type PortfolioWeights = number[];

export interface OptionParams {
  spot: number;
  strike: number;
  rate: number;
  timeToExpiry: number;
  volatility: number;
  dividendYield?: number;
}

export interface OptionQuoteParams {
  spot: number;
  strike: number;
  rate: number;
  timeToExpiry: number;
  dividendYield?: number;
}

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export interface RegressionResult {
  intercept: number;
  slope: number;
  rSquared: number;
}

export interface FamaFrenchThreeFactorResult {
  alpha: number;
  betaMarket: number;
  betaSMB: number;
  betaHML: number;
  rSquared: number;
  residualStdError: number;
}

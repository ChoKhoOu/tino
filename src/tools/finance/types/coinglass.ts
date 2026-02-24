/**
 * CoinGlass API response types.
 * Crypto derivatives data: funding rates, open interest,
 * long/short ratios, liquidations, and futures premium.
 *
 * Docs: https://docs.coinglass.com/
 */

/** Standard CoinGlass API wrapper. */
export interface CoinGlassResponse<T> {
  code: string;
  msg: string;
  data: T;
}

// ============================================================================
// Funding Rates
// ============================================================================

/** Funding rate entry from the exchange list endpoint. */
export interface CoinGlassFundingRate {
  exchange: string;
  symbol: string;
  fundingRate: number;
  nextFundingTime: number;
}

/** Funding rate OHLC history entry. */
export interface CoinGlassFundingRateHistory {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
}

// ============================================================================
// Open Interest
// ============================================================================

/** Open interest exchange list entry. */
export interface CoinGlassOpenInterest {
  exchange: string;
  openInterest: number;
  openInterestAmount: number;
  changePercent1h?: number;
  changePercent4h?: number;
  changePercent24h?: number;
}

/** Open interest OHLC history entry. */
export interface CoinGlassOpenInterestHistory {
  time: number;
  open: string;
  high: string;
  low: string;
  close: string;
}

// ============================================================================
// Long/Short Ratio
// ============================================================================

/** Global long/short account ratio history entry. */
export interface CoinGlassLongShortRatio {
  time: number;
  longRate: number;
  shortRate: number;
  longShortRatio: number;
}

// ============================================================================
// Liquidation
// ============================================================================

/** Liquidation exchange list entry. */
export interface CoinGlassLiquidation {
  exchange: string;
  liquidation_usd: number;
  long_liquidation_usd: number;
  short_liquidation_usd: number;
}

/** Aggregated liquidation history entry. */
export interface CoinGlassLiquidationHistory {
  time: number;
  aggregated_long_liquidation_usd: number;
  aggregated_short_liquidation_usd: number;
}

// ============================================================================
// Futures Premium (Basis)
// ============================================================================

/** Futures basis (premium) history entry. */
export interface CoinGlassFuturesPremium {
  time: number;
  basis: number;
  basisRate: number;
  futuresPrice: number;
  spotPrice: number;
}

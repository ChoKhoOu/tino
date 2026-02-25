/**
 * Types for multi-exchange funding rate arbitrage analysis.
 *
 * Funding rate arbitrage: short on high-rate exchange, long on low-rate exchange,
 * collect the rate differential every 8h settlement.
 */

/** Normalized funding rate from any exchange. */
export interface NormalizedFundingRate {
  exchange: string;
  symbol: string;
  fundingRate: number;
  /** Annualized rate = fundingRate × 3 × 365 (3 settlements per day) */
  annualizedRate: number;
  nextFundingTime?: number;
  markPrice?: number;
}

/** Fee structure for an exchange's perpetual futures. */
export interface ExchangeFees {
  maker: number;
  taker: number;
}

/** Estimated costs for an arbitrage position. */
export interface FeeEstimate {
  /** Fee to open both legs (long + short entry) */
  totalEntryFee: number;
  /** Fee to close both legs */
  totalExitFee: number;
  /** Round-trip fee percentage */
  roundTripFee: number;
}

/** A single funding rate arbitrage opportunity. */
export interface ArbitrageOpportunity {
  symbol: string;
  /** Exchange with lower rate — go long here */
  longExchange: string;
  /** Exchange with higher rate — go short here */
  shortExchange: string;
  longRate: number;
  shortRate: number;
  /** shortRate - longRate */
  rateDifferential: number;
  /** Annualized spread from rate differential */
  annualizedSpread: number;
  /** Estimated daily return before fees (rateDifferential × 3) */
  estimatedDailyReturn: number;
  fees: FeeEstimate;
  /** estimatedDailyReturn - daily amortized fees */
  netDailyReturn: number;
  riskLevel: 'low' | 'medium' | 'high';
}

/** A single settlement record in a backtest. */
export interface SettlementRecord {
  timestamp: number;
  longRate: number;
  shortRate: number;
  spread: number;
}

/** Result of a historical funding rate arbitrage backtest. */
export interface ArbitrageBacktestResult {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  period: { start: number; end: number; days: number };
  totalSettlements: number;
  /** Cumulative return from rate differentials (before fees) */
  grossReturn: number;
  /** Total fees paid (entry + exit) */
  totalFees: number;
  /** grossReturn - totalFees */
  netReturn: number;
  /** Annualized net return */
  annualizedReturn: number;
  /** Maximum peak-to-trough drawdown */
  maxDrawdown: number;
  /** Percentage of settlements where spread > 0 */
  winRate: number;
  /** Average spread per settlement */
  avgSpread: number;
  /** Median spread per settlement */
  medianSpread: number;
  /** Standard deviation of spreads */
  spreadStdDev: number;
  /** Sharpe-like ratio: avgSpread / spreadStdDev (annualized) */
  sharpeRatio: number;
  /** Per-settlement data */
  settlements: SettlementRecord[];
}

/** Normalized historical funding rate entry. */
export interface HistoricalFundingRate {
  timestamp: number;
  fundingRate: number;
}

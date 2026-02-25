/**
 * Type definitions for Gate.io Public API v4 responses.
 *
 * Gate.io v4 responses are NOT wrapped in an envelope — they return
 * arrays or objects directly.
 * Docs: https://www.gate.io/docs/developers/apiv4/
 */

/**
 * Raw kline/candlestick entry from GET /spot/candlesticks.
 * Each entry is a string array: [t, quote_volume, close, high, low, open, base_volume]
 * where t is a unix timestamp in seconds.
 */
export type GateKlineRaw = [string, string, string, string, string, string, string];

/** Parsed kline/candlestick entry. */
export interface GateKline {
  /** Unix timestamp in seconds */
  t: number;
  /** Quote currency trading volume */
  quoteVolume: string;
  /** Close price */
  close: string;
  /** Highest price */
  high: string;
  /** Lowest price */
  low: string;
  /** Open price */
  open: string;
  /** Base currency trading volume */
  baseVolume: string;
}

/** Ticker entry from GET /spot/tickers. */
export interface GateTicker {
  currency_pair: string;
  last: string;
  lowest_ask: string;
  highest_bid: string;
  change_percentage: string;
  base_volume: string;
  quote_volume: string;
  high_24h: string;
  low_24h: string;
}

/**
 * Futures contract info from GET /futures/usdt/contracts/{contract}.
 * Contains current funding rate and related fields.
 */
export interface GateFuturesContract {
  name: string;
  funding_rate: string;
  funding_next_apply: number;
  mark_price: string;
  index_price: string;
  last_price: string;
  funding_rate_indicative: string;
  funding_interval: number;
}

/** Historical funding rate entry from GET /futures/usdt/funding_rate. */
export interface GateFundingRateHistory {
  /** Unix timestamp in seconds */
  t: number;
  /** Funding rate */
  r: string;
}

/** Order book from GET /spot/order_book. */
export interface GateOrderBook {
  id: number;
  /** Current timestamp in milliseconds */
  current: number;
  /** Last update timestamp in milliseconds */
  update: number;
  /** Each entry is [price, amount] */
  asks: [string, string][];
  /** Each entry is [price, amount] */
  bids: [string, string][];
}

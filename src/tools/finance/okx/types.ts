/**
 * Type definitions for OKX Public API v5 responses.
 *
 * All OKX responses are wrapped in { code, msg, data }.
 * Docs: https://www.okx.com/docs-v5/en/
 */

/** Generic OKX API response wrapper. */
export interface OkxResponse<T> {
  code: string;
  msg: string;
  data: T;
}

/** Single kline/candlestick entry (parsed from array format). */
export interface OkxKline {
  /** Timestamp in ms */
  ts: number;
  /** Open price */
  open: string;
  /** Highest price */
  high: string;
  /** Lowest price */
  low: string;
  /** Close price */
  close: string;
  /** Trading volume in base currency */
  vol: string;
  /** Trading volume in currency */
  volCcy: string;
  /** Trading volume in quote currency */
  volCcyQuote: string;
  /** Whether the candle is confirmed: "0" ongoing, "1" completed */
  confirm: string;
}

/** 24h ticker data from GET /api/v5/market/ticker(s). */
export interface OkxTicker {
  instType: string;
  instId: string;
  last: string;
  lastSz: string;
  askPx: string;
  askSz: string;
  bidPx: string;
  bidSz: string;
  open24h: string;
  high24h: string;
  low24h: string;
  volCcy24h: string;
  vol24h: string;
  ts: string;
  sodUtc0: string;
  sodUtc8: string;
}

/** Funding rate from GET /api/v5/public/funding-rate. */
export interface OkxFundingRate {
  instType: string;
  instId: string;
  fundingRate: string;
  nextFundingRate: string;
  fundingTime: string;
  nextFundingTime: string;
}

/** Historical funding rate from GET /api/v5/public/funding-rate-history. */
export interface OkxFundingRateHistory {
  instType: string;
  instId: string;
  fundingRate: string;
  realizedRate: string;
  fundingTime: string;
}

/** Order book entry: [price, quantity, deprecated, number of orders]. */
export type OkxBookEntry = [string, string, string, string];

/** Order book from GET /api/v5/market/books. */
export interface OkxOrderBook {
  asks: OkxBookEntry[];
  bids: OkxBookEntry[];
  ts: string;
}

/**
 * Types for Binance Futures funding rate data.
 *
 * Funding rates are periodic payments between long/short perpetual
 * futures holders. Positive = longs pay shorts; negative = shorts pay longs.
 */

/** Single funding rate entry from Binance Futures API. */
export interface FundingRateEntry {
  symbol: string;
  fundingRate: number;
  fundingTime: number;
  markPrice: number;
}

/** Raw response shape from Binance /fapi/v1/fundingRate endpoint. */
export interface BinanceFundingRateRaw {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
  markPrice: string;
}

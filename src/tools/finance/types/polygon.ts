/**
 * Polygon.io response types.
 * Market data bars, ticker details, options, and snapshots.
 */

export interface PolygonBar {
  /** Open price */
  o: number;
  /** High price */
  h: number;
  /** Low price */
  l: number;
  /** Close price */
  c: number;
  /** Volume */
  v: number;
  /** Volume-weighted average price */
  vw: number;
  /** Timestamp (ms) */
  t: number;
  /** Number of transactions */
  n: number;
}

export interface PolygonBarsResponse {
  ticker: string;
  queryCount: number;
  resultsCount: number;
  results: PolygonBar[];
  status: string;
  adjusted: boolean;
}

export interface PolygonTickerDetails {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange: string;
  type: string;
  currency_name: string;
  market_cap: number | null;
  phone_number: string;
  address: {
    address1: string;
    city: string;
    state: string;
  };
  description: string;
  sic_code: string;
  sic_description: string;
  total_employees: number | null;
  list_date: string;
  homepage_url: string;
  branding: {
    logo_url: string;
    icon_url: string;
  };
}

export interface PolygonOptionsContract {
  ticker: string;
  underlying_ticker: string;
  contract_type: 'call' | 'put';
  expiration_date: string;
  strike_price: number;
  exercise_style: string;
}

export interface PolygonOptionQuote {
  T: string;
  t: number;
  y: number;
  q: number;
  i: string;
  p: number;
  s: number;
  x: number;
  c: number[];
}

export interface PolygonSnapshot {
  ticker: {
    ticker: string;
    todaysChangePerc: number;
    todaysChange: number;
    updated: number;
    day: PolygonBar;
    prevDay: PolygonBar;
    min: PolygonBar;
  };
  status: string;
}

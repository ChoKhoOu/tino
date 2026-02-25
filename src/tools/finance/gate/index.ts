/**
 * Gate.io public REST API v4 client.
 *
 * Provides crypto market data without requiring an API key.
 * Docs: https://www.gate.io/docs/developers/apiv4/
 */
import { fetchJson } from '../shared.js';
import type {
  GateKlineRaw,
  GateKline,
  GateTicker,
  GateFuturesContract,
  GateFundingRateHistory,
  GateOrderBook,
} from './types.js';
import type { UnifiedTicker, UnifiedKline, UnifiedFundingRate, UnifiedOrderBook } from '../types/crypto.js';
import { parseUnderscoreSymbol } from '../types/crypto.js';

const BASE_URL = 'https://api.gateio.ws/api/v4';
const SOURCE = 'Gate';

function buildUrl(
  endpoint: string,
  params: Record<string, string | number | undefined> = {}
): string {
  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function headers(): Record<string, string> {
  return { Accept: 'application/json' };
}

function cacheOpts(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  cacheable = false
) {
  return {
    cacheable,
    endpoint: `gate${endpoint}`,
    params: params as Record<string, string | number | string[] | undefined>,
  };
}

// ============================================================================
// Klines (Candlesticks)
// ============================================================================

/**
 * Get kline/candlestick data for a currency pair.
 * @param currencyPair - Currency pair (e.g. "BTC_USDT")
 * @param interval     - Kline interval: 10s, 1m, 5m, 15m, 30m, 1h, 4h, 8h, 1d, 7d, 30d
 * @param from         - Start time in seconds (unix)
 * @param to           - End time in seconds (unix)
 * @param limit        - Number of results (default 100, max 1000)
 */
export async function getKlines(
  currencyPair: string,
  interval: string,
  from?: number,
  to?: number,
  limit = 100
): Promise<GateKline[]> {
  const params: Record<string, string | number | undefined> = {
    currency_pair: currencyPair,
    interval,
    limit,
    from,
    to,
  };
  const url = buildUrl('/spot/candlesticks', params);

  // Cache only when both from and to are provided and fully historical
  const nowSecs = Math.floor(Date.now() / 1000);
  const cacheable = !!(from && to && to < nowSecs - 86_400);

  const { data } = await fetchJson<GateKlineRaw[]>(
    url,
    { source: SOURCE, headers: headers() },
    cacheOpts('/spot/candlesticks', params, cacheable)
  );

  return data.map((k) => ({
    t: Number(k[0]),
    quoteVolume: k[1],
    close: k[2],
    high: k[3],
    low: k[4],
    open: k[5],
    baseVolume: k[6],
  }));
}

// ============================================================================
// Ticker
// ============================================================================

/**
 * Get spot ticker data.
 * @param currencyPair - If provided, returns single ticker. Otherwise returns all.
 */
export async function getTicker(
  currencyPair?: string
): Promise<GateTicker[]> {
  const params: Record<string, string | number | undefined> = {};
  if (currencyPair) {
    params.currency_pair = currencyPair;
  }
  const url = buildUrl('/spot/tickers', params);

  const { data } = await fetchJson<GateTicker[]>(
    url,
    { source: SOURCE, headers: headers() }
  );

  return data;
}

// ============================================================================
// Funding Rate
// ============================================================================

/**
 * Get current funding rate for a USDT-settled futures contract.
 * @param contract - Contract name (e.g. "BTC_USDT")
 */
export async function getFundingRate(
  contract: string
): Promise<GateFuturesContract> {
  const url = buildUrl(`/futures/usdt/contracts/${contract}`);

  const { data } = await fetchJson<GateFuturesContract>(
    url,
    { source: SOURCE, headers: headers() }
  );

  return data;
}

/**
 * Get historical funding rates for a USDT-settled futures contract.
 * @param contract - Contract name (e.g. "BTC_USDT")
 * @param limit    - Number of results (default 100)
 */
export async function getFundingRateHistory(
  contract: string,
  limit = 100
): Promise<GateFundingRateHistory[]> {
  const params: Record<string, string | number | undefined> = {
    contract,
    limit,
  };
  const url = buildUrl('/futures/usdt/funding_rate', params);

  const { data } = await fetchJson<GateFundingRateHistory[]>(
    url,
    { source: SOURCE, headers: headers() }
  );

  return data;
}

// ============================================================================
// Order Book
// ============================================================================

/**
 * Get order book depth for a currency pair.
 * @param currencyPair - Currency pair (e.g. "BTC_USDT")
 * @param limit        - Depth levels (default 20, max 50)
 */
export async function getOrderBook(
  currencyPair: string,
  limit = 20
): Promise<GateOrderBook> {
  const params: Record<string, string | number | undefined> = {
    currency_pair: currencyPair,
    limit,
  };
  const url = buildUrl('/spot/order_book', params);

  const { data } = await fetchJson<GateOrderBook>(
    url,
    { source: SOURCE, headers: headers() }
  );

  return data;
}

// ============================================================================
// Unified type adapters
// ============================================================================

/** Convert a Gate.io ticker to a UnifiedTicker. */
export function toUnifiedTicker(t: GateTicker): UnifiedTicker {
  const { base, quote, unified } = parseUnderscoreSymbol(t.currency_pair);
  return {
    exchange: 'gate',
    symbol: unified,
    baseAsset: base,
    quoteAsset: quote,
    last: parseFloat(t.last),
    bid: parseFloat(t.highest_bid),
    ask: parseFloat(t.lowest_ask),
    volume24h: parseFloat(t.base_volume),
    timestamp: Date.now(),
  };
}

/** Convert a Gate.io kline to a UnifiedKline. */
export function toUnifiedKline(k: GateKline, currencyPair: string, interval: string): UnifiedKline {
  const { unified } = parseUnderscoreSymbol(currencyPair);
  return {
    exchange: 'gate',
    symbol: unified,
    interval,
    open: parseFloat(k.open),
    high: parseFloat(k.high),
    low: parseFloat(k.low),
    close: parseFloat(k.close),
    volume: parseFloat(k.baseVolume),
    timestamp: k.t * 1000, // Gate.io uses seconds, unified uses ms
  };
}

/** Convert a Gate.io futures contract to a UnifiedFundingRate. */
export function toUnifiedFundingRate(fc: GateFuturesContract): UnifiedFundingRate {
  const { unified } = parseUnderscoreSymbol(fc.name);
  return {
    exchange: 'gate',
    symbol: unified,
    rate: parseFloat(fc.funding_rate),
    nextFundingTime: fc.funding_next_apply * 1000, // seconds to ms
    markPrice: parseFloat(fc.mark_price),
    indexPrice: parseFloat(fc.index_price),
  };
}

/** Convert a Gate.io order book to a UnifiedOrderBook. */
export function toUnifiedOrderBook(book: GateOrderBook, currencyPair: string): UnifiedOrderBook {
  const { unified } = parseUnderscoreSymbol(currencyPair);
  return {
    exchange: 'gate',
    symbol: unified,
    bids: book.bids.map((e) => [parseFloat(e[0]), parseFloat(e[1])]),
    asks: book.asks.map((e) => [parseFloat(e[0]), parseFloat(e[1])]),
    timestamp: book.current,
  };
}

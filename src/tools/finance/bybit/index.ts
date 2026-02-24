/**
 * Bybit V5 public REST API client.
 *
 * Provides crypto market data without requiring an API key.
 * Docs: https://bybit-exchange.github.io/docs/v5/intro
 */
import { fetchJson } from '../shared.js';
import type {
  BybitResponse,
  BybitKline,
  BybitKlineResult,
  BybitTicker,
  BybitTickerResult,
  BybitFundingRate,
  BybitFundingRateResult,
  BybitOrderBook,
  BybitOrderBookRaw,
  BybitOrderBookLevel,
} from './types.js';

const BASE_URL = 'https://api.bybit.com/v5';
const SOURCE = 'Bybit';

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
    endpoint: `bybit${endpoint}`,
    params: params as Record<string, string | number | string[] | undefined>,
  };
}

/**
 * Unwrap Bybit V5 response envelope.
 * Throws if retCode !== 0.
 */
function unwrap<T>(response: BybitResponse<T>): T {
  if (response.retCode !== 0) {
    throw new Error(`[${SOURCE}] API error: ${response.retMsg} (code ${response.retCode})`);
  }
  return response.result;
}

// ============================================================================
// Klines (Candlesticks)
// ============================================================================

/**
 * Get kline/candlestick data for a symbol.
 * @param symbol   - Trading pair (e.g. "BTCUSDT")
 * @param interval - Kline interval: "1", "5", "15", "60", "240", "D"
 * @param start    - Optional start time in ms
 * @param end      - Optional end time in ms
 * @param limit    - Number of results (default 200, max 1000)
 */
export async function getKlines(
  symbol: string,
  interval: string,
  start?: number,
  end?: number,
  limit = 200,
  category = 'spot'
): Promise<BybitKline[]> {
  const params: Record<string, string | number | undefined> = {
    category,
    symbol: symbol.toUpperCase(),
    interval,
    limit,
    start,
    end,
  };
  const url = buildUrl('/market/kline', params);

  // Cache only when both start and end are provided and fully historical
  const now = Date.now();
  const cacheable = !!(start && end && end < now - 86_400_000);

  const { data } = await fetchJson<BybitResponse<BybitKlineResult>>(
    url,
    { source: SOURCE, headers: headers() },
    cacheOpts('/market/kline', params, cacheable)
  );

  const result = unwrap(data);

  return result.list.map((k) => ({
    openTime: Number(k[0]),
    open: k[1]!,
    high: k[2]!,
    low: k[3]!,
    close: k[4]!,
    volume: k[5]!,
    turnover: k[6]!,
  }));
}

// ============================================================================
// Tickers
// ============================================================================

/**
 * Get 24h ticker data.
 * @param symbol   - Optional trading pair. If omitted with spot category, returns all.
 * @param category - Market category: "spot" (default), "linear", "inverse"
 */
export async function getTicker(
  symbol?: string,
  category = 'spot'
): Promise<BybitTicker[]> {
  const params: Record<string, string | number | undefined> = {
    category,
    symbol: symbol?.toUpperCase(),
  };
  const url = buildUrl('/market/tickers', params);

  const { data } = await fetchJson<BybitResponse<BybitTickerResult>>(
    url,
    { source: SOURCE, headers: headers() }
  );

  return unwrap(data).list;
}

// ============================================================================
// Funding Rates
// ============================================================================

/**
 * Get the most recent funding rate for a linear perpetual symbol.
 * @param symbol - Perpetual symbol (e.g. "BTCUSDT")
 */
export async function getFundingRate(
  symbol: string
): Promise<BybitFundingRate> {
  const params: Record<string, string | number | undefined> = {
    category: 'linear',
    symbol: symbol.toUpperCase(),
    limit: 1,
  };
  const url = buildUrl('/market/funding/history', params);

  const { data } = await fetchJson<BybitResponse<BybitFundingRateResult>>(
    url,
    { source: SOURCE, headers: headers() }
  );

  const list = unwrap(data).list;
  if (list.length === 0) {
    throw new Error(`[${SOURCE}] No funding rate data for ${symbol}`);
  }
  return list[0]!;
}

/**
 * Get historical funding rates for a linear perpetual symbol.
 * @param symbol    - Perpetual symbol (e.g. "BTCUSDT")
 * @param startTime - Optional start timestamp in ms
 * @param endTime   - Optional end timestamp in ms
 * @param limit     - Number of results (default 200, max 200)
 */
export async function getFundingRateHistory(
  symbol: string,
  startTime?: number,
  endTime?: number,
  limit = 200
): Promise<BybitFundingRate[]> {
  const params: Record<string, string | number | undefined> = {
    category: 'linear',
    symbol: symbol.toUpperCase(),
    startTime,
    endTime,
    limit,
  };
  const url = buildUrl('/market/funding/history', params);

  // Cache only when both start and end are provided and fully historical
  const now = Date.now();
  const cacheable = !!(startTime && endTime && endTime < now - 86_400_000);

  const { data } = await fetchJson<BybitResponse<BybitFundingRateResult>>(
    url,
    { source: SOURCE, headers: headers() },
    cacheOpts('/market/funding/history', params, cacheable)
  );

  return unwrap(data).list;
}

// ============================================================================
// Order Book
// ============================================================================

/**
 * Get order book depth snapshot.
 * @param symbol   - Trading pair (e.g. "BTCUSDT")
 * @param category - Market category: "spot" (default), "linear", "inverse"
 * @param limit    - Depth levels (default 25, max 200 for spot / 500 for linear)
 */
export async function getOrderBook(
  symbol: string,
  category = 'spot',
  limit = 25
): Promise<BybitOrderBook> {
  const params: Record<string, string | number | undefined> = {
    category,
    symbol: symbol.toUpperCase(),
    limit,
  };
  const url = buildUrl('/market/orderbook', params);

  const { data } = await fetchJson<BybitResponse<BybitOrderBookRaw>>(
    url,
    { source: SOURCE, headers: headers() }
  );

  const raw = unwrap(data);

  const parseLevel = (level: string[]): BybitOrderBookLevel => ({
    price: level[0]!,
    size: level[1]!,
  });

  return {
    symbol: raw.s,
    asks: raw.a.map(parseLevel),
    bids: raw.b.map(parseLevel),
    timestamp: raw.ts,
    updateId: raw.u,
  };
}

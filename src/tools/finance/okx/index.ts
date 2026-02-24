/**
 * OKX public REST API v5 client.
 *
 * Provides crypto market data without requiring an API key.
 * Docs: https://www.okx.com/docs-v5/en/
 */
import { fetchJson } from '../shared.js';
import type {
  OkxResponse,
  OkxKline,
  OkxTicker,
  OkxFundingRate,
  OkxFundingRateHistory,
  OkxOrderBook,
} from './types.js';

const BASE_URL = 'https://www.okx.com/api/v5';
const SOURCE = 'OKX';

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
    endpoint: `okx${endpoint}`,
    params: params as Record<string, string | number | string[] | undefined>,
  };
}

/**
 * Unwrap the OKX response envelope. Throws if code !== '0'.
 */
function unwrap<T>(response: OkxResponse<T>, label: string): T {
  if (response.code !== '0') {
    throw new Error(`[${SOURCE}] ${label} failed: ${response.msg} (code ${response.code})`);
  }
  return response.data;
}

// ============================================================================
// Klines (Candlesticks)
// ============================================================================

/**
 * Get kline/candlestick data for an instrument.
 * @param instId - Instrument ID (e.g. "BTC-USDT")
 * @param bar    - Bar size: 1m, 5m, 15m, 1H, 4H, 1D
 * @param after  - Pagination: return records earlier than this ts (ms)
 * @param before - Pagination: return records newer than this ts (ms)
 * @param limit  - Number of results (default 100, max 300)
 */
export async function getKlines(
  instId: string,
  bar: string,
  after?: number,
  before?: number,
  limit = 100
): Promise<OkxKline[]> {
  const params: Record<string, string | number | undefined> = {
    instId,
    bar,
    limit,
    after,
    before,
  };
  const url = buildUrl('/market/candles', params);

  // Cache only when both after and before are provided and fully historical
  const now = Date.now();
  const cacheable = !!(after && before && before < now - 86_400_000);

  const { data } = await fetchJson<OkxResponse<string[][]>>(
    url,
    { source: SOURCE, headers: headers() },
    cacheOpts('/market/candles', params, cacheable)
  );

  const rows = unwrap(data, 'getKlines');

  return rows.map((k) => ({
    ts: Number(k[0]),
    open: k[1] as string,
    high: k[2] as string,
    low: k[3] as string,
    close: k[4] as string,
    vol: k[5] as string,
    volCcy: k[6] as string,
    volCcyQuote: k[7] as string,
    confirm: k[8] as string,
  }));
}

// ============================================================================
// Ticker
// ============================================================================

/**
 * Get 24h ticker data.
 * @param instId - If provided, returns single ticker. Otherwise returns all SPOT tickers.
 */
export async function getTicker(
  instId?: string
): Promise<OkxTicker[]> {
  let url: string;
  if (instId) {
    url = buildUrl('/market/ticker', { instId });
  } else {
    url = buildUrl('/market/tickers', { instType: 'SPOT' });
  }

  const { data } = await fetchJson<OkxResponse<OkxTicker[]>>(
    url,
    { source: SOURCE, headers: headers() }
  );

  return unwrap(data, 'getTicker');
}

// ============================================================================
// Funding Rate
// ============================================================================

/**
 * Get current funding rate for a perpetual swap instrument.
 * @param instId - Swap instrument ID (e.g. "BTC-USDT-SWAP")
 */
export async function getFundingRate(
  instId: string
): Promise<OkxFundingRate> {
  const url = buildUrl('/public/funding-rate', { instId });

  const { data } = await fetchJson<OkxResponse<OkxFundingRate[]>>(
    url,
    { source: SOURCE, headers: headers() }
  );

  const rows = unwrap(data, 'getFundingRate');
  if (rows.length === 0) {
    throw new Error(`[${SOURCE}] No funding rate data for ${instId}`);
  }
  return rows[0]!;
}

/**
 * Get historical funding rates for a perpetual swap instrument.
 * @param instId - Swap instrument ID (e.g. "BTC-USDT-SWAP")
 * @param after  - Pagination: return records earlier than this ts (ms)
 * @param before - Pagination: return records newer than this ts (ms)
 * @param limit  - Number of results (default 100)
 */
export async function getFundingRateHistory(
  instId: string,
  after?: number,
  before?: number,
  limit = 100
): Promise<OkxFundingRateHistory[]> {
  const params: Record<string, string | number | undefined> = {
    instId,
    after,
    before,
    limit,
  };
  const url = buildUrl('/public/funding-rate-history', params);

  const now = Date.now();
  const cacheable = !!(after && before && before < now - 86_400_000);

  const { data } = await fetchJson<OkxResponse<OkxFundingRateHistory[]>>(
    url,
    { source: SOURCE, headers: headers() },
    cacheOpts('/public/funding-rate-history', params, cacheable)
  );

  return unwrap(data, 'getFundingRateHistory');
}

// ============================================================================
// Order Book
// ============================================================================

/**
 * Get order book depth for an instrument.
 * @param instId - Instrument ID (e.g. "BTC-USDT")
 * @param sz     - Book depth (default 20, max 400)
 */
export async function getOrderBook(
  instId: string,
  sz = 20
): Promise<OkxOrderBook> {
  const url = buildUrl('/market/books', { instId, sz });

  const { data } = await fetchJson<OkxResponse<OkxOrderBook[]>>(
    url,
    { source: SOURCE, headers: headers() }
  );

  const rows = unwrap(data, 'getOrderBook');
  if (rows.length === 0) {
    throw new Error(`[${SOURCE}] No order book data for ${instId}`);
  }
  return rows[0]!;
}

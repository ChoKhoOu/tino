/**
 * Polygon.io API client.
 *
 * Provides access to historical price bars (OHLCV), ticker details,
 * options chain data, and real-time snapshots.
 *
 * Docs: https://polygon.io/docs
 */
import { fetchJson, validateApiKey } from '../shared.js';
import type {
  PolygonBarsResponse,
  PolygonTickerDetails,
  PolygonOptionsContract,
  PolygonSnapshot,
} from '../types.js';

const BASE_URL = 'https://api.polygon.io';
const SOURCE = 'Polygon';

function buildUrl(
  endpoint: string,
  params: Record<string, string | number | undefined> = {}
): string {
  const apiKey = validateApiKey('Polygon.io', 'POLYGON_API_KEY');
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('apiKey', apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function cacheOpts(endpoint: string, params: Record<string, string | number | undefined>, cacheable = true) {
  return {
    cacheable,
    endpoint: `polygon${endpoint}`,
    params: params as Record<string, string | number | string[] | undefined>,
  };
}

// ============================================================================
// Historical Bars (OHLCV)
// ============================================================================

/**
 * Get historical aggregate bars (OHLCV) for a ticker.
 *
 * @param ticker - Stock ticker (e.g. "AAPL")
 * @param timespan - Bar timespan: "minute", "hour", "day", "week", "month", "quarter", "year"
 * @param from - Start date (YYYY-MM-DD)
 * @param to - End date (YYYY-MM-DD)
 * @param multiplier - Timespan multiplier (default 1)
 */
export async function getPolygonBars(
  ticker: string,
  timespan: string,
  from: string,
  to: string,
  multiplier = 1
): Promise<PolygonBarsResponse> {
  const endpoint = `/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}`;
  const url = buildUrl(endpoint, { adjusted: 'true', sort: 'asc', limit: 50000 });

  // Cache only for fully-historical ranges
  const endDate = new Date(to);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cacheable = endDate < today;

  const { data } = await fetchJson<PolygonBarsResponse>(
    url,
    { source: SOURCE },
    cacheOpts(endpoint, { ticker, timespan, from, to }, cacheable)
  );
  return data;
}

// ============================================================================
// Ticker Details
// ============================================================================

/**
 * Get detailed information about a ticker (name, market cap, description, etc.).
 */
export async function getPolygonTicker(ticker: string): Promise<PolygonTickerDetails> {
  const endpoint = `/v3/reference/tickers/${ticker}`;
  const url = buildUrl(endpoint);

  const { data } = await fetchJson<{ results: PolygonTickerDetails }>(
    url,
    { source: SOURCE },
    cacheOpts(endpoint, { ticker })
  );
  return data.results;
}

// ============================================================================
// Options Chain
// ============================================================================

/**
 * Get the options chain for an underlying ticker.
 *
 * @param underlyingTicker - The underlying stock ticker
 * @param expirationDate - Expiration date filter (YYYY-MM-DD)
 */
export async function getPolygonOptionsChain(
  underlyingTicker: string,
  expirationDate?: string
): Promise<PolygonOptionsContract[]> {
  const endpoint = '/v3/reference/options/contracts';
  const url = buildUrl(endpoint, {
    underlying_ticker: underlyingTicker,
    expiration_date: expirationDate,
    limit: 250,
  });

  const { data } = await fetchJson<{ results: PolygonOptionsContract[] }>(
    url,
    { source: SOURCE },
    cacheOpts(endpoint, { underlying_ticker: underlyingTicker, expiration_date: expirationDate })
  );
  return data.results ?? [];
}

// ============================================================================
// Snapshot
// ============================================================================

/**
 * Get a real-time snapshot for a ticker (current day bars, previous day bars).
 */
export async function getPolygonSnapshot(ticker: string): Promise<PolygonSnapshot> {
  const endpoint = `/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}`;
  const url = buildUrl(endpoint);

  // Snapshots are live data — never cache
  const { data } = await fetchJson<PolygonSnapshot>(
    url,
    { source: SOURCE }
  );
  return data;
}

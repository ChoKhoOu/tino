/**
 * CoinGlass API client.
 *
 * Provides crypto derivatives data: multi-exchange funding rates,
 * open interest, long/short ratios, liquidation stats, and futures premium.
 *
 * API key required via COINGLASS_API_KEY env var.
 * Docs: https://docs.coinglass.com/
 */
import { fetchJson, validateApiKey } from '../shared.js';
import type {
  CoinGlassResponse,
  CoinGlassFundingRate,
  CoinGlassFundingRateHistory,
  CoinGlassOpenInterest,
  CoinGlassOpenInterestHistory,
  CoinGlassLongShortRatio,
  CoinGlassLiquidation,
  CoinGlassLiquidationHistory,
  CoinGlassFuturesPremium,
} from '../types.js';

const BASE_URL = 'https://open-api-v4.coinglass.com';
const SOURCE = 'CoinGlass';

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
  const apiKey = validateApiKey('CoinGlass', 'COINGLASS_API_KEY');
  return {
    Accept: 'application/json',
    'CG-API-KEY': apiKey,
  };
}

function cacheOpts(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  cacheable = false,
) {
  return {
    cacheable,
    endpoint: `coinglass${endpoint}`,
    params: params as Record<string, string | number | string[] | undefined>,
  };
}

/** Extract data from CoinGlass response wrapper, throwing on API errors. */
function unwrap<T>(response: CoinGlassResponse<T>, label: string): T {
  if (response.code !== '0') {
    throw new Error(`[${SOURCE}] API error for ${label}: ${response.msg}`);
  }
  return response.data;
}

// ============================================================================
// Funding Rates
// ============================================================================

/**
 * Get current funding rates across exchanges for a symbol.
 * @param symbol - Trading coin (e.g. "BTC", "ETH")
 */
export async function getFundingRates(
  symbol = 'BTC',
): Promise<CoinGlassFundingRate[]> {
  const params = { symbol };
  const url = buildUrl('/api/futures/funding-rate/exchange-list', params);
  const { data } = await fetchJson<CoinGlassResponse<CoinGlassFundingRate[]>>(
    url,
    { source: SOURCE, headers: headers() },
  );
  return unwrap(data, `funding-rate/exchange-list/${symbol}`);
}

/**
 * Get historical funding rate OHLC for a specific exchange and symbol.
 * @param exchange - Exchange name (e.g. "Binance", "OKX")
 * @param symbol - Trading pair (e.g. "BTCUSDT")
 * @param interval - Time interval (1h, 4h, 12h, 1d, etc.)
 * @param limit - Number of results (default 500, max 4500)
 */
export async function getFundingRateHistory(
  exchange: string,
  symbol: string,
  interval = '1d',
  limit = 500,
): Promise<CoinGlassFundingRateHistory[]> {
  const params = { exchange, symbol, interval, limit };
  const url = buildUrl('/api/futures/funding-rate/history', params);
  const { data } = await fetchJson<CoinGlassResponse<CoinGlassFundingRateHistory[]>>(
    url,
    { source: SOURCE, headers: headers() },
    cacheOpts('/funding-rate/history', { exchange, symbol, interval, limit }, true),
  );
  return unwrap(data, `funding-rate/history/${exchange}/${symbol}`);
}

// ============================================================================
// Open Interest
// ============================================================================

/**
 * Get open interest across exchanges for a symbol.
 * @param symbol - Trading coin (e.g. "BTC", "ETH")
 */
export async function getOpenInterest(
  symbol = 'BTC',
): Promise<CoinGlassOpenInterest[]> {
  const params = { symbol };
  const url = buildUrl('/api/futures/openInterest/exchange-list', params);
  const { data } = await fetchJson<CoinGlassResponse<CoinGlassOpenInterest[]>>(
    url,
    { source: SOURCE, headers: headers() },
  );
  return unwrap(data, `openInterest/exchange-list/${symbol}`);
}

/**
 * Get historical open interest OHLC for a specific exchange and symbol.
 * @param exchange - Exchange name (e.g. "Binance")
 * @param symbol - Trading pair (e.g. "BTCUSDT")
 * @param interval - Time interval (1h, 4h, 12h, 1d, etc.)
 * @param limit - Number of results (default 500, max 1000)
 */
export async function getOpenInterestHistory(
  exchange: string,
  symbol: string,
  interval = '1d',
  limit = 500,
): Promise<CoinGlassOpenInterestHistory[]> {
  const params = { exchange, symbol, interval, limit };
  const url = buildUrl('/api/futures/open-interest/history', params);
  const { data } = await fetchJson<CoinGlassResponse<CoinGlassOpenInterestHistory[]>>(
    url,
    { source: SOURCE, headers: headers() },
    cacheOpts('/open-interest/history', { exchange, symbol, interval, limit }, true),
  );
  return unwrap(data, `open-interest/history/${exchange}/${symbol}`);
}

// ============================================================================
// Long/Short Ratio
// ============================================================================

/**
 * Get global long/short account ratio history.
 * @param exchange - Exchange name (e.g. "Binance")
 * @param symbol - Trading pair (e.g. "BTCUSDT")
 * @param interval - Time interval (1h, 4h, 12h, 1d, etc.)
 * @param limit - Number of results (default 500)
 */
export async function getLongShortRatio(
  exchange: string,
  symbol: string,
  interval = '1d',
  limit = 500,
): Promise<CoinGlassLongShortRatio[]> {
  const params = { exchange, symbol, interval, limit };
  const url = buildUrl('/api/futures/global-long-short-account-ratio/history', params);
  const { data } = await fetchJson<CoinGlassResponse<CoinGlassLongShortRatio[]>>(
    url,
    { source: SOURCE, headers: headers() },
    cacheOpts('/long-short-ratio', { exchange, symbol, interval, limit }, true),
  );
  return unwrap(data, `long-short-ratio/${exchange}/${symbol}`);
}

// ============================================================================
// Liquidation
// ============================================================================

/**
 * Get liquidation data across exchanges for a symbol.
 * @param symbol - Trading coin (e.g. "BTC")
 * @param range - Time range: "1h", "4h", "12h", "24h"
 */
export async function getLiquidations(
  symbol = 'BTC',
  range = '24h',
): Promise<CoinGlassLiquidation[]> {
  const params = { symbol, range };
  const url = buildUrl('/api/futures/liquidation/exchange-list', params);
  const { data } = await fetchJson<CoinGlassResponse<CoinGlassLiquidation[]>>(
    url,
    { source: SOURCE, headers: headers() },
  );
  return unwrap(data, `liquidation/exchange-list/${symbol}`);
}

/**
 * Get aggregated liquidation history across exchanges.
 * @param symbol - Trading coin (e.g. "BTC")
 * @param interval - Time interval (1h, 4h, 12h, 1d, etc.)
 * @param limit - Number of results (default 500)
 * @param exchangeList - Comma-separated exchange names (default "ALL")
 */
export async function getLiquidationHistory(
  symbol: string,
  interval = '1d',
  limit = 500,
  exchangeList = 'ALL',
): Promise<CoinGlassLiquidationHistory[]> {
  const params = { symbol, interval, limit, exchange_list: exchangeList };
  const url = buildUrl('/api/futures/liquidation/aggregated-history', params);
  const { data } = await fetchJson<CoinGlassResponse<CoinGlassLiquidationHistory[]>>(
    url,
    { source: SOURCE, headers: headers() },
    cacheOpts('/liquidation/aggregated-history', { symbol, interval, limit }, true),
  );
  return unwrap(data, `liquidation/aggregated-history/${symbol}`);
}

// ============================================================================
// Futures Premium (Basis)
// ============================================================================

/**
 * Get futures basis (premium) history.
 * @param symbol - Trading coin (e.g. "BTC")
 * @param interval - Time interval (1h, 4h, 12h, 1d, etc.)
 * @param limit - Number of results (default 500)
 */
export async function getFuturesPremium(
  symbol: string,
  interval = '1d',
  limit = 500,
): Promise<CoinGlassFuturesPremium[]> {
  const params = { symbol, interval, limit };
  const url = buildUrl('/api/futures/basis/history', params);
  const { data } = await fetchJson<CoinGlassResponse<CoinGlassFuturesPremium[]>>(
    url,
    { source: SOURCE, headers: headers() },
    cacheOpts('/basis/history', { symbol, interval, limit }, true),
  );
  return unwrap(data, `basis/history/${symbol}`);
}

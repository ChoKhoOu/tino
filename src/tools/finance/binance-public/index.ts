/**
 * Binance public REST API client.
 *
 * Provides crypto market data without requiring an API key.
 * Docs: https://binance-docs.github.io/apidocs/spot/en/
 */
import { fetchJson } from '../shared.js';
import type { BinanceKline, BinanceTicker24h } from './types.js';
import type { UnifiedTicker, UnifiedKline } from '../types/crypto.js';
import { parseConcatSymbol } from '../types/crypto.js';

const BASE_URL = 'https://api.binance.com/api/v3';
const SOURCE = 'Binance';

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
    endpoint: `binance${endpoint}`,
    params: params as Record<string, string | number | string[] | undefined>,
  };
}

// ============================================================================
// Klines (Candlesticks)
// ============================================================================

/**
 * Get kline/candlestick data for a symbol.
 * @param symbol   - Trading pair (e.g. "BTCUSDT")
 * @param interval - Kline interval (e.g. "1m", "1h", "1d")
 * @param startTime - Optional start time in ms
 * @param endTime   - Optional end time in ms
 * @param limit     - Number of results (default 500, max 1000)
 */
export async function getKlines(
  symbol: string,
  interval: string,
  startTime?: number,
  endTime?: number,
  limit = 500
): Promise<BinanceKline[]> {
  const params: Record<string, string | number | undefined> = {
    symbol: symbol.toUpperCase(),
    interval,
    limit,
    startTime,
    endTime,
  };
  const url = buildUrl('/klines', params);

  // Cache only when both start and end are provided and fully historical
  const now = Date.now();
  const cacheable = !!(startTime && endTime && endTime < now - 86_400_000);

  const { data } = await fetchJson<unknown[][]>(
    url,
    { source: SOURCE, headers: headers() },
    cacheOpts('/klines', params, cacheable)
  );

  return data.map((k) => ({
    openTime: k[0] as number,
    open: k[1] as string,
    high: k[2] as string,
    low: k[3] as string,
    close: k[4] as string,
    volume: k[5] as string,
    closeTime: k[6] as number,
    quoteAssetVolume: k[7] as string,
    numberOfTrades: k[8] as number,
    takerBuyBaseVolume: k[9] as string,
    takerBuyQuoteVolume: k[10] as string,
  }));
}

// ============================================================================
// 24hr Ticker
// ============================================================================

/**
 * Get 24hr ticker price change statistics.
 * @param symbol - Optional trading pair. If omitted, returns all tickers.
 */
export async function getTicker24h(
  symbol?: string
): Promise<BinanceTicker24h | BinanceTicker24h[]> {
  const params: Record<string, string | number | undefined> = {
    symbol: symbol?.toUpperCase(),
  };
  const url = buildUrl('/ticker/24hr', params);

  const { data } = await fetchJson<BinanceTicker24h | BinanceTicker24h[]>(
    url,
    { source: SOURCE, headers: headers() }
  );

  return data;
}

// ============================================================================
// Unified type adapters
// ============================================================================

/** Convert a Binance 24h ticker to a UnifiedTicker. */
export function toUnifiedTicker(t: BinanceTicker24h): UnifiedTicker {
  const { base, quote, unified } = parseConcatSymbol(t.symbol);
  return {
    exchange: 'binance',
    symbol: unified,
    baseAsset: base,
    quoteAsset: quote,
    last: parseFloat(t.lastPrice),
    bid: parseFloat(t.bidPrice),
    ask: parseFloat(t.askPrice),
    volume24h: parseFloat(t.volume),
    timestamp: t.closeTime,
  };
}

/** Convert a Binance kline to a UnifiedKline. */
export function toUnifiedKline(k: BinanceKline, symbol: string, interval: string): UnifiedKline {
  const { unified } = parseConcatSymbol(symbol);
  return {
    exchange: 'binance',
    symbol: unified,
    interval,
    open: parseFloat(k.open),
    high: parseFloat(k.high),
    low: parseFloat(k.low),
    close: parseFloat(k.close),
    volume: parseFloat(k.volume),
    timestamp: k.openTime,
  };
}

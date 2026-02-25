/**
 * KuCoin public REST API v1 client.
 *
 * Provides crypto market data without requiring an API key.
 * Docs: https://docs.kucoin.com/
 */
import { fetchJson } from '../shared.js';
import type {
  KucoinResponse,
  KucoinKline,
  KucoinTicker,
  KucoinAllTickersData,
  KucoinOrderBook,
} from './types.js';
import type { UnifiedTicker, UnifiedKline, UnifiedOrderBook } from '../types/crypto.js';
import { parseDashSymbol } from '../types/crypto.js';

const BASE_URL = 'https://api.kucoin.com/api/v1';
const SOURCE = 'KuCoin';

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
    endpoint: `kucoin${endpoint}`,
    params: params as Record<string, string | number | string[] | undefined>,
  };
}

/**
 * Unwrap the KuCoin response envelope. Throws if code !== '200000'.
 */
function unwrap<T>(response: KucoinResponse<T>, label: string): T {
  if (response.code !== '200000') {
    throw new Error(`[${SOURCE}] ${label} failed (code ${response.code})`);
  }
  return response.data;
}

// ============================================================================
// Klines (Candlesticks)
// ============================================================================

/**
 * Get kline/candlestick data for a symbol.
 * @param symbol  - Trading pair (e.g. "BTC-USDT")
 * @param type    - Kline interval: 1min, 5min, 15min, 1hour, 4hour, 1day
 * @param startAt - Start time in seconds (Unix)
 * @param endAt   - End time in seconds (Unix)
 */
export async function getKlines(
  symbol: string,
  type: string,
  startAt?: number,
  endAt?: number
): Promise<KucoinKline[]> {
  const params: Record<string, string | number | undefined> = {
    symbol,
    type,
    startAt,
    endAt,
  };
  const url = buildUrl('/market/candles', params);

  // Cache only when both startAt and endAt are provided and fully historical
  const nowSecs = Math.floor(Date.now() / 1000);
  const cacheable = !!(startAt && endAt && endAt < nowSecs - 86_400);

  const { data } = await fetchJson<KucoinResponse<string[][]>>(
    url,
    { source: SOURCE, headers: headers() },
    cacheOpts('/market/candles', params, cacheable)
  );

  const rows = unwrap(data, 'getKlines');

  // KuCoin kline array: [time(s), open, close, high, low, volume, turnover]
  return rows.map((k) => ({
    ts: Number(k[0]),
    open: k[1] as string,
    close: k[2] as string,
    high: k[3] as string,
    low: k[4] as string,
    volume: k[5] as string,
    turnover: k[6] as string,
  }));
}

// ============================================================================
// Ticker
// ============================================================================

/**
 * Get 24h ticker data.
 * @param symbol - If provided, returns single ticker stats. Otherwise returns all tickers.
 */
export async function getTicker(
  symbol?: string
): Promise<KucoinTicker[]> {
  if (symbol) {
    const url = buildUrl('/market/stats', { symbol });

    const { data } = await fetchJson<KucoinResponse<KucoinTicker>>(
      url,
      { source: SOURCE, headers: headers() }
    );

    return [unwrap(data, 'getTicker')];
  }

  const url = buildUrl('/market/allTickers');

  const { data } = await fetchJson<KucoinResponse<KucoinAllTickersData>>(
    url,
    { source: SOURCE, headers: headers() }
  );

  return unwrap(data, 'getTicker').ticker;
}

// ============================================================================
// Order Book
// ============================================================================

/**
 * Get order book depth (top 20 levels) for a symbol.
 * @param symbol - Trading pair (e.g. "BTC-USDT")
 */
export async function getOrderBook(
  symbol: string
): Promise<KucoinOrderBook> {
  const url = buildUrl('/market/orderbook/level2_20', { symbol });

  const { data } = await fetchJson<KucoinResponse<KucoinOrderBook>>(
    url,
    { source: SOURCE, headers: headers() }
  );

  return unwrap(data, 'getOrderBook');
}

// ============================================================================
// Unified type adapters
// ============================================================================

/** Convert a KuCoin ticker to a UnifiedTicker. */
export function toUnifiedTicker(t: KucoinTicker): UnifiedTicker {
  const { base, quote, unified } = parseDashSymbol(t.symbol);
  return {
    exchange: 'kucoin',
    symbol: unified,
    baseAsset: base,
    quoteAsset: quote,
    last: parseFloat(t.last),
    bid: parseFloat(t.buy),
    ask: parseFloat(t.sell),
    volume24h: parseFloat(t.vol),
    timestamp: t.time,
  };
}

/** Convert a KuCoin kline to a UnifiedKline. */
export function toUnifiedKline(k: KucoinKline, symbol: string, interval: string): UnifiedKline {
  const { unified } = parseDashSymbol(symbol);
  return {
    exchange: 'kucoin',
    symbol: unified,
    interval,
    open: parseFloat(k.open),
    high: parseFloat(k.high),
    low: parseFloat(k.low),
    close: parseFloat(k.close),
    volume: parseFloat(k.volume),
    timestamp: k.ts,
  };
}

/** Convert a KuCoin order book to a UnifiedOrderBook. */
export function toUnifiedOrderBook(book: KucoinOrderBook, symbol: string): UnifiedOrderBook {
  const { unified } = parseDashSymbol(symbol);
  return {
    exchange: 'kucoin',
    symbol: unified,
    bids: book.bids.map((e) => [parseFloat(e[0]), parseFloat(e[1])]),
    asks: book.asks.map((e) => [parseFloat(e[0]), parseFloat(e[1])]),
    timestamp: book.time,
  };
}

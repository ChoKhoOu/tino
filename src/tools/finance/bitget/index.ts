/**
 * Bitget public REST API V2 client.
 *
 * Provides crypto market data without requiring an API key.
 * Docs: https://www.bitget.com/api-doc/
 */
import { fetchJson } from '../shared.js';
import type {
  BitgetResponse,
  BitgetKlineRaw,
  BitgetKline,
  BitgetTicker,
  BitgetFundingRate,
  BitgetFundingRateHistory,
  BitgetOrderBook,
} from './types.js';
import type { UnifiedTicker, UnifiedKline, UnifiedFundingRate, UnifiedOrderBook } from '../types/crypto.js';
import { parseConcatSymbol } from '../types/crypto.js';

const BASE_URL = 'https://api.bitget.com';
const SOURCE = 'Bitget';

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
    endpoint: `bitget${endpoint}`,
    params: params as Record<string, string | number | string[] | undefined>,
  };
}

/**
 * Unwrap the Bitget response envelope. Throws if code !== '00000'.
 */
function unwrap<T>(response: BitgetResponse<T>, label: string): T {
  if (response.code !== '00000') {
    throw new Error(`[${SOURCE}] ${label} failed: ${response.msg} (code ${response.code})`);
  }
  return response.data;
}

// ============================================================================
// Klines (Candlesticks)
// ============================================================================

/**
 * Get kline/candlestick data for a symbol.
 * @param symbol    - Trading pair (e.g. "BTCUSDT")
 * @param granularity - Kline interval: 1min, 5min, 15min, 30min, 1h, 4h, 6h, 12h, 1day, 1week
 * @param startTime - Start time in milliseconds (Unix)
 * @param endTime   - End time in milliseconds (Unix)
 * @param limit     - Number of results (default 100, max 1000)
 */
export async function getKlines(
  symbol: string,
  granularity: string,
  startTime?: number,
  endTime?: number,
  limit = 100
): Promise<BitgetKline[]> {
  const params: Record<string, string | number | undefined> = {
    symbol,
    granularity,
    limit,
    startTime,
    endTime,
  };
  const url = buildUrl('/api/v2/spot/market/candles', params);

  // Cache only when both startTime and endTime are provided and fully historical
  const now = Date.now();
  const cacheable = !!(startTime && endTime && endTime < now - 86_400_000);

  const { data } = await fetchJson<BitgetResponse<BitgetKlineRaw[]>>(
    url,
    { source: SOURCE, headers: headers() },
    cacheOpts('/api/v2/spot/market/candles', params, cacheable)
  );

  const rows = unwrap(data, 'getKlines');

  // Bitget kline array: [ts(ms), open, high, low, close, volume, quoteVolume, usdtVolume]
  return rows.map((k) => ({
    ts: Number(k[0]),
    open: k[1] as string,
    high: k[2] as string,
    low: k[3] as string,
    close: k[4] as string,
    volume: k[5] as string,
    quoteVolume: k[6] as string,
  }));
}

// ============================================================================
// Ticker
// ============================================================================

/**
 * Get spot ticker data.
 * @param symbol - If provided, returns single ticker. Otherwise returns all.
 */
export async function getTicker(
  symbol?: string
): Promise<BitgetTicker[]> {
  if (symbol) {
    const url = buildUrl('/api/v2/spot/market/tickers', { symbol });

    const { data } = await fetchJson<BitgetResponse<BitgetTicker[]>>(
      url,
      { source: SOURCE, headers: headers() }
    );

    return unwrap(data, 'getTicker');
  }

  const url = buildUrl('/api/v2/spot/market/tickers');

  const { data } = await fetchJson<BitgetResponse<BitgetTicker[]>>(
    url,
    { source: SOURCE, headers: headers() }
  );

  return unwrap(data, 'getTicker');
}

// ============================================================================
// Funding Rate
// ============================================================================

/**
 * Get current funding rate for a USDT-M perpetual futures contract.
 * @param symbol - Contract symbol (e.g. "BTCUSDT")
 */
export async function getFundingRate(
  symbol: string
): Promise<BitgetFundingRate> {
  const url = buildUrl('/api/v2/mix/market/current-fund-rate', {
    symbol,
    productType: 'USDT-FUTURES',
  });

  const { data } = await fetchJson<BitgetResponse<BitgetFundingRate[]>>(
    url,
    { source: SOURCE, headers: headers() }
  );

  const rows = unwrap(data, 'getFundingRate');
  if (rows.length === 0) {
    throw new Error(`[${SOURCE}] No funding rate data for ${symbol}`);
  }
  return rows[0]!;
}

/**
 * Get historical funding rates for a USDT-M perpetual futures contract.
 * @param symbol   - Contract symbol (e.g. "BTCUSDT")
 * @param pageSize - Number of results (default 100)
 */
export async function getFundingRateHistory(
  symbol: string,
  pageSize = 100
): Promise<BitgetFundingRateHistory[]> {
  const params: Record<string, string | number | undefined> = {
    symbol,
    productType: 'USDT-FUTURES',
    pageSize,
  };
  const url = buildUrl('/api/v2/mix/market/history-fund-rate', params);

  const { data } = await fetchJson<BitgetResponse<BitgetFundingRateHistory[]>>(
    url,
    { source: SOURCE, headers: headers() }
  );

  return unwrap(data, 'getFundingRateHistory');
}

// ============================================================================
// Order Book
// ============================================================================

/**
 * Get order book depth for a symbol.
 * @param symbol - Trading pair (e.g. "BTCUSDT")
 * @param limit  - Depth levels (default 20, max 150)
 */
export async function getOrderBook(
  symbol: string,
  limit = 20
): Promise<BitgetOrderBook> {
  const params: Record<string, string | number | undefined> = {
    symbol,
    limit,
  };
  const url = buildUrl('/api/v2/spot/market/orderbook', params);

  const { data } = await fetchJson<BitgetResponse<BitgetOrderBook>>(
    url,
    { source: SOURCE, headers: headers() }
  );

  return unwrap(data, 'getOrderBook');
}

// ============================================================================
// Unified type adapters
// ============================================================================

/** Convert a Bitget ticker to a UnifiedTicker. */
export function toUnifiedTicker(t: BitgetTicker): UnifiedTicker {
  const { base, quote, unified } = parseConcatSymbol(t.symbol);
  return {
    exchange: 'bitget',
    symbol: unified,
    baseAsset: base,
    quoteAsset: quote,
    last: parseFloat(t.lastPr),
    bid: parseFloat(t.bidPr),
    ask: parseFloat(t.askPr),
    volume24h: parseFloat(t.baseVolume),
    timestamp: Number(t.ts),
  };
}

/** Convert a Bitget kline to a UnifiedKline. */
export function toUnifiedKline(k: BitgetKline, symbol: string, interval: string): UnifiedKline {
  const { unified } = parseConcatSymbol(symbol);
  return {
    exchange: 'bitget',
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

/** Convert a Bitget funding rate to a UnifiedFundingRate. */
export function toUnifiedFundingRate(fr: BitgetFundingRate): UnifiedFundingRate {
  const { unified } = parseConcatSymbol(fr.symbol);
  return {
    exchange: 'bitget',
    symbol: unified,
    rate: parseFloat(fr.fundingRate),
    nextFundingTime: 0,
    markPrice: 0,
    indexPrice: 0,
  };
}

/** Convert a Bitget order book to a UnifiedOrderBook. */
export function toUnifiedOrderBook(book: BitgetOrderBook, symbol: string): UnifiedOrderBook {
  const { unified } = parseConcatSymbol(symbol);
  return {
    exchange: 'bitget',
    symbol: unified,
    bids: book.bids.map((e) => [parseFloat(e[0]), parseFloat(e[1])]),
    asks: book.asks.map((e) => [parseFloat(e[0]), parseFloat(e[1])]),
    timestamp: Number(book.ts),
  };
}

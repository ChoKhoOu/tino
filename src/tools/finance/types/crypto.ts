/**
 * Unified crypto CEX market data types and CoinGecko response types.
 *
 * The Unified* types define a common contract for all exchange providers.
 * Each provider's adapter layer converts exchange-specific responses into
 * these unified shapes so upstream consumers can work exchange-agnostically.
 */

// ============================================================================
// Unified CEX market data types
// ============================================================================

/** Supported centralized exchanges. */
export type CryptoExchange = 'binance' | 'okx' | 'bybit' | 'gate' | 'kucoin' | 'bitget';

/** Unified ticker / 24h price statistics. */
export interface UnifiedTicker {
  exchange: CryptoExchange;
  /** Slash-separated symbol, e.g. "BTC/USDT". */
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  last: number;
  bid: number;
  ask: number;
  volume24h: number;
  /** Unix timestamp in milliseconds. */
  timestamp: number;
}

/** Unified order book snapshot. */
export interface UnifiedOrderBook {
  exchange: CryptoExchange;
  symbol: string;
  /** Each entry is [price, quantity]. */
  bids: [number, number][];
  /** Each entry is [price, quantity]. */
  asks: [number, number][];
  timestamp: number;
}

/** Unified funding rate for perpetual swaps. */
export interface UnifiedFundingRate {
  exchange: CryptoExchange;
  symbol: string;
  rate: number;
  /** Unix timestamp in ms for next funding settlement. */
  nextFundingTime: number;
  markPrice: number;
  indexPrice: number;
}

/** Unified position information. */
export interface UnifiedPosition {
  exchange: CryptoExchange;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  leverage: number;
}

/** Unified kline / candlestick data. */
export interface UnifiedKline {
  exchange: CryptoExchange;
  symbol: string;
  interval: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

// ============================================================================
// Symbol parsing utilities
// ============================================================================

const KNOWN_QUOTES = ['USDT', 'USDC', 'BUSD', 'TUSD', 'FDUSD', 'DAI', 'BTC', 'ETH', 'BNB'];

/**
 * Parse a concatenated symbol (e.g. "BTCUSDT") into base/quote/unified.
 * Used by Binance and Bybit whose symbols lack a delimiter.
 */
export function parseConcatSymbol(raw: string): { base: string; quote: string; unified: string } {
  const upper = raw.toUpperCase();
  for (const quote of KNOWN_QUOTES) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      const base = upper.slice(0, -quote.length);
      return { base, quote, unified: `${base}/${quote}` };
    }
  }
  return { base: upper, quote: '', unified: upper };
}

/**
 * Parse a dash-separated symbol (e.g. "BTC-USDT" or "BTC-USDT-SWAP").
 * Used by OKX.
 */
export function parseDashSymbol(instId: string): { base: string; quote: string; unified: string } {
  const parts = instId.split('-');
  const base = parts[0]!;
  const quote = parts[1]!;
  return { base, quote, unified: `${base}/${quote}` };
}

// ============================================================================
// CoinGecko response types
// ============================================================================

export interface CoinGeckoPriceEntry {
  [key: string]: number | undefined;
}

export interface CoinGeckoPrice {
  [coinId: string]: CoinGeckoPriceEntry;
}

export interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number | null;
  market_data: {
    current_price: Record<string, number>;
    market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    circulating_supply: number;
    total_supply: number | null;
    max_supply: number | null;
    price_change_percentage_24h: number | null;
    price_change_percentage_7d: number | null;
    price_change_percentage_30d: number | null;
  };
}

export interface CoinGeckoHistoryPoint {
  timestamp: number;
  price: number;
}

export interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number | null;
}

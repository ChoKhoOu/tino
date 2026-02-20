/**
 * CoinGecko response types.
 * Cryptocurrency pricing, market data, and history.
 */

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

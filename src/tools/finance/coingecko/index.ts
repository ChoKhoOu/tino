/**
 * CoinGecko API client.
 *
 * Provides crypto market data: current prices, market cap, volume,
 * historical data, and top coins ranking.
 *
 * API key is optional — free tier works without one.
 * Docs: https://www.coingecko.com/en/api/documentation
 */
import { fetchJson, getOptionalApiKey } from '../shared.js';
import type {
  CoinGeckoPrice,
  CoinGeckoMarketData,
  CoinGeckoHistoryPoint,
  CoinGeckoCoin,
} from '../types.js';

const BASE_URL = 'https://api.coingecko.com/api/v3';
const SOURCE = 'CoinGecko';

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
  const h: Record<string, string> = { Accept: 'application/json' };
  const apiKey = getOptionalApiKey('COINGECKO_API_KEY');
  if (apiKey) {
    h['x-cg-demo-api-key'] = apiKey;
  }
  return h;
}

function cacheOpts(endpoint: string, params: Record<string, string | number | undefined>, cacheable = false) {
  return {
    cacheable,
    endpoint: `coingecko${endpoint}`,
    params: params as Record<string, string | number | string[] | undefined>,
  };
}

// ============================================================================
// Current Price
// ============================================================================

/**
 * Get current price for a coin.
 * @param coinId - CoinGecko coin ID (e.g. "bitcoin", "ethereum")
 * @param vsCurrency - Target currency (default "usd")
 */
export async function getCoinPrice(
  coinId: string,
  vsCurrency = 'usd'
): Promise<CoinGeckoPrice> {
  const url = buildUrl('/simple/price', {
    ids: coinId,
    vs_currencies: vsCurrency,
    include_last_updated_at: 'true',
  });
  const { data } = await fetchJson<CoinGeckoPrice>(
    url,
    { source: SOURCE, headers: headers() }
  );
  return data;
}

// ============================================================================
// Market Data
// ============================================================================

/**
 * Get detailed market data for a coin (market cap, volume, supply, price changes).
 */
export async function getCoinMarketData(coinId: string): Promise<CoinGeckoMarketData> {
  const url = buildUrl(`/coins/${coinId}`, {
    localization: 'false',
    tickers: 'false',
    community_data: 'false',
    developer_data: 'false',
  });
  const { data } = await fetchJson<CoinGeckoMarketData>(
    url,
    { source: SOURCE, headers: headers() }
  );
  return data;
}

// ============================================================================
// Historical Prices
// ============================================================================

/**
 * Get historical price data for a coin in a date range.
 * @param coinId - CoinGecko coin ID
 * @param from - Unix timestamp (seconds)
 * @param to - Unix timestamp (seconds)
 */
export async function getCoinHistory(
  coinId: string,
  from: number,
  to: number
): Promise<CoinGeckoHistoryPoint[]> {
  const url = buildUrl(`/coins/${coinId}/market_chart/range`, {
    vs_currency: 'usd',
    from,
    to,
  });

  // Cache only for fully-historical ranges
  const now = Math.floor(Date.now() / 1000);
  const cacheable = to < now - 86400; // more than 1 day in the past

  const { data } = await fetchJson<{ prices: [number, number][] }>(
    url,
    { source: SOURCE, headers: headers() },
    cacheOpts(`/coins/${coinId}/market_chart/range`, { from, to }, cacheable)
  );

  return (data.prices ?? []).map(([timestamp, price]) => ({ timestamp, price }));
}

// ============================================================================
// Top Coins
// ============================================================================

/**
 * Get top coins ranked by market cap.
 */
export async function getTopCoins(
  limit = 20,
  vsCurrency = 'usd'
): Promise<CoinGeckoCoin[]> {
  const url = buildUrl('/coins/markets', {
    vs_currency: vsCurrency,
    order: 'market_cap_desc',
    per_page: limit,
    page: 1,
    sparkline: 'false',
  });
  const { data } = await fetchJson<CoinGeckoCoin[]>(
    url,
    { source: SOURCE, headers: headers() }
  );
  return data;
}

/**
 * Finnhub API client.
 *
 * Provides market news, company-specific news, social sentiment,
 * earnings calendar, and insider transaction data.
 *
 * Docs: https://finnhub.io/docs/api
 */
import { fetchJson, validateApiKey } from '../shared.js';
import type {
  FinnhubNewsItem,
  FinnhubSentimentResponse,
  FinnhubEarningsEvent,
  FinnhubInsiderResponse,
} from '../types.js';

const BASE_URL = 'https://finnhub.io/api/v1';
const SOURCE = 'Finnhub';

function buildUrl(
  endpoint: string,
  params: Record<string, string | number | undefined> = {}
): string {
  const apiKey = validateApiKey('Finnhub', 'FINNHUB_API_KEY');
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('token', apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function cacheOpts(endpoint: string, params: Record<string, string | number | undefined>, cacheable = false) {
  return {
    cacheable,
    endpoint: `finnhub${endpoint}`,
    params: params as Record<string, string | number | string[] | undefined>,
  };
}

// ============================================================================
// Market News
// ============================================================================

/**
 * Get general market news.
 * @param category - News category: "general", "forex", "crypto", "merger"
 * @param minId - Only return news with ID greater than this (for pagination)
 */
export async function getFinnhubNews(
  category = 'general',
  minId?: number
): Promise<FinnhubNewsItem[]> {
  const url = buildUrl('/news', { category, minId });
  // News is ephemeral — don't cache
  const { data } = await fetchJson<FinnhubNewsItem[]>(
    url,
    { source: SOURCE }
  );
  return data;
}

// ============================================================================
// Company News
// ============================================================================

/**
 * Get news for a specific company in a date range.
 * @param ticker - Stock symbol
 * @param from - Start date (YYYY-MM-DD)
 * @param to - End date (YYYY-MM-DD)
 */
export async function getFinnhubCompanyNews(
  ticker: string,
  from: string,
  to: string
): Promise<FinnhubNewsItem[]> {
  const url = buildUrl('/company-news', { symbol: ticker, from, to });

  // Cache when date range is fully in the past
  const endDate = new Date(to);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cacheable = endDate < today;

  const { data } = await fetchJson<FinnhubNewsItem[]>(
    url,
    { source: SOURCE },
    cacheOpts('/company-news', { symbol: ticker, from, to }, cacheable)
  );
  return data;
}

// ============================================================================
// Social Sentiment
// ============================================================================

/**
 * Get social sentiment data for a ticker.
 */
export async function getFinnhubSentiment(ticker: string): Promise<FinnhubSentimentResponse> {
  const url = buildUrl('/stock/social-sentiment', { symbol: ticker });
  // Sentiment data is near-real-time — don't cache
  const { data } = await fetchJson<FinnhubSentimentResponse>(
    url,
    { source: SOURCE }
  );
  return data;
}

// ============================================================================
// Earnings Calendar
// ============================================================================

/**
 * Get upcoming earnings calendar events.
 * @param from - Start date (YYYY-MM-DD)
 * @param to - End date (YYYY-MM-DD)
 */
export async function getFinnhubEarningsCalendar(
  from?: string,
  to?: string
): Promise<FinnhubEarningsEvent[]> {
  const url = buildUrl('/calendar/earnings', { from, to });

  const { data } = await fetchJson<{ earningsCalendar: FinnhubEarningsEvent[] }>(
    url,
    { source: SOURCE },
    cacheOpts('/calendar/earnings', { from, to }, true)
  );
  return data.earningsCalendar ?? [];
}

// ============================================================================
// Insider Transactions
// ============================================================================

/**
 * Get insider transactions for a ticker.
 */
export async function getFinnhubInsiderTransactions(ticker: string): Promise<FinnhubInsiderResponse> {
  const url = buildUrl('/stock/insider-transactions', { symbol: ticker });
  const { data } = await fetchJson<FinnhubInsiderResponse>(
    url,
    { source: SOURCE },
    cacheOpts('/stock/insider-transactions', { symbol: ticker }, true)
  );
  return data;
}

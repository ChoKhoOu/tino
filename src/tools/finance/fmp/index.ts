/**
 * FMP (Financial Modeling Prep) API client.
 *
 * Provides access to fundamentals, financial statements, key metrics,
 * ratios, DCF valuations, historical prices, insider trades, and
 * earnings call transcripts.
 *
 * Docs: https://financialmodelingprep.com/developer/docs
 */
import { fetchJson, validateApiKey } from '../shared.js';
import type {
  FmpFinancialStatement,
  FmpKeyMetric,
  FmpRatio,
  FmpDcf,
  FmpHistoricalPrice,
  FmpInsiderTrade,
  FmpEarningsTranscript,
} from '../types.js';

const BASE_URL = 'https://financialmodelingprep.com/api/v3';
const SOURCE = 'FMP';

function buildUrl(
  endpoint: string,
  params: Record<string, string | number | undefined> = {}
): string {
  const apiKey = validateApiKey('FMP', 'FMP_API_KEY');
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('apikey', apiKey);
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
    endpoint: `fmp${endpoint}`,
    params: params as Record<string, string | number | string[] | undefined>,
  };
}

// ============================================================================
// Financial Statements
// ============================================================================

export async function getFmpIncomeStatement(
  ticker: string,
  period: 'annual' | 'quarterly' = 'annual',
  limit = 10
): Promise<FmpFinancialStatement[]> {
  const url = buildUrl(`/income-statement/${ticker}`, { period, limit });
  const { data } = await fetchJson<FmpFinancialStatement[]>(
    url,
    { source: SOURCE },
    cacheOpts(`/income-statement/${ticker}`, { period, limit })
  );
  return data;
}

export async function getFmpBalanceSheet(
  ticker: string,
  period: 'annual' | 'quarterly' = 'annual',
  limit = 10
): Promise<FmpFinancialStatement[]> {
  const url = buildUrl(`/balance-sheet-statement/${ticker}`, { period, limit });
  const { data } = await fetchJson<FmpFinancialStatement[]>(
    url,
    { source: SOURCE },
    cacheOpts(`/balance-sheet-statement/${ticker}`, { period, limit })
  );
  return data;
}

export async function getFmpCashFlow(
  ticker: string,
  period: 'annual' | 'quarterly' = 'annual',
  limit = 10
): Promise<FmpFinancialStatement[]> {
  const url = buildUrl(`/cash-flow-statement/${ticker}`, { period, limit });
  const { data } = await fetchJson<FmpFinancialStatement[]>(
    url,
    { source: SOURCE },
    cacheOpts(`/cash-flow-statement/${ticker}`, { period, limit })
  );
  return data;
}

// ============================================================================
// Metrics & Ratios
// ============================================================================

export async function getFmpKeyMetrics(
  ticker: string,
  period: 'annual' | 'quarterly' = 'annual',
  limit = 10
): Promise<FmpKeyMetric[]> {
  const url = buildUrl(`/key-metrics/${ticker}`, { period, limit });
  const { data } = await fetchJson<FmpKeyMetric[]>(
    url,
    { source: SOURCE },
    cacheOpts(`/key-metrics/${ticker}`, { period, limit })
  );
  return data;
}

export async function getFmpRatios(
  ticker: string,
  period: 'annual' | 'quarterly' = 'annual',
  limit = 10
): Promise<FmpRatio[]> {
  const url = buildUrl(`/ratios/${ticker}`, { period, limit });
  const { data } = await fetchJson<FmpRatio[]>(
    url,
    { source: SOURCE },
    cacheOpts(`/ratios/${ticker}`, { period, limit })
  );
  return data;
}

// ============================================================================
// DCF Valuation
// ============================================================================

export async function getFmpDcf(ticker: string): Promise<FmpDcf[]> {
  const url = buildUrl(`/discounted-cash-flow/${ticker}`);
  const { data } = await fetchJson<FmpDcf[]>(
    url,
    { source: SOURCE },
    cacheOpts(`/discounted-cash-flow/${ticker}`, {})
  );
  return data;
}

// ============================================================================
// Historical Prices
// ============================================================================

export async function getFmpPrices(
  ticker: string,
  from?: string,
  to?: string
): Promise<FmpHistoricalPrice[]> {
  const url = buildUrl(`/historical-price-full/${ticker}`, { from, to });
  // Cache only when the date range is fully in the past
  const endDate = to ? new Date(to) : new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cacheable = endDate < today;

  const { data } = await fetchJson<{ historical: FmpHistoricalPrice[] }>(
    url,
    { source: SOURCE },
    cacheOpts(`/historical-price-full/${ticker}`, { from, to }, cacheable)
  );
  return data.historical ?? [];
}

// ============================================================================
// Insider Trades
// ============================================================================

export async function getFmpInsiderTrades(
  ticker: string,
  limit = 50
): Promise<FmpInsiderTrade[]> {
  const url = buildUrl('/insider-trading', { symbol: ticker, limit });
  const { data } = await fetchJson<FmpInsiderTrade[]>(
    url,
    { source: SOURCE },
    cacheOpts('/insider-trading', { symbol: ticker, limit })
  );
  return data;
}

// ============================================================================
// Earnings Transcripts
// ============================================================================

export async function getFmpEarningsTranscripts(
  ticker: string,
  year: number,
  quarter: number
): Promise<FmpEarningsTranscript[]> {
  const url = buildUrl(`/earning_call_transcript/${ticker}`, { year, quarter });
  const { data } = await fetchJson<FmpEarningsTranscript[]>(
    url,
    { source: SOURCE },
    cacheOpts(`/earning_call_transcript/${ticker}`, { year, quarter })
  );
  return data;
}

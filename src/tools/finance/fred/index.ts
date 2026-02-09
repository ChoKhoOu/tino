/**
 * FRED (Federal Reserve Economic Data) API client.
 *
 * Provides access to US economic indicators: GDP, CPI, Fed Funds rate,
 * Treasury yields, unemployment, and thousands of other time series.
 *
 * Docs: https://fred.stlouisfed.org/docs/api/fred/
 */
import { fetchJson, validateApiKey } from '../shared.js';
import type { FredObservation, FredSeriesInfo, FredSearchResult } from '../types.js';

const BASE_URL = 'https://api.stlouisfed.org/fred';
const SOURCE = 'FRED';

function buildUrl(
  endpoint: string,
  params: Record<string, string | number | undefined> = {}
): string {
  const apiKey = validateApiKey('FRED', 'FRED_API_KEY');
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('file_type', 'json');
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
    endpoint: `fred${endpoint}`,
    params: params as Record<string, string | number | string[] | undefined>,
  };
}

// ============================================================================
// Time Series Data
// ============================================================================

/**
 * Fetch observations (data points) for a FRED series.
 * Common series IDs: GDP, CPIAUCSL, FEDFUNDS, DGS10, UNRATE
 */
export async function getFredSeries(
  seriesId: string,
  startDate?: string,
  endDate?: string
): Promise<FredObservation[]> {
  const url = buildUrl('/series/observations', {
    series_id: seriesId,
    observation_start: startDate,
    observation_end: endDate,
  });

  // Cache when end date is in the past (historical data is immutable)
  const end = endDate ? new Date(endDate) : new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cacheable = end < today;

  const { data } = await fetchJson<{ observations: FredObservation[] }>(
    url,
    { source: SOURCE },
    cacheOpts('/series/observations', {
      series_id: seriesId,
      observation_start: startDate,
      observation_end: endDate,
    }, cacheable)
  );
  return data.observations ?? [];
}

// ============================================================================
// Series Search
// ============================================================================

/**
 * Search for FRED series by keyword.
 */
export async function searchFredSeries(
  query: string,
  limit = 20
): Promise<FredSearchResult[]> {
  const url = buildUrl('/series/search', {
    search_text: query,
    limit,
  });
  const { data } = await fetchJson<{ seriess: FredSearchResult[] }>(
    url,
    { source: SOURCE },
    cacheOpts('/series/search', { search_text: query, limit })
  );
  return data.seriess ?? [];
}

// ============================================================================
// Series Metadata
// ============================================================================

/**
 * Get metadata about a FRED series (title, frequency, units, etc.).
 */
export async function getFredSeriesInfo(seriesId: string): Promise<FredSeriesInfo | null> {
  const url = buildUrl('/series', { series_id: seriesId });
  const { data } = await fetchJson<{ seriess: FredSeriesInfo[] }>(
    url,
    { source: SOURCE },
    cacheOpts('/series', { series_id: seriesId })
  );
  return data.seriess?.[0] ?? null;
}

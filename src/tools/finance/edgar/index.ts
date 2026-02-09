/**
 * SEC EDGAR API client.
 *
 * Provides access to SEC filing search (EFTS), XBRL structured
 * financial data (company facts), and company submission history.
 *
 * No API key needed — EDGAR is free and public.
 * SEC requires a descriptive User-Agent header on all requests.
 *
 * Docs: https://efts.sec.gov/LATEST/search-index
 *       https://www.sec.gov/edgar/sec-api-documentation
 */
import { fetchJson } from '../shared.js';
import type {
  EdgarSearchResponse,
  EdgarCompanyFacts,
  EdgarSubmissions,
} from '../types.js';

const EFTS_BASE_URL = 'https://efts.sec.gov/LATEST';
const DATA_BASE_URL = 'https://data.sec.gov';
const SOURCE = 'EDGAR';

/** SEC requires a descriptive User-Agent header */
const USER_AGENT = 'Tino/0.1.0 (contact@example.com)';

function edgarHeaders(): Record<string, string> {
  return {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  };
}

function cacheOpts(endpoint: string, params: Record<string, string | number | undefined>, cacheable = true) {
  return {
    cacheable,
    endpoint: `edgar${endpoint}`,
    params: params as Record<string, string | number | string[] | undefined>,
  };
}

/**
 * Pad a CIK number to 10 digits with leading zeros (SEC convention).
 */
function padCik(cik: string | number): string {
  return String(cik).padStart(10, '0');
}

// ============================================================================
// Filing Search (Full-Text Search)
// ============================================================================

/**
 * Search SEC filings using EDGAR full-text search.
 * @param query - Search query string
 * @param dateRange - Optional date range filter (e.g. "2023-01-01,2024-01-01")
 * @param formTypes - Optional form type filter (e.g. "10-K,10-Q")
 */
export async function searchEdgarFilings(
  query: string,
  dateRange?: string,
  formTypes?: string
): Promise<EdgarSearchResponse> {
  const url = new URL(`${EFTS_BASE_URL}/search-index`);
  url.searchParams.set('q', query);
  if (dateRange) url.searchParams.set('dateRange', dateRange);
  if (formTypes) url.searchParams.set('forms', formTypes);

  const { data } = await fetchJson<EdgarSearchResponse>(
    url.toString(),
    { source: SOURCE, headers: edgarHeaders() },
    cacheOpts('/search-index', { q: query, dateRange, forms: formTypes })
  );
  return data;
}

// ============================================================================
// XBRL Company Facts
// ============================================================================

/**
 * Get XBRL-structured financial data for a company.
 * Returns all reported facts (revenue, net income, assets, etc.) across all filings.
 *
 * @param cik - SEC CIK number (will be zero-padded to 10 digits)
 */
export async function getEdgarCompanyFacts(cik: string | number): Promise<EdgarCompanyFacts> {
  const paddedCik = padCik(cik);
  const url = `${DATA_BASE_URL}/api/xbrl/companyfacts/CIK${paddedCik}.json`;

  const { data } = await fetchJson<EdgarCompanyFacts>(
    url,
    { source: SOURCE, headers: edgarHeaders() },
    cacheOpts(`/companyfacts/${paddedCik}`, {})
  );
  return data;
}

// ============================================================================
// Company Submissions (Filing History)
// ============================================================================

/**
 * Get a company's filing submission history from EDGAR.
 *
 * @param cik - SEC CIK number (will be zero-padded to 10 digits)
 */
export async function getEdgarSubmissions(cik: string | number): Promise<EdgarSubmissions> {
  const paddedCik = padCik(cik);
  const url = `${DATA_BASE_URL}/submissions/CIK${paddedCik}.json`;

  const { data } = await fetchJson<EdgarSubmissions>(
    url,
    { source: SOURCE, headers: edgarHeaders() },
    cacheOpts(`/submissions/${paddedCik}`, {})
  );
  return data;
}

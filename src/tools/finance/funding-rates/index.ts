/**
 * Binance Futures funding rate client.
 *
 * Fetches funding rates from the public Binance Futures API.
 * No API key required.
 *
 * Docs: https://binance-docs.github.io/apidocs/futures/en/#get-funding-rate-history
 */
import { fetchJson } from '../shared.js';
import type { FundingRateEntry, BinanceFundingRateRaw } from './types.js';

const BASE_URL = 'https://fapi.binance.com/fapi/v1';
const SOURCE = 'Binance Futures';

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

function parseEntry(raw: BinanceFundingRateRaw): FundingRateEntry {
  return {
    symbol: raw.symbol,
    fundingRate: parseFloat(raw.fundingRate),
    fundingTime: raw.fundingTime,
    markPrice: parseFloat(raw.markPrice),
  };
}

// ============================================================================
// Current Funding Rates
// ============================================================================

/** Default major perpetual symbols to query. */
const DEFAULT_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
];

/**
 * Get the most recent funding rate for each symbol.
 * @param symbols - Perpetual symbols (e.g. BTCUSDT). Defaults to top-10 majors.
 */
export async function getCurrentFundingRates(
  symbols?: string[]
): Promise<FundingRateEntry[]> {
  const targets = symbols ?? DEFAULT_SYMBOLS;
  const results: FundingRateEntry[] = [];

  for (const symbol of targets) {
    const url = buildUrl('/fundingRate', { symbol, limit: 1 });
    const { data } = await fetchJson<BinanceFundingRateRaw[]>(
      url,
      { source: SOURCE, headers: { Accept: 'application/json' } }
    );
    if (data.length > 0) {
      results.push(parseEntry(data[0]!));
    }
  }

  return results;
}

// ============================================================================
// Historical Funding Rates
// ============================================================================

/**
 * Get historical funding rates for a symbol in a time range.
 * @param symbol - Perpetual symbol (e.g. BTCUSDT)
 * @param startTime - Start timestamp (ms)
 * @param endTime - End timestamp (ms)
 */
export async function getHistoricalFundingRates(
  symbol: string,
  startTime: number,
  endTime: number
): Promise<FundingRateEntry[]> {
  const url = buildUrl('/fundingRate', {
    symbol,
    startTime,
    endTime,
    limit: 1000,
  });

  // Historical ranges are cacheable
  const now = Date.now();
  const cacheable = endTime < now - 86400_000;

  const { data } = await fetchJson<BinanceFundingRateRaw[]>(
    url,
    { source: SOURCE, headers: { Accept: 'application/json' } },
    {
      cacheable,
      endpoint: `binance/fundingRate/${symbol}`,
      params: { startTime, endTime },
    }
  );

  return data.map(parseEntry);
}

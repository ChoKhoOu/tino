import { fetchJson, validateApiKey } from '../shared.js';
import { normalizeHkTicker } from '../hk-market.js';
import type {
  EodhdRealTimeQuote,
  EodhdHistoricalPrice,
  EodhdFundamentals,
  HkStockPrice,
} from '../types.js';

const BASE_URL = 'https://eodhd.com/api';
const SOURCE = 'EODHD';

function buildUrl(
  endpoint: string,
  params: Record<string, string | number | undefined> = {}
): string {
  const apiKey = validateApiKey('EODHD', 'EODHD_API_KEY');
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('api_token', apiKey);
  url.searchParams.set('fmt', 'json');
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function cacheOpts(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  cacheable = true
) {
  return {
    cacheable,
    endpoint: `eodhd${endpoint}`,
    params: params as Record<string, string | number | string[] | undefined>,
  };
}

function toEodhdTicker(ticker: string): string {
  const normalized = normalizeHkTicker(ticker);
  const code = normalized.replace('.HK', '');
  return `${code}.HK`;
}

export async function getHkStockPrice(ticker: string): Promise<HkStockPrice> {
  const eodhdTicker = toEodhdTicker(ticker);
  const endpoint = `/real-time/${eodhdTicker}`;
  const url = buildUrl(endpoint);

  const { data } = await fetchJson<EodhdRealTimeQuote>(
    url,
    { source: SOURCE }
  );

  return {
    ticker: normalizeHkTicker(ticker),
    price: data.close,
    change: data.change,
    changePercent: data.change_p,
    volume: data.volume,
    currency: 'HKD',
  };
}

export async function getHkStockHistory(
  ticker: string,
  from: string,
  to: string
): Promise<EodhdHistoricalPrice[]> {
  const eodhdTicker = toEodhdTicker(ticker);
  const endpoint = `/eod/${eodhdTicker}`;
  const url = buildUrl(endpoint, { from, to });

  const endDate = new Date(to);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cacheable = endDate < today;

  const { data } = await fetchJson<EodhdHistoricalPrice[]>(
    url,
    { source: SOURCE },
    cacheOpts(endpoint, { ticker: eodhdTicker, from, to }, cacheable)
  );
  return data;
}

export async function getHkFundamentals(
  ticker: string
): Promise<EodhdFundamentals> {
  const eodhdTicker = toEodhdTicker(ticker);
  const endpoint = `/fundamentals/${eodhdTicker}`;
  const url = buildUrl(endpoint);

  const { data } = await fetchJson<EodhdFundamentals>(
    url,
    { source: SOURCE },
    cacheOpts(endpoint, { ticker: eodhdTicker })
  );
  return data;
}

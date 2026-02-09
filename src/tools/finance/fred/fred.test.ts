import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { getFredSeries, searchFredSeries, getFredSeriesInfo } from './index.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

describe('FRED client', () => {
  const originalFetch = globalThis.fetch;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => { process.env.FRED_API_KEY = 'test-fred-key'; });
  afterEach(() => { globalThis.fetch = originalFetch; process.env = { ...ORIGINAL_ENV }; });

  test('getFredSeries returns observations', async () => {
    const mockData = { observations: [{ date: '2024-01-01', value: '25462.7' }, { date: '2024-04-01', value: '25819.8' }] };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('series_id=GDP');
      expect(urlStr).toContain('api_key=test-fred-key');
      expect(urlStr).toContain('file_type=json');
      return new Response(JSON.stringify(mockData), { status: 200 });
    });
    const result = await getFredSeries('GDP', '2024-01-01', '2024-12-31');
    expect(result).toHaveLength(2);
    expect(result[0]!.value).toBe('25462.7');
  });

  test('throws when FRED_API_KEY is missing', async () => {
    delete process.env.FRED_API_KEY;
    await expect(getFredSeries('GDP')).rejects.toThrow('Missing API key');
  });

  test('searchFredSeries returns search results', async () => {
    const mockData = { seriess: [{ id: 'GDP', title: 'Gross Domestic Product', observation_start: '1947-01-01', observation_end: '2024-07-01', frequency: 'Quarterly', units: 'Billions of Dollars', popularity: 99 }] };
    mockFetch(async () => new Response(JSON.stringify(mockData), { status: 200 }));
    const result = await searchFredSeries('GDP');
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('GDP');
  });

  test('getFredSeriesInfo returns metadata', async () => {
    const mockData = { seriess: [{ id: 'FEDFUNDS', title: 'Federal Funds Effective Rate', observation_start: '1954-07-01', observation_end: '2024-11-01', frequency: 'Monthly', frequency_short: 'M', units: 'Percent', units_short: '%', seasonal_adjustment: 'Not Seasonally Adjusted', seasonal_adjustment_short: 'NSA', notes: 'The rate is a volume-weighted median.' }] };
    mockFetch(async () => new Response(JSON.stringify(mockData), { status: 200 }));
    const result = await getFredSeriesInfo('FEDFUNDS');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('FEDFUNDS');
    expect(result!.frequency).toBe('Monthly');
  });
});

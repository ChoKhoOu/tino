import { describe, test, expect, afterEach } from 'bun:test';
import { searchEdgarFilings, getEdgarCompanyFacts, getEdgarSubmissions } from './index.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

describe('EDGAR client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => { globalThis.fetch = originalFetch; });

  test('searchEdgarFilings returns search results', async () => {
    const mockData = { query: 'Apple 10-K', total: { value: 42 }, hits: [{ _id: '0000320193-24-000123', _source: { file_date: '2024-11-01', form_type: '10-K', entity_name: 'Apple Inc.', file_num: '001-36743', period_of_report: '2024-09-28' } }] };
    mockFetch(async (url, init) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('search-index');
      expect(urlStr).toContain('q=Apple');
      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.['User-Agent']).toContain('Tino');
      return new Response(JSON.stringify(mockData), { status: 200 });
    });
    const result = await searchEdgarFilings('Apple', undefined, '10-K');
    expect(result.total.value).toBe(42);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]!._source.entity_name).toBe('Apple Inc.');
  });

  test('getEdgarCompanyFacts pads CIK to 10 digits', async () => {
    const mockData = { cik: 320193, entityName: 'Apple Inc.', facts: {} };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('CIK0000320193.json');
      return new Response(JSON.stringify(mockData), { status: 200 });
    });
    const result = await getEdgarCompanyFacts(320193);
    expect(result.entityName).toBe('Apple Inc.');
  });

  test('getEdgarSubmissions returns filing history', async () => {
    const mockData = { cik: '0000320193', entityType: 'operating', name: 'Apple Inc.', tickers: ['AAPL'], exchanges: ['Nasdaq'], filings: { recent: { accessionNumber: ['0000320193-24-000123'], filingDate: ['2024-11-01'], reportDate: ['2024-09-28'], form: ['10-K'], primaryDocument: ['aapl-20240928.htm'], primaryDocDescription: ['10-K'] } } };
    mockFetch(async () => new Response(JSON.stringify(mockData), { status: 200 }));
    const result = await getEdgarSubmissions('320193');
    expect(result.name).toBe('Apple Inc.');
    expect(result.tickers).toContain('AAPL');
  });
});

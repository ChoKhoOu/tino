import { describe, test, expect, afterEach } from 'bun:test';
import type { ToolContext } from '@/domain/index.js';
import plugin from '../filings.tool.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

const ctx: ToolContext = {
  signal: new AbortController().signal,
  onProgress: () => {},
  config: {},
};

describe('filings consolidated tool', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('has correct id, domain, and riskLevel', () => {
    expect(plugin.id).toBe('filings');
    expect(plugin.domain).toBe('finance');
    expect(plugin.riskLevel).toBe('safe');
  });

  test('search calls EDGAR full-text search API', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('efts.sec.gov');
      expect(u).toContain('search-index');
      expect(u).toContain('q=Tesla');
      return new Response(JSON.stringify({ hits: { hits: [{ _source: { file_date: '2024-01-01' } }] } }), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'search', query: 'Tesla' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('search passes dateRange and formType filters', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('efts.sec.gov');
      expect(u).toContain('dateRange=2023-01-01%2C2024-01-01');
      expect(u).toContain('forms=10-K');
      return new Response(JSON.stringify({ hits: { hits: [] } }), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({
      action: 'search',
      query: 'Apple',
      dateRange: '2023-01-01,2024-01-01',
      formType: '10-K',
    }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('search returns error when query is missing', async () => {
    const result = JSON.parse(await plugin.execute({ action: 'search' }, ctx));
    expect(result.error).toContain('query');
  });

  test('submissions calls EDGAR submissions API with padded CIK', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('data.sec.gov');
      expect(u).toContain('submissions/CIK0000320193.json');
      return new Response(JSON.stringify({ cik: '320193', name: 'Apple Inc.' }), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'submissions', ticker: '320193' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('submissions returns error when ticker/cik is missing', async () => {
    const result = JSON.parse(await plugin.execute({ action: 'submissions' }, ctx));
    expect(result.error).toContain('ticker');
  });

  test('company_facts calls EDGAR XBRL API with padded CIK', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('data.sec.gov');
      expect(u).toContain('companyfacts/CIK0000320193.json');
      return new Response(JSON.stringify({ cik: 320193, entityName: 'Apple Inc.', facts: {} }), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'company_facts', ticker: '320193' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('company_facts returns error when ticker/cik is missing', async () => {
    const result = JSON.parse(await plugin.execute({ action: 'company_facts' }, ctx));
    expect(result.error).toContain('ticker');
  });

  test('returns error on API failure', async () => {
    mockFetch(async () => {
      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'search', query: 'test' }, ctx));
    expect(result.error).toBeTruthy();
  });
});

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import type { ToolContext } from '@/domain/index.js';
import plugin from '../web-search.tool.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

const ctx: ToolContext = {
  signal: new AbortController().signal,
  onProgress: () => {},
  config: {},
};

describe('web_search consolidated tool', () => {
  const originalFetch = globalThis.fetch;
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...ORIGINAL_ENV };
  });

  test('has correct id, domain, and riskLevel', () => {
    expect(plugin.id).toBe('web_search');
    expect(plugin.domain).toBe('search');
    expect(plugin.riskLevel).toBe('safe');
  });

  describe('auto provider selection', () => {
    test('uses exa when EXASEARCH_API_KEY is set', async () => {
      process.env.EXASEARCH_API_KEY = 'test-exa-key';
      delete process.env.TAVILY_API_KEY;

      mockFetch(async (url) => {
        const u = typeof url === 'string' ? url : url.toString();
        expect(u).toContain('api.exa.ai');
        return new Response(JSON.stringify({
          results: [{ title: 'Test', url: 'https://example.com', text: 'content' }],
        }), { status: 200 });
      });

      const raw = await plugin.execute({ query: 'test query' }, ctx);
      const result = JSON.parse(raw);
      expect(result.data).toBeTruthy();
    });

    test('uses tavily when only TAVILY_API_KEY is set', async () => {
      delete process.env.EXASEARCH_API_KEY;
      process.env.TAVILY_API_KEY = 'test-tavily-key';

      mockFetch(async (url) => {
        const u = typeof url === 'string' ? url : url.toString();
        expect(u).toContain('api.tavily.com');
        return new Response(JSON.stringify({
          results: [{ title: 'Test', url: 'https://example.com', content: 'content', score: 0.9 }],
          query: 'test query',
        }), { status: 200 });
      });

      const raw = await plugin.execute({ query: 'test query' }, ctx);
      const result = JSON.parse(raw);
      expect(result.data).toBeTruthy();
    });

    test('returns error when no API keys are set', async () => {
      delete process.env.EXASEARCH_API_KEY;
      delete process.env.TAVILY_API_KEY;

      const raw = await plugin.execute({ query: 'test query' }, ctx);
      const result = JSON.parse(raw);
      expect(result.error || (result.data && result.data.error)).toBeTruthy();
    });
  });

  describe('explicit provider selection', () => {
    test('uses exa when provider=exa', async () => {
      process.env.EXASEARCH_API_KEY = 'test-exa-key';

      mockFetch(async (url) => {
        const u = typeof url === 'string' ? url : url.toString();
        expect(u).toContain('api.exa.ai');
        return new Response(JSON.stringify({
          results: [{ title: 'Exa Result', url: 'https://exa.com', text: 'exa content' }],
        }), { status: 200 });
      });

      const raw = await plugin.execute({ query: 'test', provider: 'exa' }, ctx);
      const result = JSON.parse(raw);
      expect(result.data).toBeTruthy();
    });

    test('uses tavily when provider=tavily', async () => {
      process.env.TAVILY_API_KEY = 'test-tavily-key';

      mockFetch(async (url) => {
        const u = typeof url === 'string' ? url : url.toString();
        expect(u).toContain('api.tavily.com');
        return new Response(JSON.stringify({
          results: [{ title: 'Tavily Result', url: 'https://tavily.com', content: 'tavily content', score: 0.8 }],
          query: 'test',
        }), { status: 200 });
      });

      const raw = await plugin.execute({ query: 'test', provider: 'tavily' }, ctx);
      const result = JSON.parse(raw);
      expect(result.data).toBeTruthy();
    });

    test('returns error when exa requested but no key', async () => {
      delete process.env.EXASEARCH_API_KEY;

      const raw = await plugin.execute({ query: 'test', provider: 'exa' }, ctx);
      const result = JSON.parse(raw);
      expect(result.error || (result.data && result.data.error)).toBeTruthy();
    });

    test('returns error when tavily requested but no key', async () => {
      delete process.env.TAVILY_API_KEY;

      const raw = await plugin.execute({ query: 'test', provider: 'tavily' }, ctx);
      const result = JSON.parse(raw);
      expect(result.error || (result.data && result.data.error)).toBeTruthy();
    });
  });

  describe('result formatting', () => {
    test('extracts URLs from exa results into sourceUrls', async () => {
      process.env.EXASEARCH_API_KEY = 'test-exa-key';

      mockFetch(async () => new Response(JSON.stringify({
        results: [
          { title: 'A', url: 'https://a.com', text: 'a' },
          { title: 'B', url: 'https://b.com', text: 'b' },
        ],
      }), { status: 200 }));

      const raw = await plugin.execute({ query: 'test', provider: 'exa' }, ctx);
      const result = JSON.parse(raw);
      expect(result.sourceUrls).toContain('https://a.com');
      expect(result.sourceUrls).toContain('https://b.com');
    });

    test('passes max_results to search provider', async () => {
      process.env.TAVILY_API_KEY = 'test-tavily-key';

      mockFetch(async (_url, init) => {
        const body = JSON.parse((init as RequestInit).body as string);
        expect(body.max_results).toBe(3);
        return new Response(JSON.stringify({
          results: [{ title: 'T', url: 'https://t.com', content: 'c', score: 0.5 }],
          query: 'test',
        }), { status: 200 });
      });

      await plugin.execute({ query: 'test', provider: 'tavily', max_results: 3 }, ctx);
    });
  });
});

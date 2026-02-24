import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import type { ToolContext } from '@/domain/index.js';
import plugin from '../fundamentals.tool.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

const ctx: ToolContext = {
  signal: new AbortController().signal,
  onProgress: () => {},
  config: {},
};

describe('fundamentals consolidated tool', () => {
  const originalFetch = globalThis.fetch;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.FINANCIAL_DATASETS_API_KEY = 'test-fd-key';
    process.env.FMP_API_KEY = 'test-fmp-key';
    process.env.FINNHUB_API_KEY = 'test-finnhub-key';
    process.env.TINO_LEGACY_PROVIDERS = 'fmp,finnhub,financialdatasets';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...ORIGINAL_ENV };
  });

  test('has correct id and domain', () => {
    expect(plugin.id).toBe('fundamentals');
    expect(plugin.domain).toBe('finance');
    expect(plugin.riskLevel).toBe('safe');
  });

  test('income_statement calls Financial Datasets API', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('financialdatasets.ai');
      expect(u).toContain('/financials/income-statements/');
      expect(u).toContain('ticker=AAPL');
      return new Response(JSON.stringify({ income_statements: [{ revenue: 100 }] }), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'income_statement', symbol: 'AAPL', period: 'annual', limit: 5 }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('income_statement falls back to FMP when FD key missing', async () => {
    delete process.env.FINANCIAL_DATASETS_API_KEY;
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('financialmodelingprep.com');
      expect(u).toContain('income-statement/AAPL');
      return new Response(JSON.stringify([{ revenue: 200 }]), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'income_statement', symbol: 'AAPL' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('balance_sheet calls Financial Datasets API', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('/financials/balance-sheets/');
      expect(u).toContain('ticker=MSFT');
      return new Response(JSON.stringify({ balance_sheets: [{ totalAssets: 500 }] }), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'balance_sheet', symbol: 'MSFT', period: 'quarterly' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('balance_sheet falls back to FMP when FD key missing', async () => {
    delete process.env.FINANCIAL_DATASETS_API_KEY;
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('financialmodelingprep.com');
      expect(u).toContain('balance-sheet-statement/MSFT');
      return new Response(JSON.stringify([{ totalAssets: 600 }]), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'balance_sheet', symbol: 'MSFT' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('cash_flow calls Financial Datasets API', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('/financials/cash-flow-statements/');
      expect(u).toContain('ticker=GOOG');
      return new Response(JSON.stringify({ cash_flow_statements: [{ operatingCashFlow: 80 }] }), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'cash_flow', symbol: 'GOOG' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('cash_flow falls back to FMP when FD key missing', async () => {
    delete process.env.FINANCIAL_DATASETS_API_KEY;
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('financialmodelingprep.com');
      expect(u).toContain('cash-flow-statement/GOOG');
      return new Response(JSON.stringify([{ operatingCashFlow: 90 }]), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'cash_flow', symbol: 'GOOG' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('ratios calls Financial Datasets API', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('/financial-metrics/');
      expect(u).toContain('ticker=AAPL');
      return new Response(JSON.stringify({ financial_metrics: [{ pe_ratio: 25 }] }), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'ratios', symbol: 'AAPL', period: 'annual' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('ratios falls back to FMP when FD key missing', async () => {
    delete process.env.FINANCIAL_DATASETS_API_KEY;
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('financialmodelingprep.com');
      expect(u).toContain('ratios/AAPL');
      return new Response(JSON.stringify([{ peRatio: 26 }]), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'ratios', symbol: 'AAPL' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('company_facts calls Financial Datasets API', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('/company/facts');
      expect(u).toContain('ticker=TSLA');
      return new Response(JSON.stringify({ company_facts: { name: 'Tesla' } }), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'company_facts', symbol: 'TSLA' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('analyst_estimates calls Financial Datasets API', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('/analyst-estimates/');
      expect(u).toContain('ticker=NVDA');
      return new Response(JSON.stringify({ analyst_estimates: [{ eps: 5.5 }] }), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'analyst_estimates', symbol: 'NVDA', period: 'quarterly' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('insider_trades calls Financial Datasets API', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('financialdatasets.ai');
      expect(u).toContain('/insider-trades/');
      expect(u).toContain('ticker=AAPL');
      return new Response(JSON.stringify({ insider_trades: [{ shares: 1000 }] }), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'insider_trades', symbol: 'AAPL' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('insider_trades falls back to FMP then Finnhub', async () => {
    delete process.env.FINANCIAL_DATASETS_API_KEY;
    delete process.env.FMP_API_KEY;
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('finnhub.io');
      expect(u).toContain('insider-transactions');
      return new Response(JSON.stringify({ data: [{ name: 'CEO' }] }), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'insider_trades', symbol: 'AAPL' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('news calls Financial Datasets API', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('financialdatasets.ai');
      expect(u).toContain('/news/');
      expect(u).toContain('ticker=AMZN');
      return new Response(JSON.stringify({ news: [{ title: 'Amazon earnings' }] }), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'news', symbol: 'AMZN' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('news falls back to Finnhub when FD key missing', async () => {
    delete process.env.FINANCIAL_DATASETS_API_KEY;
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('finnhub.io');
      expect(u).toContain('company-news');
      return new Response(JSON.stringify([{ headline: 'News' }]), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'news', symbol: 'AMZN' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('all_financials calls Financial Datasets API', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('/financials/');
      expect(u).toContain('ticker=META');
      return new Response(JSON.stringify({ financials: [{ revenue: 300 }] }), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'all_financials', symbol: 'META', period: 'annual' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('deep_dive dcf routes to FMP', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('financialmodelingprep.com');
      expect(u).toContain('discounted-cash-flow/AAPL');
      return new Response(JSON.stringify([{ dcf: 250 }]), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'deep_dive', symbol: 'AAPL', metric: 'dcf' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('deep_dive earnings_transcripts routes to FMP', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('financialmodelingprep.com');
      expect(u).toContain('earning_call_transcript/AAPL');
      return new Response(JSON.stringify([{ content: 'transcript' }]), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'deep_dive', symbol: 'AAPL', metric: 'earnings_transcripts', year: 2024, quarter: 3 }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('deep_dive segmented_revenues routes to Financial Datasets', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('financialdatasets.ai');
      expect(u).toContain('/financials/segmented-revenues/');
      return new Response(JSON.stringify({ segmented_revenues: [{ segment: 'iPhone' }] }), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'deep_dive', symbol: 'AAPL', metric: 'segmented_revenues' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('deep_dive key_metrics routes to FMP', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('financialmodelingprep.com');
      expect(u).toContain('key-metrics/AAPL');
      return new Response(JSON.stringify([{ revenuePerShare: 25 }]), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'deep_dive', symbol: 'AAPL', metric: 'key_metrics' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('deep_dive sentiment routes to Finnhub', async () => {
    mockFetch(async (url) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toContain('finnhub.io');
      expect(u).toContain('social-sentiment');
      return new Response(JSON.stringify({ reddit: [], twitter: [] }), { status: 200 });
    });

    const result = JSON.parse(await plugin.execute({ action: 'deep_dive', symbol: 'AAPL', metric: 'sentiment' }, ctx));
    expect(result.data).toBeTruthy();
  });

  test('returns error when symbol is missing for actions that require it', async () => {
    const result = JSON.parse(await plugin.execute({ action: 'income_statement' }, ctx));
    expect(result.error).toContain('symbol');
  });

  test('returns error when metric is missing for deep_dive', async () => {
    const result = JSON.parse(await plugin.execute({ action: 'deep_dive', symbol: 'AAPL' }, ctx));
    expect(result.error).toContain('metric');
  });

  test('returns helpful error when no API keys are available', async () => {
    delete process.env.FINANCIAL_DATASETS_API_KEY;
    delete process.env.FMP_API_KEY;
    const result = JSON.parse(await plugin.execute({ action: 'income_statement', symbol: 'AAPL' }, ctx));
    expect(result.error).toBeTruthy();
  });

  test('returns error when legacy providers are not enabled', async () => {
    delete process.env.TINO_LEGACY_PROVIDERS;
    const result = JSON.parse(await plugin.execute({ action: 'income_statement', symbol: 'AAPL' }, ctx));
    expect(result.error).toContain('opt-in');
  });
});

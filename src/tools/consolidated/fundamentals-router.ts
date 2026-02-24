import { getOptionalApiKey } from '../finance/shared.js';
import { getSetting } from '../../config/settings.js';

type Params = Record<string, string | number | undefined>;

const fmt = (obj: unknown) => JSON.stringify(obj);

function fdParams(symbol: string, opts: { period?: string; limit?: number; start_date?: string; end_date?: string }): Params {
  return { ticker: symbol, period: opts.period, limit: opts.limit, report_period_gte: opts.start_date, report_period_lte: opts.end_date };
}

function isLegacyEnabled(provider: string): boolean {
  // Env var override: TINO_LEGACY_PROVIDERS=fmp,finnhub,financialdatasets
  const envOverride = process.env.TINO_LEGACY_PROVIDERS;
  if (envOverride !== undefined) {
    return envOverride.split(',').map(s => s.trim()).includes(provider);
  }
  const raw = getSetting<string[] | undefined>('enabledLegacyProviders', undefined);
  return Array.isArray(raw) && raw.includes(provider);
}

function hasFdKey(): boolean { return isLegacyEnabled('financialdatasets') && !!getOptionalApiKey('FINANCIAL_DATASETS_API_KEY'); }
function hasFmpKey(): boolean { return isLegacyEnabled('fmp') && !!getOptionalApiKey('FMP_API_KEY'); }
function hasFinnhubKey(): boolean { return isLegacyEnabled('finnhub') && !!getOptionalApiKey('FINNHUB_API_KEY'); }

const LEGACY_HINT = 'These providers require opt-in via enabledLegacyProviders in .tino/settings.json with the corresponding API key in .env.';

async function fdStatement(endpoint: string, responseKey: string, symbol: string, opts: { period?: string; limit?: number; start_date?: string; end_date?: string }): Promise<string> {
  const { callApi } = await import('../finance/api.js');
  const { data, url } = await callApi(endpoint, fdParams(symbol, opts));
  return fmt({ data: data[responseKey] || data, sourceUrls: [url] });
}

type FmpStatementFn = 'getFmpIncomeStatement' | 'getFmpBalanceSheet' | 'getFmpCashFlow';

async function withStatementFallback(
  endpoint: string, responseKey: string,
  fmpFnName: FmpStatementFn,
  symbol: string, opts: { period?: string; limit?: number; start_date?: string; end_date?: string },
): Promise<string> {
  if (hasFdKey()) return fdStatement(endpoint, responseKey, symbol, opts);
  if (hasFmpKey()) {
    const fmp = await import('../finance/fmp/index.js');
    return fmt({ data: await fmp[fmpFnName](symbol, (opts.period as 'annual' | 'quarterly') ?? 'annual', opts.limit ?? 10) });
  }
  return fmt({ error: `No provider available. ${LEGACY_HINT}` });
}

function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function thirtyDaysAgoStr(): string { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); }

export interface FundamentalsInput {
  action: string;
  symbol?: string;
  period?: string;
  limit?: number;
  start_date?: string;
  end_date?: string;
  metric?: string;
  year?: number;
  quarter?: number;
}

export async function routeFundamentals(input: FundamentalsInput): Promise<string> {
  const { action, symbol, period, limit, start_date, end_date, metric, year, quarter } = input;
  const opts = { period, limit, start_date, end_date };

  if (action !== 'deep_dive' && !symbol) return fmt({ error: 'symbol is required for this action' });
  if (action === 'deep_dive' && !symbol) return fmt({ error: 'symbol is required for deep_dive' });

  const sym = symbol!;

  switch (action) {
    case 'income_statement':
      return withStatementFallback('/financials/income-statements/', 'income_statements', 'getFmpIncomeStatement', sym, opts);
    case 'balance_sheet':
      return withStatementFallback('/financials/balance-sheets/', 'balance_sheets', 'getFmpBalanceSheet', sym, opts);
    case 'cash_flow':
      return withStatementFallback('/financials/cash-flow-statements/', 'cash_flow_statements', 'getFmpCashFlow', sym, opts);
    case 'ratios':
      if (hasFdKey()) return fdStatement('/financial-metrics/', 'financial_metrics', sym, opts);
      if (hasFmpKey()) {
        const { getFmpRatios } = await import('../finance/fmp/index.js');
        return fmt({ data: await getFmpRatios(sym, (period as 'annual' | 'quarterly') ?? 'annual', limit ?? 10) });
      }
      return fmt({ error: `No provider available. ${LEGACY_HINT}` });
    case 'company_facts': {
      if (!hasFdKey()) return fmt({ error: `company_facts requires FinancialDatasets. ${LEGACY_HINT}` });
      const { callApi } = await import('../finance/api.js');
      const { data, url } = await callApi('/company/facts', { ticker: sym });
      return fmt({ data: data.company_facts || data, sourceUrls: [url] });
    }
    case 'analyst_estimates': {
      if (!hasFdKey()) return fmt({ error: `analyst_estimates requires FinancialDatasets. ${LEGACY_HINT}` });
      const { callApi } = await import('../finance/api.js');
      const { data, url } = await callApi('/analyst-estimates/', { ticker: sym, period });
      return fmt({ data: data.analyst_estimates || data, sourceUrls: [url] });
    }
    case 'insider_trades':
      return routeInsiderTrades(sym, limit);
    case 'news':
      return routeNews(sym, limit, start_date, end_date);
    case 'all_financials': {
      if (!hasFdKey()) return fmt({ error: `all_financials requires FinancialDatasets. ${LEGACY_HINT}` });
      const { callApi } = await import('../finance/api.js');
      const { data, url } = await callApi('/financials/', fdParams(sym, opts));
      return fmt({ data: data.financials || data, sourceUrls: [url] });
    }
    case 'deep_dive':
      return routeDeepDive(sym, metric, { period, limit, year, quarter });
    default:
      return fmt({ error: `Unknown action: ${action}` });
  }
}

async function routeInsiderTrades(symbol: string, limit?: number): Promise<string> {
  if (hasFdKey()) {
    const { callApi } = await import('../finance/api.js');
    const { data, url } = await callApi('/insider-trades/', { ticker: symbol, limit });
    return fmt({ data: data.insider_trades || data, sourceUrls: [url] });
  }
  if (hasFmpKey()) {
    const { getFmpInsiderTrades } = await import('../finance/fmp/index.js');
    return fmt({ data: await getFmpInsiderTrades(symbol, limit ?? 50) });
  }
  if (hasFinnhubKey()) {
    const { getFinnhubInsiderTransactions } = await import('../finance/finnhub/index.js');
    return fmt({ data: await getFinnhubInsiderTransactions(symbol) });
  }
  return fmt({ error: `No provider available. ${LEGACY_HINT}` });
}

async function routeNews(symbol: string, limit?: number, start_date?: string, end_date?: string): Promise<string> {
  if (hasFdKey()) {
    const { callApi } = await import('../finance/api.js');
    const { data, url } = await callApi('/news/', { ticker: symbol, limit, start_date, end_date });
    return fmt({ data: data.news || data, sourceUrls: [url] });
  }
  if (hasFinnhubKey()) {
    const { getFinnhubCompanyNews } = await import('../finance/finnhub/index.js');
    const from = start_date ?? thirtyDaysAgoStr();
    const to = end_date ?? todayStr();
    return fmt({ data: await getFinnhubCompanyNews(symbol, from, to) });
  }
  return fmt({ error: `No provider available. ${LEGACY_HINT}` });
}

async function routeDeepDive(symbol: string, metric: string | undefined, opts: { period?: string; limit?: number; year?: number; quarter?: number }): Promise<string> {
  if (!metric) return fmt({ error: 'metric is required for deep_dive action (dcf, earnings_transcripts, segmented_revenues, key_metrics, sentiment)' });
  switch (metric) {
    case 'dcf': {
      if (!hasFmpKey()) return fmt({ error: `dcf requires FMP. ${LEGACY_HINT}` });
      const { getFmpDcf } = await import('../finance/fmp/index.js');
      return fmt({ data: await getFmpDcf(symbol) });
    }
    case 'earnings_transcripts': {
      if (!hasFmpKey()) return fmt({ error: `earnings_transcripts requires FMP. ${LEGACY_HINT}` });
      const { getFmpEarningsTranscripts } = await import('../finance/fmp/index.js');
      return fmt({ data: await getFmpEarningsTranscripts(symbol, opts.year ?? new Date().getFullYear(), opts.quarter ?? 1) });
    }
    case 'segmented_revenues': {
      if (!hasFdKey()) return fmt({ error: `segmented_revenues requires FinancialDatasets. ${LEGACY_HINT}` });
      const { callApi } = await import('../finance/api.js');
      const { data, url } = await callApi('/financials/segmented-revenues/', { ticker: symbol, period: opts.period, limit: opts.limit });
      return fmt({ data: data.segmented_revenues || data, sourceUrls: [url] });
    }
    case 'key_metrics': {
      if (!hasFmpKey()) return fmt({ error: `key_metrics requires FMP. ${LEGACY_HINT}` });
      const { getFmpKeyMetrics } = await import('../finance/fmp/index.js');
      return fmt({ data: await getFmpKeyMetrics(symbol, (opts.period as 'annual' | 'quarterly') ?? 'annual', opts.limit ?? 10) });
    }
    case 'sentiment': {
      if (!hasFinnhubKey()) return fmt({ error: `sentiment requires Finnhub. ${LEGACY_HINT}` });
      const { getFinnhubSentiment } = await import('../finance/finnhub/index.js');
      return fmt({ data: await getFinnhubSentiment(symbol) });
    }
    default:
      return fmt({ error: `Unknown metric: ${metric}` });
  }
}

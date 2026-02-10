import { callApi } from '../finance/api.js';
import { getOptionalApiKey } from '../finance/shared.js';
import {
  getFmpIncomeStatement, getFmpBalanceSheet, getFmpCashFlow,
  getFmpRatios, getFmpKeyMetrics, getFmpDcf,
  getFmpInsiderTrades, getFmpEarningsTranscripts,
} from '../finance/fmp/index.js';
import {
  getFinnhubCompanyNews, getFinnhubSentiment, getFinnhubInsiderTransactions,
} from '../finance/finnhub/index.js';

type Params = Record<string, string | number | undefined>;

const fmt = (obj: unknown) => JSON.stringify(obj);

function fdParams(symbol: string, opts: { period?: string; limit?: number; start_date?: string; end_date?: string }): Params {
  return { ticker: symbol, period: opts.period, limit: opts.limit, report_period_gte: opts.start_date, report_period_lte: opts.end_date };
}

function hasFdKey(): boolean { return !!getOptionalApiKey('FINANCIAL_DATASETS_API_KEY'); }
function hasFmpKey(): boolean { return !!getOptionalApiKey('FMP_API_KEY'); }
function hasFinnhubKey(): boolean { return !!getOptionalApiKey('FINNHUB_API_KEY'); }

async function fdStatement(endpoint: string, responseKey: string, symbol: string, opts: { period?: string; limit?: number; start_date?: string; end_date?: string }): Promise<string> {
  const { data, url } = await callApi(endpoint, fdParams(symbol, opts));
  return fmt({ data: data[responseKey] || data, sourceUrls: [url] });
}

async function withStatementFallback(
  endpoint: string, responseKey: string,
  fmpFn: (t: string, p?: 'annual' | 'quarterly', l?: number) => Promise<unknown>,
  symbol: string, opts: { period?: string; limit?: number; start_date?: string; end_date?: string },
): Promise<string> {
  if (hasFdKey()) return fdStatement(endpoint, responseKey, symbol, opts);
  if (hasFmpKey()) return fmt({ data: await fmpFn(symbol, (opts.period as 'annual' | 'quarterly') ?? 'annual', opts.limit ?? 10) });
  return fmt({ error: 'No API key available. Set FINANCIAL_DATASETS_API_KEY or FMP_API_KEY in your .env file.' });
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
      return withStatementFallback('/financials/income-statements/', 'income_statements', getFmpIncomeStatement, sym, opts);
    case 'balance_sheet':
      return withStatementFallback('/financials/balance-sheets/', 'balance_sheets', getFmpBalanceSheet, sym, opts);
    case 'cash_flow':
      return withStatementFallback('/financials/cash-flow-statements/', 'cash_flow_statements', getFmpCashFlow, sym, opts);
    case 'ratios':
      if (hasFdKey()) return fdStatement('/financial-metrics/', 'financial_metrics', sym, opts);
      if (hasFmpKey()) return fmt({ data: await getFmpRatios(sym, (period as 'annual' | 'quarterly') ?? 'annual', limit ?? 10) });
      return fmt({ error: 'No API key available. Set FINANCIAL_DATASETS_API_KEY or FMP_API_KEY in your .env file.' });
    case 'company_facts': {
      const { data, url } = await callApi('/company/facts', { ticker: sym });
      return fmt({ data: data.company_facts || data, sourceUrls: [url] });
    }
    case 'analyst_estimates': {
      const { data, url } = await callApi('/analyst-estimates/', { ticker: sym, period });
      return fmt({ data: data.analyst_estimates || data, sourceUrls: [url] });
    }
    case 'insider_trades':
      return routeInsiderTrades(sym, limit);
    case 'news':
      return routeNews(sym, limit, start_date, end_date);
    case 'all_financials': {
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
    const { data, url } = await callApi('/insider-trades/', { ticker: symbol, limit });
    return fmt({ data: data.insider_trades || data, sourceUrls: [url] });
  }
  if (hasFmpKey()) return fmt({ data: await getFmpInsiderTrades(symbol, limit ?? 50) });
  if (hasFinnhubKey()) return fmt({ data: await getFinnhubInsiderTransactions(symbol) });
  return fmt({ error: 'No API key available. Set FINANCIAL_DATASETS_API_KEY, FMP_API_KEY, or FINNHUB_API_KEY.' });
}

async function routeNews(symbol: string, limit?: number, start_date?: string, end_date?: string): Promise<string> {
  if (hasFdKey()) {
    const { data, url } = await callApi('/news/', { ticker: symbol, limit, start_date, end_date });
    return fmt({ data: data.news || data, sourceUrls: [url] });
  }
  if (hasFinnhubKey()) {
    const from = start_date ?? thirtyDaysAgoStr();
    const to = end_date ?? todayStr();
    return fmt({ data: await getFinnhubCompanyNews(symbol, from, to) });
  }
  return fmt({ error: 'No API key available. Set FINANCIAL_DATASETS_API_KEY or FINNHUB_API_KEY.' });
}

async function routeDeepDive(symbol: string, metric: string | undefined, opts: { period?: string; limit?: number; year?: number; quarter?: number }): Promise<string> {
  if (!metric) return fmt({ error: 'metric is required for deep_dive action (dcf, earnings_transcripts, segmented_revenues, key_metrics, sentiment)' });
  switch (metric) {
    case 'dcf':
      return fmt({ data: await getFmpDcf(symbol) });
    case 'earnings_transcripts':
      return fmt({ data: await getFmpEarningsTranscripts(symbol, opts.year ?? new Date().getFullYear(), opts.quarter ?? 1) });
    case 'segmented_revenues': {
      const { data, url } = await callApi('/financials/segmented-revenues/', { ticker: symbol, period: opts.period, limit: opts.limit });
      return fmt({ data: data.segmented_revenues || data, sourceUrls: [url] });
    }
    case 'key_metrics':
      return fmt({ data: await getFmpKeyMetrics(symbol, (opts.period as 'annual' | 'quarterly') ?? 'annual', opts.limit ?? 10) });
    case 'sentiment':
      return fmt({ data: await getFinnhubSentiment(symbol) });
    default:
      return fmt({ error: `Unknown metric: ${metric}` });
  }
}

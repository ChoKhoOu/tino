import { getOptionalApiKey, isLegacyEnabled, LEGACY_HINT } from '../finance/shared.js';
import {
  getPolygonBars,
  getPolygonSnapshot,
  getPolygonTicker,
  getPolygonOptionsChain,
} from '../finance/polygon/index.js';
import {
  getCoinPrice,
  getCoinMarketData,
  getCoinHistory,
  getTopCoins,
} from '../finance/coingecko/index.js';
import {
  getCurrentFundingRates,
  getHistoricalFundingRates,
} from '../finance/funding-rates/index.js';
import type { MarketDataInput } from './market-data.tool.js';

function requireSymbol(symbol: string | undefined): string {
  if (!symbol) throw new Error('symbol is required for this action');
  return symbol;
}

function fmt(data: unknown): string {
  return JSON.stringify({ data });
}

function fmtError(message: string): string {
  return JSON.stringify({ error: message });
}


async function handlePrices(input: MarketDataInput): Promise<string> {
  const ticker = requireSymbol(input.symbol);
  const from = input.from ?? '';
  const to = input.to ?? '';

  if (isLegacyEnabled('financialdatasets') && getOptionalApiKey('FINANCIAL_DATASETS_API_KEY')) {
    const { callApi } = await import('../finance/api.js');
    const { data } = await callApi('/prices/', { ticker, start_date: from, end_date: to });
    return fmt(data);
  }

  if (isLegacyEnabled('fmp') && getOptionalApiKey('FMP_API_KEY')) {
    const { getFmpPrices } = await import('../finance/fmp/index.js');
    const data = await getFmpPrices(ticker, from || undefined, to || undefined);
    return fmt(data);
  }

  return fmtError(`No provider available for prices. ${LEGACY_HINT}`);
}

function dateToUnix(dateStr: string): number {
  return Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / 1000);
}

export async function routeMarketData(input: MarketDataInput): Promise<string> {
  try {
    switch (input.action) {
      case 'prices':
        return handlePrices(input);

      case 'bars': {
        const ticker = requireSymbol(input.symbol);
        const data = await getPolygonBars(
          ticker,
          input.timespan ?? 'day',
          input.from ?? '',
          input.to ?? '',
          input.multiplier ?? 1,
        );
        return fmt(data);
      }

      case 'snapshot': {
        const ticker = requireSymbol(input.symbol);
        const data = await getPolygonSnapshot(ticker);
        return fmt(data);
      }

      case 'options_chain': {
        const ticker = requireSymbol(input.symbol);
        const data = await getPolygonOptionsChain(ticker, input.expiration_date);
        return fmt(data);
      }

      case 'ticker_details': {
        const ticker = requireSymbol(input.symbol);
        const data = await getPolygonTicker(ticker);
        return fmt(data);
      }

      case 'crypto_price': {
        const coinId = requireSymbol(input.symbol);
        const data = await getCoinPrice(coinId, input.vs_currency ?? 'usd');
        return fmt(data);
      }

      case 'crypto_market_data': {
        const coinId = requireSymbol(input.symbol);
        const data = await getCoinMarketData(coinId);
        return fmt(data);
      }

      case 'crypto_top_coins': {
        const data = await getTopCoins(input.limit ?? 20, input.vs_currency ?? 'usd');
        return fmt(data);
      }

      case 'crypto_history': {
        const coinId = requireSymbol(input.symbol);
        const from = dateToUnix(input.from ?? '');
        const to = dateToUnix(input.to ?? '');
        const data = await getCoinHistory(coinId, from, to);
        return fmt(data);
      }

      case 'funding_rates': {
        const symbols = input.symbol ? input.symbol.split(',').map(s => s.trim()) : undefined;
        const data = await getCurrentFundingRates(symbols);
        return fmt(data);
      }

      case 'funding_rates_history': {
        const symbol = requireSymbol(input.symbol);
        const from = input.from ? new Date(input.from + 'T00:00:00Z').getTime() : Date.now() - 30 * 86400_000;
        const to = input.to ? new Date(input.to + 'T00:00:00Z').getTime() : Date.now();
        const data = await getHistoricalFundingRates(symbol, from, to);
        return fmt(data);
      }

      default:
        return fmtError(`Unknown action: ${input.action}`);
    }
  } catch (err) {
    return fmtError(err instanceof Error ? err.message : String(err));
  }
}

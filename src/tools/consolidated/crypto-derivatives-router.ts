import {
  getFundingRates,
  getFundingRateHistory,
  getOpenInterest,
  getOpenInterestHistory,
  getLongShortRatio,
  getLiquidations,
  getLiquidationHistory,
  getFuturesPremium,
} from '../finance/coinglass/index.js';
import type { CryptoDerivativesInput } from './crypto-derivatives.tool.js';

function fmt(data: unknown): string {
  return JSON.stringify({ data });
}

function fmtError(message: string): string {
  return JSON.stringify({ error: message });
}

export async function routeCryptoDerivatives(input: CryptoDerivativesInput): Promise<string> {
  try {
    switch (input.action) {
      case 'funding_rates': {
        const data = await getFundingRates(input.symbol ?? 'BTC');
        return fmt(data);
      }

      case 'funding_rate_history': {
        const exchange = input.exchange;
        if (!exchange) return fmtError('exchange is required for funding_rate_history');
        const symbol = input.symbol;
        if (!symbol) return fmtError('symbol is required for funding_rate_history');
        const data = await getFundingRateHistory(
          exchange,
          symbol,
          input.interval ?? '1d',
          input.limit ?? 500,
        );
        return fmt(data);
      }

      case 'open_interest': {
        const data = await getOpenInterest(input.symbol ?? 'BTC');
        return fmt(data);
      }

      case 'open_interest_history': {
        const exchange = input.exchange;
        if (!exchange) return fmtError('exchange is required for open_interest_history');
        const symbol = input.symbol;
        if (!symbol) return fmtError('symbol is required for open_interest_history');
        const data = await getOpenInterestHistory(
          exchange,
          symbol,
          input.interval ?? '1d',
          input.limit ?? 500,
        );
        return fmt(data);
      }

      case 'long_short_ratio': {
        const exchange = input.exchange;
        if (!exchange) return fmtError('exchange is required for long_short_ratio');
        const symbol = input.symbol;
        if (!symbol) return fmtError('symbol is required for long_short_ratio');
        const data = await getLongShortRatio(
          exchange,
          symbol,
          input.interval ?? '1d',
          input.limit ?? 500,
        );
        return fmt(data);
      }

      case 'liquidations': {
        const data = await getLiquidations(
          input.symbol ?? 'BTC',
          input.range ?? '24h',
        );
        return fmt(data);
      }

      case 'liquidation_history': {
        const symbol = input.symbol;
        if (!symbol) return fmtError('symbol is required for liquidation_history');
        const data = await getLiquidationHistory(
          symbol,
          input.interval ?? '1d',
          input.limit ?? 500,
        );
        return fmt(data);
      }

      case 'futures_premium': {
        const symbol = input.symbol;
        if (!symbol) return fmtError('symbol is required for futures_premium');
        const data = await getFuturesPremium(
          symbol,
          input.interval ?? '1d',
          input.limit ?? 500,
        );
        return fmt(data);
      }

      default:
        return fmtError(`Unknown action: ${input.action}`);
    }
  } catch (err) {
    return fmtError(err instanceof Error ? err.message : String(err));
  }
}

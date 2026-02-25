import {
  findArbitrageOpportunities,
  scanMultiExchangeRates,
  backtestArbitrage,
  analyzeOpportunity,
} from '../finance/funding-rate-arbitrage/index.js';
import type { FundingRateArbitrageInput } from './funding-rate-arbitrage.tool.js';

function fmt(data: unknown): string {
  return JSON.stringify({ data });
}

function fmtError(message: string): string {
  return JSON.stringify({ error: message });
}

export async function routeFundingRateArbitrage(input: FundingRateArbitrageInput): Promise<string> {
  try {
    switch (input.action) {
      case 'scan_rates': {
        const ratesBySymbol = await scanMultiExchangeRates(input.symbols);
        // Convert Map to plain object for JSON serialization
        const result: Record<string, unknown> = {};
        for (const [symbol, rates] of ratesBySymbol) {
          result[symbol] = rates;
        }
        return fmt(result);
      }

      case 'find_opportunities': {
        const opportunities = await findArbitrageOpportunities(
          input.symbols,
          input.top_n ?? 10,
        );
        return fmt(opportunities);
      }

      case 'backtest': {
        const symbol = input.symbol;
        if (!symbol) return fmtError('symbol is required for backtest');
        const longExchange = input.exchange_long;
        if (!longExchange) return fmtError('exchange_long is required for backtest');
        const shortExchange = input.exchange_short;
        if (!shortExchange) return fmtError('exchange_short is required for backtest');

        const result = await backtestArbitrage(
          symbol,
          longExchange,
          shortExchange,
          input.days ?? 30,
        );

        // Omit per-settlement data in the response to keep it concise
        const { settlements: _settlements, ...summary } = result;
        return fmt({
          ...summary,
          settlementCount: result.settlements.length,
          recentSettlements: result.settlements.slice(-10),
        });
      }

      case 'analyze': {
        const symbol = input.symbol;
        if (!symbol) return fmtError('symbol is required for analyze');
        const longExchange = input.exchange_long;
        if (!longExchange) return fmtError('exchange_long is required for analyze');
        const shortExchange = input.exchange_short;
        if (!shortExchange) return fmtError('exchange_short is required for analyze');

        const analysis = await analyzeOpportunity(
          symbol,
          longExchange,
          shortExchange,
          input.days ?? 30,
        );

        // Return the text summary + structured data (without full settlement list)
        const backtestSummary = analysis.backtest
          ? (() => { const { settlements: _s, ...rest } = analysis.backtest; return rest; })()
          : null;

        return fmt({
          summary: analysis.summary,
          currentRates: analysis.currentRates,
          opportunity: analysis.opportunity,
          backtest: backtestSummary,
        });
      }

      default:
        return fmtError(`Unknown action: ${input.action}`);
    }
  } catch (err) {
    return fmtError(err instanceof Error ? err.message : String(err));
  }
}

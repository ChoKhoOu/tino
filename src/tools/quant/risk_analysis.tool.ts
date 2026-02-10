import { z } from 'zod';
import { definePlugin } from '@/domain/tool-plugin.js';
import {
  sharpeRatio,
  sortinoRatio,
  maxDrawdown,
  valueAtRisk,
  conditionalValueAtRisk,
  calmarRatio,
  winRate,
  profitFactor,
} from './risk.js';

const schema = z.object({
  returns: z
    .array(z.number())
    .describe('Array of periodic returns (e.g. daily returns as decimals like 0.01 for 1%)'),
  riskFreeRate: z.number().optional().describe('Annual risk-free rate (default 0)'),
  confidenceLevel: z.number().optional().describe('Confidence level for VaR/CVaR (default 0.95)'),
  periodsPerYear: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Trading periods per year for annualization (default 252)'),
});

export default definePlugin({
  id: 'calculate_risk_metrics',
  domain: 'quant',
  riskLevel: 'safe',
  description:
    'Calculate risk metrics from a return series: Sharpe ratio, Sortino ratio, max drawdown, Value at Risk (VaR), Conditional VaR (CVaR), Calmar ratio, win rate, profit factor. Pure computation, no external API calls.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const { returns, riskFreeRate = 0, confidenceLevel = 0.95, periodsPerYear = 252 } = input;

    const data = {
      sharpeRatio: sharpeRatio(returns, riskFreeRate, periodsPerYear),
      sortinoRatio: sortinoRatio(returns, riskFreeRate, periodsPerYear),
      maxDrawdown: maxDrawdown(returns),
      valueAtRisk: valueAtRisk(returns, confidenceLevel),
      conditionalValueAtRisk: conditionalValueAtRisk(returns, confidenceLevel),
      calmarRatio: calmarRatio(returns, periodsPerYear),
      winRate: winRate(returns),
      profitFactor: profitFactor(returns),
    };

    return JSON.stringify({ data });
  },
});

import type { RiskConfig } from './risk-config.js';

export interface OrderInput {
  venue: string;
  instrument: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
}

export interface RiskState {
  positions: Record<string, number>;
  prices: Record<string, number>;
  dailyPnl: number;
  peakEquity: number;
  currentEquity: number;
  recentOrderTimestamps: number[];
}

export interface RuleResult {
  pass: boolean;
  reason?: string;
}

export function checkMaxPositionSize(
  order: OrderInput,
  state: RiskState,
  config: RiskConfig,
): RuleResult {
  const limit = config.maxPositionSize[order.instrument]
    ?? config.maxPositionSize['*']
    ?? Infinity;

  const current = Math.abs(state.positions[order.instrument] ?? 0);
  const afterTrade = current + order.quantity;

  if (afterTrade > limit) {
    return {
      pass: false,
      reason: `Position size ${afterTrade} exceeds limit ${limit} for ${order.instrument}`,
    };
  }
  return { pass: true };
}

export function checkMaxGrossExposure(
  order: OrderInput,
  state: RiskState,
  config: RiskConfig,
): RuleResult {
  let totalExposure = 0;
  for (const [instrument, qty] of Object.entries(state.positions)) {
    const price = instrument === order.instrument ? order.price : (state.prices[instrument] ?? 0);
    totalExposure += Math.abs(qty) * price;
  }
  const newExposure = totalExposure + order.quantity * order.price;

  if (newExposure > config.maxGrossExposure) {
    return {
      pass: false,
      reason: `Gross exposure ${newExposure.toFixed(2)} USDT exceeds limit ${config.maxGrossExposure} USDT`,
    };
  }
  return { pass: true };
}

export function checkMaxDailyLoss(
  _order: OrderInput,
  state: RiskState,
  config: RiskConfig,
): RuleResult {
  if (state.dailyPnl <= -config.maxDailyLoss) {
    return {
      pass: false,
      reason: `Daily loss ${Math.abs(state.dailyPnl).toFixed(2)} USDT reached limit ${config.maxDailyLoss} USDT`,
    };
  }
  return { pass: true };
}

export function checkMaxDrawdown(
  _order: OrderInput,
  state: RiskState,
  config: RiskConfig,
): RuleResult {
  if (state.peakEquity <= 0) return { pass: true };

  const drawdown = (state.peakEquity - state.currentEquity) / state.peakEquity;

  if (drawdown >= config.maxDrawdown) {
    return {
      pass: false,
      reason: `Drawdown ${(drawdown * 100).toFixed(1)}% reached limit ${(config.maxDrawdown * 100).toFixed(1)}%`,
    };
  }
  return { pass: true };
}

export function checkMaxOrderRate(
  _order: OrderInput,
  state: RiskState,
  config: RiskConfig,
): RuleResult {
  const oneMinuteAgo = Date.now() - 60_000;
  const recentCount = state.recentOrderTimestamps.filter((t) => t > oneMinuteAgo).length;

  if (recentCount >= config.maxOrderRate) {
    return {
      pass: false,
      reason: `Order rate ${recentCount}/min reached limit ${config.maxOrderRate}/min`,
    };
  }
  return { pass: true };
}

export const ALL_RULES = [
  checkMaxPositionSize,
  checkMaxGrossExposure,
  checkMaxDailyLoss,
  checkMaxDrawdown,
  checkMaxOrderRate,
] as const;

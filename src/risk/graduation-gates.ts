import { getSetting } from '@/config/settings.js';

export type GraduationStage = 'backtest_to_paper' | 'paper_to_live' | 'live_to_full';

export interface StageMetrics {
  sharpeRatio?: number;
  maxDrawdown?: number;
  tradeCount?: number;
  paperDays?: number;
  pnlDeviation?: number;
  liveDays?: number;
  riskEventCount?: number;
}

export interface GraduationResult {
  passed: boolean;
  failures: string[];
  warnings: string[];
}

export interface GraduationThresholds {
  backtestSharpe: number;
  backtestMaxDrawdown: number;
  backtestMinTrades: number;
  paperMinDays: number;
  paperPnlDeviation: number;
  liveMinDays: number;
  liveMaxRiskEvents: number;
}

export const DEFAULT_GRADUATION_THRESHOLDS: GraduationThresholds = {
  backtestSharpe: 1.0,
  backtestMaxDrawdown: 0.20,
  backtestMinTrades: 100,
  paperMinDays: 14,
  paperPnlDeviation: 0.30,
  liveMinDays: 28,
  liveMaxRiskEvents: 0,
};

function resolveThresholds(overrides?: Partial<GraduationThresholds>): GraduationThresholds {
  const fromSettings = getSetting<Partial<GraduationThresholds>>('graduationThresholds', {});
  return { ...DEFAULT_GRADUATION_THRESHOLDS, ...fromSettings, ...overrides };
}

const WARNING_MARGIN = 0.15;

function checkBacktestToPaper(metrics: StageMetrics, t: GraduationThresholds): GraduationResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  const sharpe = metrics.sharpeRatio ?? 0;
  if (sharpe <= t.backtestSharpe) {
    failures.push(`Sharpe ratio ${sharpe.toFixed(2)} does not exceed ${t.backtestSharpe}`);
  } else if (sharpe < t.backtestSharpe * (1 + WARNING_MARGIN)) {
    warnings.push(`Sharpe ratio ${sharpe.toFixed(2)} is close to minimum ${t.backtestSharpe}`);
  }

  const dd = metrics.maxDrawdown ?? 1;
  if (dd >= t.backtestMaxDrawdown) {
    failures.push(`Max drawdown ${(dd * 100).toFixed(1)}% is not below ${(t.backtestMaxDrawdown * 100).toFixed(0)}%`);
  } else if (dd > t.backtestMaxDrawdown * (1 - WARNING_MARGIN)) {
    warnings.push(`Max drawdown ${(dd * 100).toFixed(1)}% is close to limit ${(t.backtestMaxDrawdown * 100).toFixed(0)}%`);
  }

  const trades = metrics.tradeCount ?? 0;
  if (trades <= t.backtestMinTrades) {
    failures.push(`Trade count ${trades} does not exceed ${t.backtestMinTrades}`);
  }

  return { passed: failures.length === 0, failures, warnings };
}

function checkPaperToLive(metrics: StageMetrics, t: GraduationThresholds): GraduationResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  const days = metrics.paperDays ?? 0;
  if (days < t.paperMinDays) {
    failures.push(`Paper trading duration ${days}d is below minimum ${t.paperMinDays}d`);
  }

  const dev = metrics.pnlDeviation ?? 1;
  if (dev >= t.paperPnlDeviation) {
    failures.push(`PnL deviation ${(dev * 100).toFixed(1)}% is not below ${(t.paperPnlDeviation * 100).toFixed(0)}%`);
  } else if (dev > t.paperPnlDeviation * (1 - WARNING_MARGIN)) {
    warnings.push(`PnL deviation ${(dev * 100).toFixed(1)}% is close to limit ${(t.paperPnlDeviation * 100).toFixed(0)}%`);
  }

  return { passed: failures.length === 0, failures, warnings };
}

function checkLiveToFull(metrics: StageMetrics, t: GraduationThresholds): GraduationResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  const days = metrics.liveDays ?? 0;
  if (days < t.liveMinDays) {
    failures.push(`Live trading duration ${days}d is below minimum ${t.liveMinDays}d`);
  }

  const events = metrics.riskEventCount ?? 0;
  if (events > t.liveMaxRiskEvents) {
    failures.push(`Found ${events} risk event(s), maximum allowed is ${t.liveMaxRiskEvents}`);
  }

  return { passed: failures.length === 0, failures, warnings };
}

const STAGE_CHECKS: Record<GraduationStage, (m: StageMetrics, t: GraduationThresholds) => GraduationResult> = {
  backtest_to_paper: checkBacktestToPaper,
  paper_to_live: checkPaperToLive,
  live_to_full: checkLiveToFull,
};

export function checkGraduation(
  stage: GraduationStage,
  metrics: StageMetrics,
  thresholdOverrides?: Partial<GraduationThresholds>,
): GraduationResult {
  const thresholds = resolveThresholds(thresholdOverrides);
  return STAGE_CHECKS[stage](metrics, thresholds);
}

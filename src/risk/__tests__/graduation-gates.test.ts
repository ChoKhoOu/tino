import { describe, test, expect } from 'bun:test';
import {
  checkGraduation,
  DEFAULT_GRADUATION_THRESHOLDS,
  type StageMetrics,
  type GraduationStage,
  type GraduationThresholds,
} from '../graduation-gates.js';

describe('checkGraduation', () => {
  describe('backtest_to_paper stage', () => {
    const stage: GraduationStage = 'backtest_to_paper';

    test('passes when all backtest metrics meet thresholds', () => {
      const metrics: StageMetrics = {
        sharpeRatio: 1.5,
        maxDrawdown: 0.15,
        tradeCount: 200,
      };
      const result = checkGraduation(stage, metrics);
      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    test('fails when Sharpe ratio is below threshold', () => {
      const metrics: StageMetrics = {
        sharpeRatio: 0.8,
        maxDrawdown: 0.10,
        tradeCount: 200,
      };
      const result = checkGraduation(stage, metrics);
      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('Sharpe'))).toBe(true);
    });

    test('fails when max drawdown exceeds threshold', () => {
      const metrics: StageMetrics = {
        sharpeRatio: 1.5,
        maxDrawdown: 0.25,
        tradeCount: 200,
      };
      const result = checkGraduation(stage, metrics);
      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('drawdown'))).toBe(true);
    });

    test('fails when trade count is below threshold', () => {
      const metrics: StageMetrics = {
        sharpeRatio: 1.5,
        maxDrawdown: 0.10,
        tradeCount: 50,
      };
      const result = checkGraduation(stage, metrics);
      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('Trade count'))).toBe(true);
    });

    test('fails with multiple failures reported', () => {
      const metrics: StageMetrics = {
        sharpeRatio: 0.5,
        maxDrawdown: 0.30,
        tradeCount: 10,
      };
      const result = checkGraduation(stage, metrics);
      expect(result.passed).toBe(false);
      expect(result.failures.length).toBe(3);
    });

    test('exactly at Sharpe threshold passes', () => {
      const metrics: StageMetrics = {
        sharpeRatio: 1.0,
        maxDrawdown: 0.15,
        tradeCount: 200,
      };
      const result = checkGraduation(stage, metrics);
      // Threshold is > 1.0, so exactly 1.0 should fail
      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('Sharpe'))).toBe(true);
    });

    test('exactly at drawdown threshold passes', () => {
      const metrics: StageMetrics = {
        sharpeRatio: 1.5,
        maxDrawdown: 0.20,
        tradeCount: 200,
      };
      const result = checkGraduation(stage, metrics);
      // Threshold is < 20%, so exactly 20% should fail
      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('drawdown'))).toBe(true);
    });

    test('exactly at trade count threshold passes', () => {
      const metrics: StageMetrics = {
        sharpeRatio: 1.5,
        maxDrawdown: 0.15,
        tradeCount: 100,
      };
      const result = checkGraduation(stage, metrics);
      // Threshold is > 100, so exactly 100 should fail
      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('Trade count'))).toBe(true);
    });
  });

  describe('paper_to_live stage', () => {
    const stage: GraduationStage = 'paper_to_live';

    test('passes when paper metrics meet thresholds', () => {
      const metrics: StageMetrics = {
        paperDays: 21,
        pnlDeviation: 0.15,
      };
      const result = checkGraduation(stage, metrics);
      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    test('fails when paper duration is too short', () => {
      const metrics: StageMetrics = {
        paperDays: 7,
        pnlDeviation: 0.10,
      };
      const result = checkGraduation(stage, metrics);
      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('duration'))).toBe(true);
    });

    test('fails when PnL deviation is too high', () => {
      const metrics: StageMetrics = {
        paperDays: 21,
        pnlDeviation: 0.45,
      };
      const result = checkGraduation(stage, metrics);
      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('deviation'))).toBe(true);
    });

    test('exactly at paper days threshold fails', () => {
      const metrics: StageMetrics = {
        paperDays: 14,
        pnlDeviation: 0.10,
      };
      const result = checkGraduation(stage, metrics);
      // Threshold is >= 14 days, so exactly 14 should pass
      expect(result.passed).toBe(true);
    });

    test('exactly at PnL deviation threshold fails', () => {
      const metrics: StageMetrics = {
        paperDays: 21,
        pnlDeviation: 0.30,
      };
      const result = checkGraduation(stage, metrics);
      // Threshold is < 30%, so exactly 30% should fail
      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('deviation'))).toBe(true);
    });
  });

  describe('live_to_full stage', () => {
    const stage: GraduationStage = 'live_to_full';

    test('passes when live metrics meet thresholds', () => {
      const metrics: StageMetrics = {
        liveDays: 35,
        riskEventCount: 0,
      };
      const result = checkGraduation(stage, metrics);
      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    test('fails when live duration is too short', () => {
      const metrics: StageMetrics = {
        liveDays: 14,
        riskEventCount: 0,
      };
      const result = checkGraduation(stage, metrics);
      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('duration'))).toBe(true);
    });

    test('fails when risk events occurred', () => {
      const metrics: StageMetrics = {
        liveDays: 35,
        riskEventCount: 2,
      };
      const result = checkGraduation(stage, metrics);
      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('risk event'))).toBe(true);
    });

    test('exactly at live days threshold passes', () => {
      const metrics: StageMetrics = {
        liveDays: 28,
        riskEventCount: 0,
      };
      const result = checkGraduation(stage, metrics);
      // Threshold is >= 28, so exactly 28 should pass
      expect(result.passed).toBe(true);
    });
  });

  describe('custom thresholds', () => {
    test('uses custom Sharpe threshold', () => {
      const metrics: StageMetrics = {
        sharpeRatio: 1.8,
        maxDrawdown: 0.10,
        tradeCount: 200,
      };
      const thresholds: Partial<GraduationThresholds> = {
        backtestSharpe: 2.0,
      };
      const result = checkGraduation('backtest_to_paper', metrics, thresholds);
      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('Sharpe'))).toBe(true);
    });

    test('uses custom paper days threshold', () => {
      const metrics: StageMetrics = {
        paperDays: 25,
        pnlDeviation: 0.10,
      };
      const thresholds: Partial<GraduationThresholds> = {
        paperMinDays: 30,
      };
      const result = checkGraduation('paper_to_live', metrics, thresholds);
      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('duration'))).toBe(true);
    });

    test('uses custom live risk events threshold', () => {
      const metrics: StageMetrics = {
        liveDays: 35,
        riskEventCount: 1,
      };
      const thresholds: Partial<GraduationThresholds> = {
        liveMaxRiskEvents: 2,
      };
      const result = checkGraduation('live_to_full', metrics, thresholds);
      expect(result.passed).toBe(true);
    });

    test('custom thresholds merge with defaults', () => {
      const metrics: StageMetrics = {
        sharpeRatio: 1.5,
        maxDrawdown: 0.10,
        tradeCount: 50,
      };
      // Only override sharpe, trade count should still use default of 100
      const thresholds: Partial<GraduationThresholds> = {
        backtestSharpe: 1.2,
      };
      const result = checkGraduation('backtest_to_paper', metrics, thresholds);
      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('Trade count'))).toBe(true);
    });
  });

  describe('warnings', () => {
    test('includes warning when metrics are close to threshold', () => {
      const metrics: StageMetrics = {
        sharpeRatio: 1.15,
        maxDrawdown: 0.18,
        tradeCount: 200,
      };
      const result = checkGraduation('backtest_to_paper', metrics);
      // Should pass but with warnings about borderline metrics
      expect(result.passed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import {
  AIRiskAdvisor,
  calculateZScore,
  pearsonCorrelation,
  DEFAULT_ADVISOR_CONFIG,
  type PositionSnapshot,
  type FundingRateSnapshot,
  type LiquidationSnapshot,
  type LiquidationHistoryPoint,
  type AssetReturns,
  type PortfolioRiskData,
} from '../ai-risk-advisor.js';
import { TelegramNotifier } from '@/notifications/telegram.js';

function makePosition(overrides: Partial<PositionSnapshot> = {}): PositionSnapshot {
  return {
    symbol: 'BTCUSDT',
    exchange: 'Binance',
    side: 'long',
    notionalValue: 10_000,
    markPrice: 50_000,
    liquidationPrice: 0,
    leverage: 1,
    entryPrice: 48_000,
    ...overrides,
  };
}

describe('AIRiskAdvisor', () => {
  let advisor: AIRiskAdvisor;

  beforeEach(() => {
    advisor = new AIRiskAdvisor();
  });

  test('returns default config', () => {
    expect(advisor.getConfig()).toEqual(DEFAULT_ADVISOR_CONFIG);
  });

  test('accepts partial config overrides', () => {
    const custom = new AIRiskAdvisor({ concentrationWarning: 0.20 });
    expect(custom.getConfig().concentrationWarning).toBe(0.20);
    expect(custom.getConfig().fundingRateWarning).toBe(DEFAULT_ADVISOR_CONFIG.fundingRateWarning);
  });

  // ============================================================================
  // Position Concentration
  // ============================================================================

  describe('checkPositionConcentration', () => {
    test('no alert when positions are balanced', () => {
      const positions = [
        makePosition({ symbol: 'BTCUSDT', notionalValue: 2_500 }),
        makePosition({ symbol: 'ETHUSDT', notionalValue: 2_500 }),
        makePosition({ symbol: 'SOLUSDT', notionalValue: 2_500 }),
        makePosition({ symbol: 'AVAXUSDT', notionalValue: 2_500 }),
      ];
      const alerts = advisor.checkPositionConcentration(positions);
      expect(alerts).toHaveLength(0);
    });

    test('warning when single asset exceeds 30%', () => {
      const positions = [
        makePosition({ symbol: 'BTCUSDT', notionalValue: 35_000 }),
        makePosition({ symbol: 'ETHUSDT', notionalValue: 25_000 }),
        makePosition({ symbol: 'SOLUSDT', notionalValue: 20_000 }),
        makePosition({ symbol: 'AVAXUSDT', notionalValue: 20_000 }),
      ];
      const alerts = advisor.checkPositionConcentration(positions);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.severity).toBe('warning');
      expect(alerts[0]!.type).toBe('Position Concentration');
      expect(alerts[0]!.message).toContain('BTCUSDT');
    });

    test('critical when single asset exceeds 50%', () => {
      const positions = [
        makePosition({ symbol: 'BTCUSDT', notionalValue: 60_000 }),
        makePosition({ symbol: 'ETHUSDT', notionalValue: 40_000 }),
      ];
      const alerts = advisor.checkPositionConcentration(positions);
      expect(alerts.some((a) => a.severity === 'critical' && a.message.includes('BTCUSDT'))).toBe(true);
    });

    test('no alert when total value is zero', () => {
      const positions = [makePosition({ notionalValue: 0 })];
      const alerts = advisor.checkPositionConcentration(positions);
      expect(alerts).toHaveLength(0);
    });
  });

  // ============================================================================
  // Funding Rate Anomaly
  // ============================================================================

  describe('checkFundingRateAnomaly', () => {
    test('no alert for normal funding rates', () => {
      const rates: FundingRateSnapshot[] = [
        { symbol: 'BTCUSDT', exchange: 'Binance', rate: 0.0001 },
        { symbol: 'ETHUSDT', exchange: 'Binance', rate: -0.0002 },
      ];
      const alerts = advisor.checkFundingRateAnomaly(rates);
      expect(alerts).toHaveLength(0);
    });

    test('warning for elevated funding rate', () => {
      const rates: FundingRateSnapshot[] = [
        { symbol: 'BTCUSDT', exchange: 'Binance', rate: 0.002 },
      ];
      const alerts = advisor.checkFundingRateAnomaly(rates);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.severity).toBe('warning');
      expect(alerts[0]!.type).toBe('Funding Rate Anomaly');
    });

    test('critical for extreme funding rate', () => {
      const rates: FundingRateSnapshot[] = [
        { symbol: 'BTCUSDT', exchange: 'Binance', rate: 0.01 },
      ];
      const alerts = advisor.checkFundingRateAnomaly(rates);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.severity).toBe('critical');
    });

    test('detects negative extreme funding rate', () => {
      const rates: FundingRateSnapshot[] = [
        { symbol: 'ETHUSDT', exchange: 'OKX', rate: -0.006 },
      ];
      const alerts = advisor.checkFundingRateAnomaly(rates);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.severity).toBe('critical');
      expect(alerts[0]!.message).toContain('negative');
    });
  });

  // ============================================================================
  // Liquidation Distance
  // ============================================================================

  describe('checkLiquidationDistance', () => {
    test('no alert for spot positions (no leverage)', () => {
      const positions = [makePosition({ leverage: 1, liquidationPrice: 0 })];
      const alerts = advisor.checkLiquidationDistance(positions);
      expect(alerts).toHaveLength(0);
    });

    test('no alert when far from liquidation', () => {
      const positions = [
        makePosition({
          markPrice: 50_000,
          liquidationPrice: 30_000,
          leverage: 3,
        }),
      ];
      const alerts = advisor.checkLiquidationDistance(positions);
      expect(alerts).toHaveLength(0);
    });

    test('warning when within 15% of liquidation', () => {
      const positions = [
        makePosition({
          markPrice: 50_000,
          liquidationPrice: 44_000, // 12% distance
          leverage: 5,
        }),
      ];
      const alerts = advisor.checkLiquidationDistance(positions);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.severity).toBe('warning');
      expect(alerts[0]!.type).toBe('Liquidation Distance');
    });

    test('critical when within 5% of liquidation', () => {
      const positions = [
        makePosition({
          markPrice: 50_000,
          liquidationPrice: 48_000, // 4% distance
          leverage: 20,
        }),
      ];
      const alerts = advisor.checkLiquidationDistance(positions);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.severity).toBe('critical');
    });

    test('works for short positions', () => {
      const positions = [
        makePosition({
          side: 'short',
          markPrice: 50_000,
          liquidationPrice: 52_000, // 4% distance above
          leverage: 20,
        }),
      ];
      const alerts = advisor.checkLiquidationDistance(positions);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.severity).toBe('critical');
    });
  });

  // ============================================================================
  // Liquidation Cascade
  // ============================================================================

  describe('checkLiquidationCascade', () => {
    test('no alert for normal liquidation levels with history', () => {
      const current: LiquidationSnapshot[] = [
        { symbol: 'BTC', totalLiquidationUsd: 50_000_000, longLiquidationUsd: 30_000_000, shortLiquidationUsd: 20_000_000 },
      ];
      const history: LiquidationHistoryPoint[] = Array.from({ length: 30 }, () => ({
        totalLiquidationUsd: 45_000_000 + Math.random() * 20_000_000,
      }));
      const alerts = advisor.checkLiquidationCascade(current, history);
      expect(alerts).toHaveLength(0);
    });

    test('warning when Z-score exceeds 2.0', () => {
      const current: LiquidationSnapshot[] = [
        { symbol: 'BTC', totalLiquidationUsd: 200_000_000, longLiquidationUsd: 150_000_000, shortLiquidationUsd: 50_000_000 },
      ];
      // mean ~50M, stddev ~5M, value 200M => Z-score ~30
      const history: LiquidationHistoryPoint[] = Array.from({ length: 20 }, () => ({
        totalLiquidationUsd: 50_000_000,
      }));
      const alerts = advisor.checkLiquidationCascade(current, history);
      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts[0]!.type).toBe('Liquidation Cascade');
    });

    test('uses absolute thresholds when no history', () => {
      const current: LiquidationSnapshot[] = [
        { symbol: 'BTC', totalLiquidationUsd: 600_000_000, longLiquidationUsd: 400_000_000, shortLiquidationUsd: 200_000_000 },
      ];
      const alerts = advisor.checkLiquidationCascade(current);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.severity).toBe('warning');
    });

    test('critical for extreme liquidation without history', () => {
      const current: LiquidationSnapshot[] = [
        { symbol: 'BTC', totalLiquidationUsd: 1_500_000_000, longLiquidationUsd: 1_000_000_000, shortLiquidationUsd: 500_000_000 },
      ];
      const alerts = advisor.checkLiquidationCascade(current);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.severity).toBe('critical');
    });
  });

  // ============================================================================
  // Exchange Concentration
  // ============================================================================

  describe('checkExchangeConcentration', () => {
    test('no alert when single exchange (no concentration risk if only one)', () => {
      const positions = [
        makePosition({ exchange: 'Binance', notionalValue: 50_000 }),
        makePosition({ exchange: 'Binance', notionalValue: 50_000 }),
      ];
      const alerts = advisor.checkExchangeConcentration(positions);
      expect(alerts).toHaveLength(0);
    });

    test('no alert when well distributed', () => {
      const positions = [
        makePosition({ exchange: 'Binance', notionalValue: 30_000 }),
        makePosition({ exchange: 'OKX', notionalValue: 35_000 }),
        makePosition({ exchange: 'Bybit', notionalValue: 35_000 }),
      ];
      const alerts = advisor.checkExchangeConcentration(positions);
      expect(alerts).toHaveLength(0);
    });

    test('warning when one exchange exceeds 60%', () => {
      const positions = [
        makePosition({ exchange: 'Binance', notionalValue: 70_000 }),
        makePosition({ exchange: 'OKX', notionalValue: 30_000 }),
      ];
      const alerts = advisor.checkExchangeConcentration(positions);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.severity).toBe('warning');
      expect(alerts[0]!.message).toContain('Binance');
    });

    test('critical when one exchange exceeds 80%', () => {
      const positions = [
        makePosition({ exchange: 'Binance', notionalValue: 90_000 }),
        makePosition({ exchange: 'OKX', notionalValue: 10_000 }),
      ];
      const alerts = advisor.checkExchangeConcentration(positions);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.severity).toBe('critical');
    });
  });

  // ============================================================================
  // Correlation Risk
  // ============================================================================

  describe('checkCorrelationRisk', () => {
    test('no alert for uncorrelated assets', () => {
      const returns: AssetReturns[] = [
        { symbol: 'BTCUSDT', returns: [0.01, -0.02, 0.03, -0.01, 0.02] },
        { symbol: 'GOLDUSDT', returns: [-0.01, 0.02, -0.01, 0.03, -0.02] },
      ];
      const alerts = advisor.checkCorrelationRisk(returns);
      expect(alerts).toHaveLength(0);
    });

    test('warning for highly correlated assets', () => {
      const base = [0.01, -0.02, 0.03, -0.01, 0.02, -0.03, 0.04, -0.02, 0.01, 0.03];
      const correlated = base.map((v) => v * 1.1 + 0.0001); // ~99% correlated
      const returns: AssetReturns[] = [
        { symbol: 'BTCUSDT', returns: base },
        { symbol: 'ETHUSDT', returns: correlated },
      ];
      const alerts = advisor.checkCorrelationRisk(returns);
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });

    test('no alert when insufficient data', () => {
      const returns: AssetReturns[] = [
        { symbol: 'BTCUSDT', returns: [0.01] },
        { symbol: 'ETHUSDT', returns: [0.02] },
      ];
      const alerts = advisor.checkCorrelationRisk(returns);
      expect(alerts).toHaveLength(0);
    });
  });

  // ============================================================================
  // Full Analysis
  // ============================================================================

  describe('analyze', () => {
    test('returns empty array for healthy portfolio', () => {
      const data: PortfolioRiskData = {
        positions: [
          makePosition({ symbol: 'BTCUSDT', notionalValue: 2_500, exchange: 'Binance' }),
          makePosition({ symbol: 'ETHUSDT', notionalValue: 2_500, exchange: 'Binance' }),
          makePosition({ symbol: 'SOLUSDT', notionalValue: 2_500, exchange: 'OKX' }),
          makePosition({ symbol: 'AVAXUSDT', notionalValue: 2_500, exchange: 'OKX' }),
        ],
        fundingRates: [
          { symbol: 'BTCUSDT', exchange: 'Binance', rate: 0.0001 },
        ],
      };
      const alerts = advisor.analyze(data);
      expect(alerts).toHaveLength(0);
    });

    test('sorts alerts by severity (critical first)', () => {
      const data: PortfolioRiskData = {
        positions: [
          makePosition({ symbol: 'BTCUSDT', notionalValue: 90_000, exchange: 'Binance' }),
          makePosition({ symbol: 'ETHUSDT', notionalValue: 10_000, exchange: 'OKX' }),
        ],
        fundingRates: [
          { symbol: 'BTCUSDT', exchange: 'Binance', rate: 0.002 }, // warning
        ],
      };
      const alerts = advisor.analyze(data);
      expect(alerts.length).toBeGreaterThan(0);

      // Verify critical comes before warning
      for (let i = 1; i < alerts.length; i++) {
        const prevSev = alerts[i - 1]!.severity;
        const currSev = alerts[i]!.severity;
        const order = { critical: 0, warning: 1, info: 2 };
        expect(order[prevSev]).toBeLessThanOrEqual(order[currSev]);
      }
    });

    test('handles empty positions gracefully', () => {
      const data: PortfolioRiskData = { positions: [] };
      const alerts = advisor.analyze(data);
      expect(alerts).toHaveLength(0);
    });
  });

  // ============================================================================
  // Format for Agent
  // ============================================================================

  describe('formatForAgent', () => {
    test('returns "no alerts" message for empty array', () => {
      const result = advisor.formatForAgent([]);
      expect(result).toContain('No risk alerts');
    });

    test('formats alerts with severity counts', () => {
      const alerts = [
        {
          severity: 'critical' as const,
          type: 'Test',
          message: 'Critical issue',
          recommendation: 'Fix it',
        },
        {
          severity: 'warning' as const,
          type: 'Test',
          message: 'Warning issue',
          recommendation: 'Watch it',
        },
      ];
      const result = advisor.formatForAgent(alerts);
      expect(result).toContain('1 critical');
      expect(result).toContain('1 warning');
      expect(result).toContain('[CRITICAL]');
      expect(result).toContain('[WARNING]');
    });
  });

  // ============================================================================
  // Telegram Integration
  // ============================================================================

  describe('telegram notification', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      globalThis.fetch = originalFetch;
    });

    test('pushes critical and warning alerts to Telegram', () => {
      const fetchMock = mock(() => Promise.resolve({ ok: true } as Response));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const notifier = new TelegramNotifier('test-token', '-100');
      const advisorWithNotifier = new AIRiskAdvisor(undefined, undefined, notifier);

      const data: PortfolioRiskData = {
        positions: [
          makePosition({ symbol: 'BTCUSDT', notionalValue: 60_000 }),
          makePosition({ symbol: 'ETHUSDT', notionalValue: 40_000 }),
        ],
      };

      advisorWithNotifier.analyze(data);

      // At least one fetch call for the critical concentration alert
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1);
      const body = JSON.parse(
        (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
      );
      expect(body.text).toContain('AI Risk Advisor');
    });

    test('does not push info-level alerts', () => {
      const fetchMock = mock(() => Promise.resolve({ ok: true } as Response));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const notifier = new TelegramNotifier('test-token', '-100');
      const advisorWithNotifier = new AIRiskAdvisor(undefined, undefined, notifier);

      // Balanced portfolio = no alerts
      const data: PortfolioRiskData = {
        positions: [
          makePosition({ symbol: 'BTCUSDT', notionalValue: 2_500 }),
          makePosition({ symbol: 'ETHUSDT', notionalValue: 2_500 }),
          makePosition({ symbol: 'SOLUSDT', notionalValue: 2_500 }),
          makePosition({ symbol: 'AVAXUSDT', notionalValue: 2_500 }),
        ],
      };

      advisorWithNotifier.analyze(data);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('notification failure does not break analysis', () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('network error'))) as unknown as typeof fetch;

      const notifier = new TelegramNotifier('test-token', '-100');
      const advisorWithNotifier = new AIRiskAdvisor(undefined, undefined, notifier);

      const data: PortfolioRiskData = {
        positions: [
          makePosition({ symbol: 'BTCUSDT', notionalValue: 90_000 }),
          makePosition({ symbol: 'ETHUSDT', notionalValue: 10_000 }),
        ],
      };

      // Should not throw
      const alerts = advisorWithNotifier.analyze(data);
      expect(alerts.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Statistical Helpers
// ============================================================================

describe('calculateZScore', () => {
  test('returns 0 for empty history', () => {
    expect(calculateZScore(100, [])).toBe(0);
  });

  test('returns 0 when value equals mean and stddev is 0', () => {
    expect(calculateZScore(50, [50, 50, 50])).toBe(0);
  });

  test('returns Infinity when stddev is 0 and value differs from mean', () => {
    expect(calculateZScore(100, [50, 50, 50])).toBe(Infinity);
  });

  test('calculates correct Z-score', () => {
    // mean=10, stddev=~4.47, value=20 => Z-score ~2.24
    const history = [5, 8, 10, 12, 15];
    const z = calculateZScore(20, history);
    expect(z).toBeGreaterThan(2);
    expect(z).toBeLessThan(3);
  });
});

describe('pearsonCorrelation', () => {
  test('returns null for insufficient data', () => {
    expect(pearsonCorrelation([1], [2])).toBeNull();
    expect(pearsonCorrelation([1, 2], [2, 3])).toBeNull();
  });

  test('returns 1 for perfectly correlated data', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [2, 4, 6, 8, 10];
    const corr = pearsonCorrelation(xs, ys);
    expect(corr).not.toBeNull();
    expect(Math.abs(corr! - 1)).toBeLessThan(0.001);
  });

  test('returns -1 for perfectly anti-correlated data', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [10, 8, 6, 4, 2];
    const corr = pearsonCorrelation(xs, ys);
    expect(corr).not.toBeNull();
    expect(Math.abs(corr! + 1)).toBeLessThan(0.001);
  });

  test('returns ~0 for uncorrelated data', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const ys = [5, 3, 7, 1, 9, 2, 8, 4, 10, 6];
    const corr = pearsonCorrelation(xs, ys);
    expect(corr).not.toBeNull();
    expect(Math.abs(corr!)).toBeLessThan(0.5);
  });

  test('returns null when all values are constant', () => {
    const xs = [5, 5, 5, 5, 5];
    const ys = [3, 3, 3, 3, 3];
    expect(pearsonCorrelation(xs, ys)).toBeNull();
  });
});

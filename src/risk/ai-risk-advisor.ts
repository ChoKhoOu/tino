/**
 * AI Risk Advisor — proactive risk monitoring for crypto CEX trading.
 *
 * Identifies and warns about potential risks using statistical rules
 * (thresholds, percentages, Z-scores). No ML models.
 *
 * Risk checks:
 * 1. Position concentration — single asset exceeds X% of total
 * 2. Funding rate anomaly — extreme positive/negative funding rates
 * 3. Liquidation distance — leveraged position close to liquidation
 * 4. Liquidation cascade — abnormal network-wide liquidation volume
 * 5. Exchange concentration — too much exposure on single exchange
 * 6. Correlation risk — portfolio assets with high correlation
 */

import type { TelegramNotifier } from '@/notifications/telegram.js';
import type { RiskEngine } from './risk-engine.js';

// ============================================================================
// Types
// ============================================================================

export type RiskSeverity = 'info' | 'warning' | 'critical';

export interface RiskAlert {
  severity: RiskSeverity;
  type: string;
  message: string;
  recommendation: string;
  /** Optional metadata for downstream consumers (e.g. symbol, exchange). */
  metadata?: Record<string, unknown>;
}

/** A position snapshot for risk analysis. */
export interface PositionSnapshot {
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  /** Position value in quote currency (e.g. USDT). */
  notionalValue: number;
  /** Current mark price. */
  markPrice: number;
  /** Liquidation price (0 if not leveraged). */
  liquidationPrice: number;
  /** Leverage multiplier (1 = no leverage). */
  leverage: number;
  /** Entry price. */
  entryPrice: number;
}

/** Funding rate data point. */
export interface FundingRateSnapshot {
  symbol: string;
  exchange: string;
  rate: number;
}

/** Network-wide liquidation data. */
export interface LiquidationSnapshot {
  symbol: string;
  totalLiquidationUsd: number;
  longLiquidationUsd: number;
  shortLiquidationUsd: number;
}

/** Historical liquidation data point for Z-score calculation. */
export interface LiquidationHistoryPoint {
  totalLiquidationUsd: number;
}

/** Price return series for correlation calculation. */
export interface AssetReturns {
  symbol: string;
  /** Array of period returns (e.g. daily returns). */
  returns: number[];
}

/** Full portfolio snapshot for risk analysis. */
export interface PortfolioRiskData {
  positions: PositionSnapshot[];
  fundingRates?: FundingRateSnapshot[];
  liquidations?: LiquidationSnapshot[];
  liquidationHistory?: LiquidationHistoryPoint[];
  assetReturns?: AssetReturns[];
}

// ============================================================================
// Configuration
// ============================================================================

export interface AdvisorConfig {
  /** Max % of total portfolio in a single asset before warning (0-1). */
  concentrationWarning: number;
  /** Max % of total portfolio in a single asset before critical (0-1). */
  concentrationCritical: number;

  /** Funding rate threshold for warning (absolute value). */
  fundingRateWarning: number;
  /** Funding rate threshold for critical (absolute value). */
  fundingRateCritical: number;

  /** Liquidation distance % for warning (0-1). */
  liquidationDistanceWarning: number;
  /** Liquidation distance % for critical (0-1). */
  liquidationDistanceCritical: number;

  /** Z-score threshold for liquidation cascade warning. */
  liquidationCascadeZScoreWarning: number;
  /** Z-score threshold for liquidation cascade critical. */
  liquidationCascadeZScoreCritical: number;

  /** Max % of total portfolio on one exchange before warning (0-1). */
  exchangeConcentrationWarning: number;
  /** Max % of total portfolio on one exchange before critical (0-1). */
  exchangeConcentrationCritical: number;

  /** Pearson correlation threshold for warning (0-1). */
  correlationWarning: number;
  /** Pearson correlation threshold for critical (0-1). */
  correlationCritical: number;
}

export const DEFAULT_ADVISOR_CONFIG: AdvisorConfig = {
  concentrationWarning: 0.30,
  concentrationCritical: 0.50,

  fundingRateWarning: 0.001,   // 0.1% per 8h
  fundingRateCritical: 0.005,  // 0.5% per 8h

  liquidationDistanceWarning: 0.15, // 15%
  liquidationDistanceCritical: 0.05, // 5%

  liquidationCascadeZScoreWarning: 2.0,
  liquidationCascadeZScoreCritical: 3.0,

  exchangeConcentrationWarning: 0.60,
  exchangeConcentrationCritical: 0.80,

  correlationWarning: 0.80,
  correlationCritical: 0.95,
};

// ============================================================================
// Core Advisor
// ============================================================================

export class AIRiskAdvisor {
  private config: AdvisorConfig;
  private riskEngine?: RiskEngine;
  private notifier?: TelegramNotifier;

  constructor(
    config?: Partial<AdvisorConfig>,
    riskEngine?: RiskEngine,
    notifier?: TelegramNotifier,
  ) {
    this.config = { ...DEFAULT_ADVISOR_CONFIG, ...config };
    this.riskEngine = riskEngine;
    this.notifier = notifier;
  }

  getConfig(): AdvisorConfig {
    return this.config;
  }

  setRiskEngine(engine: RiskEngine | undefined): void {
    this.riskEngine = engine;
  }

  setNotifier(notifier: TelegramNotifier | undefined): void {
    this.notifier = notifier;
  }

  /**
   * Run all risk checks on the given portfolio data.
   * Returns alerts sorted by severity (critical first).
   */
  analyze(data: PortfolioRiskData): RiskAlert[] {
    const alerts: RiskAlert[] = [];

    if (data.positions.length > 0) {
      alerts.push(...this.checkPositionConcentration(data.positions));
      alerts.push(...this.checkLiquidationDistance(data.positions));
      alerts.push(...this.checkExchangeConcentration(data.positions));
    }

    if (data.fundingRates && data.fundingRates.length > 0) {
      alerts.push(...this.checkFundingRateAnomaly(data.fundingRates));
    }

    if (data.liquidations && data.liquidations.length > 0) {
      alerts.push(
        ...this.checkLiquidationCascade(data.liquidations, data.liquidationHistory),
      );
    }

    if (data.assetReturns && data.assetReturns.length >= 2) {
      alerts.push(...this.checkCorrelationRisk(data.assetReturns));
    }

    // Sort: critical > warning > info
    const severityOrder: Record<RiskSeverity, number> = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Push alerts to Telegram (fire-and-forget)
    this.pushAlerts(alerts);

    return alerts;
  }

  /**
   * Format alerts into a human-readable summary for the AI agent.
   */
  formatForAgent(alerts: RiskAlert[]): string {
    if (alerts.length === 0) {
      return 'No risk alerts detected. Portfolio risk is within normal parameters.';
    }

    const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
    const warningCount = alerts.filter((a) => a.severity === 'warning').length;
    const infoCount = alerts.filter((a) => a.severity === 'info').length;

    const header = `Risk scan found ${alerts.length} alert(s): ${criticalCount} critical, ${warningCount} warning, ${infoCount} info.`;

    const lines = alerts.map((a) => {
      const icon = a.severity === 'critical' ? '[CRITICAL]' : a.severity === 'warning' ? '[WARNING]' : '[INFO]';
      return `${icon} ${a.type}: ${a.message}\n  -> ${a.recommendation}`;
    });

    return `${header}\n\n${lines.join('\n\n')}`;
  }

  // ============================================================================
  // Individual Risk Checks
  // ============================================================================

  /** Check 1: Position concentration — single asset exceeds threshold. */
  checkPositionConcentration(positions: PositionSnapshot[]): RiskAlert[] {
    const alerts: RiskAlert[] = [];
    const totalValue = positions.reduce((sum, p) => sum + p.notionalValue, 0);
    if (totalValue <= 0) return alerts;

    for (const pos of positions) {
      const ratio = pos.notionalValue / totalValue;

      if (ratio >= this.config.concentrationCritical) {
        alerts.push({
          severity: 'critical',
          type: 'Position Concentration',
          message: `${pos.symbol} accounts for ${pct(ratio)} of total portfolio ($${fmt(pos.notionalValue)} / $${fmt(totalValue)})`,
          recommendation: `Reduce ${pos.symbol} position to below ${pct(this.config.concentrationWarning)} of portfolio to diversify risk`,
          metadata: { symbol: pos.symbol, ratio, notionalValue: pos.notionalValue },
        });
      } else if (ratio >= this.config.concentrationWarning) {
        alerts.push({
          severity: 'warning',
          type: 'Position Concentration',
          message: `${pos.symbol} accounts for ${pct(ratio)} of total portfolio ($${fmt(pos.notionalValue)} / $${fmt(totalValue)})`,
          recommendation: `Consider reducing ${pos.symbol} exposure to improve diversification`,
          metadata: { symbol: pos.symbol, ratio, notionalValue: pos.notionalValue },
        });
      }
    }

    return alerts;
  }

  /** Check 2: Funding rate anomaly — extreme rates signal crowded positions. */
  checkFundingRateAnomaly(rates: FundingRateSnapshot[]): RiskAlert[] {
    const alerts: RiskAlert[] = [];

    for (const fr of rates) {
      const absRate = Math.abs(fr.rate);

      if (absRate >= this.config.fundingRateCritical) {
        const direction = fr.rate > 0 ? 'positive (longs pay shorts)' : 'negative (shorts pay longs)';
        alerts.push({
          severity: 'critical',
          type: 'Funding Rate Anomaly',
          message: `${fr.symbol} on ${fr.exchange}: funding rate ${pctSigned(fr.rate)} — extreme ${direction}`,
          recommendation: `Extremely crowded trade detected. Consider closing or hedging ${fr.symbol} position on ${fr.exchange}`,
          metadata: { symbol: fr.symbol, exchange: fr.exchange, rate: fr.rate },
        });
      } else if (absRate >= this.config.fundingRateWarning) {
        const direction = fr.rate > 0 ? 'positive' : 'negative';
        alerts.push({
          severity: 'warning',
          type: 'Funding Rate Anomaly',
          message: `${fr.symbol} on ${fr.exchange}: funding rate ${pctSigned(fr.rate)} — elevated ${direction}`,
          recommendation: `Monitor ${fr.symbol} funding rate closely. Elevated rates increase holding costs`,
          metadata: { symbol: fr.symbol, exchange: fr.exchange, rate: fr.rate },
        });
      }
    }

    return alerts;
  }

  /** Check 3: Liquidation distance — % from current price to liquidation. */
  checkLiquidationDistance(positions: PositionSnapshot[]): RiskAlert[] {
    const alerts: RiskAlert[] = [];

    for (const pos of positions) {
      if (pos.liquidationPrice <= 0 || pos.leverage <= 1) continue;

      const distance = Math.abs(pos.markPrice - pos.liquidationPrice) / pos.markPrice;

      if (distance <= this.config.liquidationDistanceCritical) {
        alerts.push({
          severity: 'critical',
          type: 'Liquidation Distance',
          message: `${pos.symbol} on ${pos.exchange}: only ${pct(distance)} from liquidation (mark: $${fmt(pos.markPrice)}, liq: $${fmt(pos.liquidationPrice)}, ${pos.leverage}x leverage)`,
          recommendation: `Immediately reduce leverage or add margin for ${pos.symbol} to avoid liquidation`,
          metadata: { symbol: pos.symbol, exchange: pos.exchange, distance, leverage: pos.leverage },
        });
      } else if (distance <= this.config.liquidationDistanceWarning) {
        alerts.push({
          severity: 'warning',
          type: 'Liquidation Distance',
          message: `${pos.symbol} on ${pos.exchange}: ${pct(distance)} from liquidation (mark: $${fmt(pos.markPrice)}, liq: $${fmt(pos.liquidationPrice)}, ${pos.leverage}x leverage)`,
          recommendation: `Consider reducing leverage or adding margin for ${pos.symbol}`,
          metadata: { symbol: pos.symbol, exchange: pos.exchange, distance, leverage: pos.leverage },
        });
      }
    }

    return alerts;
  }

  /** Check 4: Liquidation cascade — abnormal network-wide liquidation volume via Z-score. */
  checkLiquidationCascade(
    current: LiquidationSnapshot[],
    history?: LiquidationHistoryPoint[],
  ): RiskAlert[] {
    const alerts: RiskAlert[] = [];

    const totalCurrent = current.reduce((sum, l) => sum + l.totalLiquidationUsd, 0);

    if (history && history.length >= 5) {
      const historicalValues = history.map((h) => h.totalLiquidationUsd);
      const zScore = calculateZScore(totalCurrent, historicalValues);

      if (zScore >= this.config.liquidationCascadeZScoreCritical) {
        const topSymbol = current.sort((a, b) => b.totalLiquidationUsd - a.totalLiquidationUsd)[0];
        alerts.push({
          severity: 'critical',
          type: 'Liquidation Cascade',
          message: `Network liquidations $${fmt(totalCurrent)} (Z-score: ${zScore.toFixed(1)}) — extreme cascade event. Top: ${topSymbol?.symbol ?? 'N/A'}`,
          recommendation: 'Reduce leverage across all positions. Liquidation cascade may cause rapid price dislocations',
          metadata: { totalLiquidationUsd: totalCurrent, zScore },
        });
      } else if (zScore >= this.config.liquidationCascadeZScoreWarning) {
        alerts.push({
          severity: 'warning',
          type: 'Liquidation Cascade',
          message: `Network liquidations $${fmt(totalCurrent)} (Z-score: ${zScore.toFixed(1)}) — elevated liquidation activity`,
          recommendation: 'Monitor positions closely. Elevated liquidation volume may precede increased volatility',
          metadata: { totalLiquidationUsd: totalCurrent, zScore },
        });
      }
    } else {
      // Without history, use absolute thresholds
      // $500M+ in 24h is high, $1B+ is extreme
      if (totalCurrent >= 1_000_000_000) {
        alerts.push({
          severity: 'critical',
          type: 'Liquidation Cascade',
          message: `Network liquidations $${fmt(totalCurrent)} — extreme cascade event`,
          recommendation: 'Reduce leverage across all positions immediately',
          metadata: { totalLiquidationUsd: totalCurrent },
        });
      } else if (totalCurrent >= 500_000_000) {
        alerts.push({
          severity: 'warning',
          type: 'Liquidation Cascade',
          message: `Network liquidations $${fmt(totalCurrent)} — elevated liquidation activity`,
          recommendation: 'Monitor positions closely and consider reducing leverage',
          metadata: { totalLiquidationUsd: totalCurrent },
        });
      }
    }

    return alerts;
  }

  /** Check 5: Exchange concentration — too much on single exchange. */
  checkExchangeConcentration(positions: PositionSnapshot[]): RiskAlert[] {
    const alerts: RiskAlert[] = [];
    const totalValue = positions.reduce((sum, p) => sum + p.notionalValue, 0);
    if (totalValue <= 0) return alerts;

    // Aggregate by exchange
    const byExchange = new Map<string, number>();
    for (const pos of positions) {
      byExchange.set(pos.exchange, (byExchange.get(pos.exchange) ?? 0) + pos.notionalValue);
    }

    // Only alert if there are multiple exchanges
    if (byExchange.size <= 1) return alerts;

    for (const [exchange, value] of byExchange) {
      const ratio = value / totalValue;

      if (ratio >= this.config.exchangeConcentrationCritical) {
        alerts.push({
          severity: 'critical',
          type: 'Exchange Concentration',
          message: `${pct(ratio)} of portfolio ($${fmt(value)}) concentrated on ${exchange}`,
          recommendation: `Distribute positions across multiple exchanges to reduce counterparty risk`,
          metadata: { exchange, ratio, value },
        });
      } else if (ratio >= this.config.exchangeConcentrationWarning) {
        alerts.push({
          severity: 'warning',
          type: 'Exchange Concentration',
          message: `${pct(ratio)} of portfolio ($${fmt(value)}) on ${exchange}`,
          recommendation: `Consider spreading positions to other exchanges to reduce counterparty risk`,
          metadata: { exchange, ratio, value },
        });
      }
    }

    return alerts;
  }

  /** Check 6: Correlation risk — high correlation between portfolio assets. */
  checkCorrelationRisk(assetReturns: AssetReturns[]): RiskAlert[] {
    const alerts: RiskAlert[] = [];

    for (let i = 0; i < assetReturns.length; i++) {
      for (let j = i + 1; j < assetReturns.length; j++) {
        const a = assetReturns[i]!;
        const b = assetReturns[j]!;
        const corr = pearsonCorrelation(a.returns, b.returns);
        if (corr === null) continue;

        if (corr >= this.config.correlationCritical) {
          alerts.push({
            severity: 'critical',
            type: 'Correlation Risk',
            message: `${a.symbol} and ${b.symbol} have ${(corr * 100).toFixed(0)}% correlation — near-identical movement`,
            recommendation: `Holding both ${a.symbol} and ${b.symbol} provides minimal diversification. Consider replacing one`,
            metadata: { symbolA: a.symbol, symbolB: b.symbol, correlation: corr },
          });
        } else if (corr >= this.config.correlationWarning) {
          alerts.push({
            severity: 'warning',
            type: 'Correlation Risk',
            message: `${a.symbol} and ${b.symbol} have ${(corr * 100).toFixed(0)}% correlation`,
            recommendation: `High correlation reduces diversification benefit. Monitor for divergence`,
            metadata: { symbolA: a.symbol, symbolB: b.symbol, correlation: corr },
          });
        }
      }
    }

    return alerts;
  }

  // ============================================================================
  // Alert Pushing
  // ============================================================================

  private pushAlerts(alerts: RiskAlert[]): void {
    if (!this.notifier) return;

    const pushable = alerts.filter((a) => a.severity === 'critical' || a.severity === 'warning');

    for (const alert of pushable) {
      this.notifier.sendRiskAlert({
        type: 'risk_alert',
        alertType: `AI Risk Advisor: ${alert.type}`,
        severity: alert.severity as 'warning' | 'critical',
        details: alert.message,
        recommendedAction: alert.recommendation,
      }).catch(() => {
        // Non-fatal: notification failure should never break risk analysis
      });
    }
  }
}

// ============================================================================
// Statistical Helpers
// ============================================================================

/** Calculate Z-score: how many standard deviations value is from the mean. */
export function calculateZScore(value: number, history: number[]): number {
  if (history.length === 0) return 0;

  const mean = history.reduce((s, v) => s + v, 0) / history.length;
  const variance = history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return value === mean ? 0 : Infinity;
  return (value - mean) / stdDev;
}

/** Pearson correlation coefficient between two arrays. Returns null if insufficient data. */
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i]!;
    const y = ys[i]!;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  if (denominator === 0) return null;

  return (n * sumXY - sumX * sumY) / denominator;
}

// ============================================================================
// Formatting Helpers
// ============================================================================

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function pctSigned(ratio: number): string {
  const sign = ratio >= 0 ? '+' : '';
  return `${sign}${(ratio * 100).toFixed(3)}%`;
}

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

// ============================================================================
// Singleton
// ============================================================================

let _advisor: AIRiskAdvisor | null = null;

export function getAIRiskAdvisor(): AIRiskAdvisor {
  if (!_advisor) _advisor = new AIRiskAdvisor();
  return _advisor;
}

export function __setAIRiskAdvisor(advisor: AIRiskAdvisor | null): void {
  _advisor = advisor;
}

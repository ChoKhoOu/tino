import { existsSync, readFileSync } from 'fs';

const RISK_FILE = '.tino/risk.json';

export interface RiskConfig {
  maxPositionSize: Record<string, number>;
  maxGrossExposure: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  maxOrderRate: number;
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxPositionSize: { 'BTCUSDT': 1.0, 'ETHUSDT': 10.0, '*': 100.0 },
  maxGrossExposure: 10_000,
  maxDailyLoss: 500,
  maxDrawdown: 0.15,
  maxOrderRate: 10,
};

export function loadRiskConfig(): RiskConfig {
  if (!existsSync(RISK_FILE)) {
    return { ...DEFAULT_RISK_CONFIG };
  }

  try {
    const content = readFileSync(RISK_FILE, 'utf-8');
    const parsed = JSON.parse(content);

    return {
      maxPositionSize: parsed.maxPositionSize ?? DEFAULT_RISK_CONFIG.maxPositionSize,
      maxGrossExposure: parsed.maxGrossExposure ?? DEFAULT_RISK_CONFIG.maxGrossExposure,
      maxDailyLoss: parsed.maxDailyLoss ?? DEFAULT_RISK_CONFIG.maxDailyLoss,
      maxDrawdown: parsed.maxDrawdown ?? DEFAULT_RISK_CONFIG.maxDrawdown,
      maxOrderRate: parsed.maxOrderRate ?? DEFAULT_RISK_CONFIG.maxOrderRate,
    };
  } catch {
    return { ...DEFAULT_RISK_CONFIG };
  }
}

export function defaultRiskJson(): string {
  return JSON.stringify(DEFAULT_RISK_CONFIG, null, 2);
}

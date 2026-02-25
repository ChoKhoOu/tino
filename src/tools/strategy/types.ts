export type StrategyType = 'trend' | 'mean_reversion' | 'momentum' | 'grid' | 'arbitrage';

export interface StrategyParameterSpec {
  default: number;
  min?: number;
  max?: number;
}

export interface StrategyGenerationRequest {
  description: string;
  instrument: string;
  timeframe: string;
  strategyType?: StrategyType;
  parameters?: Record<string, StrategyParameterSpec>;
}

export interface StrategyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SuggestedBacktest {
  instrument: string;
  timeframe: string;
  startDate: string;
  endDate: string;
}

export interface StrategyGenerationResult {
  code: string;
  className: string;
  suggestedPath: string;
  validation: StrategyValidationResult;
  parameters: Record<string, StrategyParameterSpec>;
  templateUsed?: string;
  suggestedBacktest?: SuggestedBacktest;
}

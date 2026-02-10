export interface StrategyParameterSpec {
  default: number;
  min?: number;
  max?: number;
}

export interface StrategyGenerationRequest {
  description: string;
  instrument: string;
  timeframe: string;
  parameters?: Record<string, StrategyParameterSpec>;
}

export interface StrategyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface StrategyGenerationResult {
  code: string;
  className: string;
  suggestedPath: string;
  validation: StrategyValidationResult;
  parameters: Record<string, StrategyParameterSpec>;
}

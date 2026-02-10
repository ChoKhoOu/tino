import { afterEach, describe, expect, test } from 'bun:test';
import {
  __resetStrategyGeneratorDependencies,
  __setStrategyGeneratorDependencies,
  generateStrategyCode,
} from '../../tools/strategy/generator.js';
import { extractStrategyClassName, validateStrategyCode } from '../../tools/strategy/validator.js';
import type { StrategyGenerationRequest } from '../../tools/strategy/types.js';

const VALID_STRATEGY_CODE = `
from nautilus_trader.trading import Strategy

class MomentumBreakoutStrategy(Strategy):
    def on_start(self):
        self.started = True

    def on_bar(self, bar):
        if self.started:
            return
`;

afterEach(() => {
  __resetStrategyGeneratorDependencies();
});

describe('strategy generation + validation integration', () => {
  test('validateStrategyCode accepts complete valid strategy', () => {
    const result = validateStrategyCode(VALID_STRATEGY_CODE);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  test('validateStrategyCode rejects dangerous imports with specific errors', () => {
    const unsafe = `
import os
from subprocess import Popen

class UnsafeStrategy(Strategy):
    def on_start(self):
        pass

    def on_bar(self, bar):
        return
`;

    const result = validateStrategyCode(unsafe);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Dangerous import detected: os');
    expect(result.errors).toContain('Dangerous import detected: subprocess');
  });

  test('extractStrategyClassName extracts strategy class name', () => {
    const className = extractStrategyClassName(VALID_STRATEGY_CODE);
    expect(className).toBe('MomentumBreakoutStrategy');
  });

  test('full flow generates request, validates code, extracts class, and suggests path', async () => {
    const request: StrategyGenerationRequest = {
      description: 'Momentum breakout strategy with simple stop-loss',
      instrument: 'AAPL.XNAS',
      timeframe: '1-DAY',
      parameters: {
        lookback: { default: 20, min: 5, max: 100 },
      },
    };

    __setStrategyGeneratorDependencies({
      callLlm: async () => ({ response: VALID_STRATEGY_CODE }),
    });

    const generated = await generateStrategyCode(request, 'gpt-5.2');
    const validation = validateStrategyCode(generated.code);
    const extracted = extractStrategyClassName(generated.code);

    expect(generated.validation.valid).toBe(true);
    expect(validation.valid).toBe(true);
    expect(extracted).toBe('MomentumBreakoutStrategy');
    expect(generated.className).toBe('MomentumBreakoutStrategy');
    expect(generated.suggestedPath).toBe('strategies/momentum_breakout_strategy.py');
  });
});

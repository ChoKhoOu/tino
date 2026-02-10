import { afterEach, describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { createStrategyTool } from './strategy-tool.js';
import {
  __resetStrategyGeneratorDependencies,
  __setStrategyGeneratorDependencies,
} from './generator.js';
import { extractStrategyClassName, validateStrategyCode } from './validator.js';

const VALID_STRATEGY_CODE = `
from nautilus_trader.trading import Strategy

class EmaCrossoverStrategy(Strategy):
    def on_start(self):
        self.ready = True

    def on_bar(self, bar):
        if self.ready:
            return
`;

afterEach(() => {
  __resetStrategyGeneratorDependencies();
});

describe('strategy validator', () => {
  test('valid strategy code passes validation', () => {
    const result = validateStrategyCode(VALID_STRATEGY_CODE);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects import os', () => {
    const result = validateStrategyCode('import os\n\nclass S(Strategy):\n    def on_start(self): pass\n    def on_bar(self, bar): pass');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('os'))).toBe(true);
  });

  test('rejects import subprocess', () => {
    const result = validateStrategyCode('import subprocess\n\nclass S(Strategy):\n    def on_start(self): pass\n    def on_bar(self, bar): pass');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('subprocess'))).toBe(true);
  });

  test('rejects from socket import', () => {
    const result = validateStrategyCode('from socket import socket\n\nclass S(Strategy):\n    def on_start(self): pass\n    def on_bar(self, bar): pass');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('socket'))).toBe(true);
  });

  test('rejects exec usage', () => {
    const result = validateStrategyCode('class S(Strategy):\n    def on_start(self):\n        exec("print(1)")\n    def on_bar(self, bar): pass');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exec'))).toBe(true);
  });

  test('rejects eval usage', () => {
    const result = validateStrategyCode('class S(Strategy):\n    def on_start(self):\n        eval("1+1")\n    def on_bar(self, bar): pass');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('eval'))).toBe(true);
  });

  test('rejects __import__ usage', () => {
    const result = validateStrategyCode('class S(Strategy):\n    def on_start(self):\n        __import__("os")\n    def on_bar(self, bar): pass');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('__import__'))).toBe(true);
  });

  test('detects missing Strategy inheritance', () => {
    const result = validateStrategyCode('class NotAStrategy(object):\n    def on_start(self): pass\n    def on_bar(self, bar): pass');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('extends Strategy'))).toBe(true);
  });

  test('warns when on_start is missing', () => {
    const result = validateStrategyCode('class S(Strategy):\n    def on_bar(self, bar):\n        return');
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('on_start'))).toBe(true);
  });

  test('warns when on_bar is missing', () => {
    const result = validateStrategyCode('class S(Strategy):\n    def on_start(self):\n        return');
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('on_bar'))).toBe(true);
  });

  test('extracts strategy class name', () => {
    const className = extractStrategyClassName(VALID_STRATEGY_CODE);
    expect(className).toBe('EmaCrossoverStrategy');
  });

  test('captures multiple dangerous imports', () => {
    const code = `
import os
import subprocess
from socket import socket

class S(Strategy):
    def on_start(self):
        return

    def on_bar(self, bar):
        return
`;
    const result = validateStrategyCode(code);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('os'))).toBe(true);
    expect(result.errors.some((e) => e.includes('subprocess'))).toBe(true);
    expect(result.errors.some((e) => e.includes('socket'))).toBe(true);
  });
});

describe('strategy tool', () => {
  test('has correct tool name and schema', () => {
    const tool = createStrategyTool('gpt-5.2');
    expect(tool.name).toBe('strategy_gen');

    const schema = tool.schema as z.ZodType<{
      description: string;
      instrument?: string;
      timeframe?: string;
    }>;

    expect(schema.safeParse({ description: 'Generate EMA crossover strategy' }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  test('returns formatted result with generated strategy', async () => {
    __setStrategyGeneratorDependencies({
      callLlm: async () => ({ response: VALID_STRATEGY_CODE }),
    });

    const tool = createStrategyTool('gpt-5.2');
    const raw = await tool.invoke({
      description: 'Generate a simple EMA crossover strategy',
      instrument: 'AAPL',
      timeframe: '1-DAY',
    });

    const parsed = JSON.parse(raw as string) as {
      data: {
        validation: { valid: boolean };
        className: string;
        suggestedPath: string;
      };
    };

    expect(parsed.data.validation.valid).toBe(true);
    expect(parsed.data.className).toBe('EmaCrossoverStrategy');
    expect(parsed.data.suggestedPath).toBe('strategies/ema_crossover_strategy.py');
  });

  test('retries once when first generation fails safety checks', async () => {
    let calls = 0;
    __setStrategyGeneratorDependencies({
      callLlm: async () => {
        calls += 1;
        if (calls === 1) {
          return { response: 'import os\n\nclass Bad(Strategy):\n    def on_start(self): pass\n    def on_bar(self, bar): pass' };
        }
        return { response: VALID_STRATEGY_CODE };
      },
    });

    const tool = createStrategyTool('gpt-5.2');
    const raw = await tool.invoke({
      description: 'Generate a safe strategy with risk management',
    });
    const parsed = JSON.parse(raw as string) as {
      data: {
        validation: { valid: boolean };
      };
    };

    expect(calls).toBe(2);
    expect(parsed.data.validation.valid).toBe(true);
  });
});

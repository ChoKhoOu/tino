import { describe, test, expect, beforeEach, mock } from 'bun:test';
import type { ToolContext } from '@/domain/index.js';
import plugin from '../strategy-lab.tool.js';

const VALID_STRATEGY = `
from nautilus_trader.trading import Strategy

class MyMomentumStrategy(Strategy):
    def on_start(self):
        pass

    def on_bar(self, bar):
        pass
`;

const DANGEROUS_STRATEGY = `
import os
import subprocess
from nautilus_trader.trading import Strategy

class BadStrategy(Strategy):
    def on_start(self):
        os.system("rm -rf /")

    def on_bar(self, bar):
        exec("print('hacked')")
`;

function makeBrokerMock(returnCode: string) {
  return {
    getModel: mock(() => 'mock-model'),
    generateText: mock(async () => ({ text: returnCode })),
  };
}

function makeCtx(broker?: unknown): ToolContext {
  return {
    signal: new AbortController().signal,
    onProgress: () => {},
    config: broker ? { broker } : {},
  };
}

describe('strategy_lab consolidated tool', () => {
  test('has correct id, domain, and riskLevel', () => {
    expect(plugin.id).toBe('strategy_lab');
    expect(plugin.domain).toBe('strategy');
    expect(plugin.riskLevel).toBe('moderate');
  });

  describe('generate action', () => {
    test('calls broker.generateText with strategy prompt', async () => {
      const broker = makeBrokerMock(VALID_STRATEGY);
      const ctx = makeCtx(broker);

      const raw = await plugin.execute(
        { action: 'generate', description: 'A momentum strategy for AAPL' },
        ctx,
      );
      const result = JSON.parse(raw);

      expect(broker.generateText).toHaveBeenCalled();
      expect(broker.getModel).toHaveBeenCalledWith('reason');
      expect(result.data.code).toContain('MyMomentumStrategy');
      expect(result.data.validation.valid).toBe(true);
    });

    test('returns error when broker is not available', async () => {
      const ctx = makeCtx(); // no broker
      const raw = await plugin.execute(
        { action: 'generate', description: 'A strategy' },
        ctx,
      );
      const result = JSON.parse(raw);
      expect(result.error || result.data?.error).toBeTruthy();
    });

    test('retries generation when first attempt fails validation', async () => {
      const badCode = 'class Foo:\n    pass'; // no Strategy base
      const broker = makeBrokerMock(badCode);
      // Second call returns valid code
      broker.generateText
        .mockResolvedValueOnce({ text: badCode })
        .mockResolvedValueOnce({ text: VALID_STRATEGY });

      const ctx = makeCtx(broker);
      const raw = await plugin.execute(
        { action: 'generate', description: 'A strategy' },
        ctx,
      );
      const result = JSON.parse(raw);

      // Should have been called twice (initial + retry)
      expect(broker.generateText).toHaveBeenCalledTimes(2);
      expect(result.data.code).toContain('MyMomentumStrategy');
    });

    test('includes instrument and constraints in prompt', async () => {
      const broker = makeBrokerMock(VALID_STRATEGY);
      const ctx = makeCtx(broker);

      await plugin.execute(
        {
          action: 'generate',
          description: 'Momentum strategy',
          instrument: 'BTCUSDT',
          constraints: 'max drawdown 10%',
        },
        ctx,
      );

      const calls = broker.generateText.mock.calls;
      const callArgs = (calls[0] as unknown as [{ prompt: string }])[0];
      expect(callArgs.prompt).toContain('BTCUSDT');
      expect(callArgs.prompt).toContain('max drawdown 10%');
    });
  });

  describe('validate action', () => {
    test('validates correct strategy code as valid', async () => {
      const ctx = makeCtx();
      const raw = await plugin.execute(
        { action: 'validate', code: VALID_STRATEGY },
        ctx,
      );
      const result = JSON.parse(raw);

      expect(result.data.validation.valid).toBe(true);
      expect(result.data.validation.errors).toHaveLength(0);
    });

    test('catches forbidden imports and exec patterns', async () => {
      const ctx = makeCtx();
      const raw = await plugin.execute(
        { action: 'validate', code: DANGEROUS_STRATEGY },
        ctx,
      );
      const result = JSON.parse(raw);

      expect(result.data.validation.valid).toBe(false);
      expect(result.data.validation.errors.length).toBeGreaterThan(0);
      // Should detect os, subprocess, and exec()
      const errorText = result.data.validation.errors.join(' ');
      expect(errorText).toContain('os');
      expect(errorText).toContain('subprocess');
      expect(errorText).toContain('exec()');
    });

    test('returns error when code is missing', async () => {
      const ctx = makeCtx();
      const raw = await plugin.execute(
        { action: 'validate' },
        ctx,
      );
      const result = JSON.parse(raw);
      expect(result.error).toBeTruthy();
    });
  });
});

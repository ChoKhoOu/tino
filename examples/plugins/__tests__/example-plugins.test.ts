import { describe, test, expect } from 'bun:test';

/**
 * Validates that the example plugins conform to the ToolPlugin interface
 * and can be loaded by Tino's plugin discovery system.
 *
 * This file lives outside src/ so tsc doesn't include it,
 * but bun test discovers it automatically.
 */

function isValidPlugin(
  value: unknown,
): value is { id: string; schema: unknown; execute: Function } {
  if (value == null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.schema !== 'undefined' &&
    typeof obj.execute === 'function'
  );
}

const VALID_RISK_LEVELS = ['safe', 'moderate', 'dangerous'];

function assertPluginShape(plugin: Record<string, unknown>) {
  expect(typeof plugin.id).toBe('string');
  expect(typeof plugin.domain).toBe('string');
  expect(VALID_RISK_LEVELS).toContain(plugin.riskLevel as string);
  expect(typeof plugin.description).toBe('string');
  expect(plugin.description).not.toBe('');
  expect(plugin.schema).toBeDefined();
  expect(typeof plugin.execute).toBe('function');
}

describe('data-source-example (fear_greed_index)', () => {
  let plugin: Record<string, unknown>;

  test('can be dynamically imported', async () => {
    const mod = await import('../data-source-example/index.ts');
    plugin = mod.default ?? mod;
    expect(plugin).toBeDefined();
  });

  test('passes Tino plugin validation', async () => {
    const mod = await import('../data-source-example/index.ts');
    plugin = mod.default ?? mod;
    expect(isValidPlugin(plugin)).toBe(true);
  });

  test('has correct plugin shape', async () => {
    const mod = await import('../data-source-example/index.ts');
    plugin = mod.default ?? mod;
    assertPluginShape(plugin);
    expect(plugin.id).toBe('fear_greed_index');
    expect(plugin.domain).toBe('finance');
    expect(plugin.riskLevel).toBe('safe');
  });

  test('schema validates correct input', async () => {
    const mod = await import('../data-source-example/index.ts');
    plugin = mod.default ?? mod;
    const schema = plugin.schema as { parse: (v: unknown) => unknown };
    expect(() => schema.parse({ action: 'current' })).not.toThrow();
    expect(() => schema.parse({ action: 'history', limit: 30 })).not.toThrow();
  });

  test('schema rejects invalid input', async () => {
    const mod = await import('../data-source-example/index.ts');
    plugin = mod.default ?? mod;
    const schema = plugin.schema as { parse: (v: unknown) => unknown };
    expect(() => schema.parse({})).toThrow();
    expect(() => schema.parse({ action: 'invalid' })).toThrow();
  });
});

describe('strategy-example (technical_indicators)', () => {
  let plugin: Record<string, unknown>;

  test('can be dynamically imported', async () => {
    const mod = await import('../strategy-example/index.ts');
    plugin = mod.default ?? mod;
    expect(plugin).toBeDefined();
  });

  test('passes Tino plugin validation', async () => {
    const mod = await import('../strategy-example/index.ts');
    plugin = mod.default ?? mod;
    expect(isValidPlugin(plugin)).toBe(true);
  });

  test('has correct plugin shape', async () => {
    const mod = await import('../strategy-example/index.ts');
    plugin = mod.default ?? mod;
    assertPluginShape(plugin);
    expect(plugin.id).toBe('technical_indicators');
    expect(plugin.domain).toBe('finance');
    expect(plugin.riskLevel).toBe('safe');
  });

  test('calculates RSI correctly', async () => {
    const mod = await import('../strategy-example/index.ts');
    plugin = mod.default ?? mod;
    const execute = plugin.execute as (args: unknown) => Promise<string>;
    // Generate a simple uptrend for RSI calculation
    const prices = Array.from({ length: 20 }, (_, i) => 100 + i * 0.5 + Math.sin(i) * 2);
    const result = JSON.parse(await execute({ action: 'rsi', prices, period: 14 }));
    expect(result.indicator).toBe('RSI');
    expect(result.period).toBe(14);
    expect(result.latest).toBeGreaterThan(0);
    expect(result.latest).toBeLessThanOrEqual(100);
    expect(result.values).toBeArray();
    expect(['overbought', 'oversold', 'neutral']).toContain(result.signal);
  });

  test('calculates SMA correctly', async () => {
    const mod = await import('../strategy-example/index.ts');
    plugin = mod.default ?? mod;
    const execute = plugin.execute as (args: unknown) => Promise<string>;
    const prices = [10, 20, 30, 40, 50];
    const result = JSON.parse(await execute({ action: 'sma', prices, period: 3 }));
    expect(result.indicator).toBe('SMA');
    expect(result.values).toEqual([20, 30, 40]);
    expect(result.latest).toBe(40);
  });

  test('calculates EMA correctly', async () => {
    const mod = await import('../strategy-example/index.ts');
    plugin = mod.default ?? mod;
    const execute = plugin.execute as (args: unknown) => Promise<string>;
    const prices = [10, 20, 30, 40, 50];
    const result = JSON.parse(await execute({ action: 'ema', prices, period: 3 }));
    expect(result.indicator).toBe('EMA');
    expect(result.values).toBeArray();
    expect(result.values.length).toBe(3);
  });

  test('calculates Bollinger Bands correctly', async () => {
    const mod = await import('../strategy-example/index.ts');
    plugin = mod.default ?? mod;
    const execute = plugin.execute as (args: unknown) => Promise<string>;
    const prices = Array.from({ length: 25 }, (_, i) => 100 + i);
    const result = JSON.parse(await execute({ action: 'bollinger_bands', prices, period: 20 }));
    expect(result.indicator).toBe('Bollinger Bands');
    expect(result.middle).toBeArray();
    expect(result.upper).toBeArray();
    expect(result.lower).toBeArray();
    // Upper band should always be above middle, lower below
    for (let i = 0; i < result.middle.length; i++) {
      expect(result.upper[i]).toBeGreaterThanOrEqual(result.middle[i]);
      expect(result.lower[i]).toBeLessThanOrEqual(result.middle[i]);
    }
  });

  test('returns error for insufficient data', async () => {
    const mod = await import('../strategy-example/index.ts');
    plugin = mod.default ?? mod;
    const execute = plugin.execute as (args: unknown) => Promise<string>;
    const result = JSON.parse(await execute({ action: 'rsi', prices: [10, 20], period: 14 }));
    expect(result.error).toContain('requires at least');
  });

  test('schema rejects invalid input', async () => {
    const mod = await import('../strategy-example/index.ts');
    plugin = mod.default ?? mod;
    const schema = plugin.schema as { parse: (v: unknown) => unknown };
    expect(() => schema.parse({})).toThrow();
    expect(() => schema.parse({ action: 'rsi' })).toThrow(); // missing prices
    expect(() => schema.parse({ action: 'invalid', prices: [1, 2] })).toThrow();
  });
});

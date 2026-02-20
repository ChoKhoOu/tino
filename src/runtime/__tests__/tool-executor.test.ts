import { describe, test, expect } from 'bun:test';
import { executeToolCall } from '../tool-executor.js';
import type { ToolRegistry } from '../tool-registry.js';
import type { ToolContext } from '@/domain/index.js';

function makeCtx(): ToolContext {
  return {
    signal: new AbortController().signal,
    sessionDir: '/tmp/test',
    projectDir: '/tmp/test',
    onProgress: () => {},
    config: {},
  } as unknown as ToolContext;
}

function makeMockRegistry(toolId: string, executeFn: () => Promise<string>): ToolRegistry {
  return {
    get(id: string) {
      if (id === toolId) {
        return { id: toolId, execute: executeFn };
      }
      return undefined;
    },
  } as unknown as ToolRegistry;
}

describe('executeToolCall', () => {
  test('returns error for unknown tool', async () => {
    const registry = { get: () => undefined } as unknown as ToolRegistry;
    const result = await executeToolCall(registry, 'nonexistent', {}, makeCtx());
    expect(result.result).toContain('unknown tool');
  });

  test('executes tool and returns result', async () => {
    const registry = makeMockRegistry('test-tool', async () => 'success');
    const result = await executeToolCall(registry, 'test-tool', {}, makeCtx());
    expect(result.result).toBe('success');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  test('catches tool errors as strings', async () => {
    const registry = makeMockRegistry('test-tool', async () => {
      throw new Error('tool failed');
    });
    const result = await executeToolCall(registry, 'test-tool', {}, makeCtx());
    expect(result.result).toContain('tool failed');
  });

  test('trading tools get 60s timeout (does not timeout fast execution)', async () => {
    const registry = makeMockRegistry('trading-sim', async () => {
      return 'trade executed';
    });
    const result = await executeToolCall(registry, 'trading-sim', {}, makeCtx());
    expect(result.result).toBe('trade executed');
  });

  test('backtest tools get 300s timeout (does not timeout fast execution)', async () => {
    const registry = makeMockRegistry('backtest', async () => {
      return 'backtest complete';
    });
    const result = await executeToolCall(registry, 'backtest', {}, makeCtx());
    expect(result.result).toBe('backtest complete');
  });
});

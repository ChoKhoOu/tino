import type { ToolContext } from '@/domain/index.js';
import type { ToolRegistry } from './tool-registry.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const TRADING_TIMEOUT_MS = 60_000;
const BACKTEST_TIMEOUT_MS = 300_000;

function getTimeoutForTool(toolId: string): number {
  if (toolId.startsWith('trading')) return TRADING_TIMEOUT_MS;
  if (toolId.startsWith('backtest') || toolId === 'strategy-lab') return BACKTEST_TIMEOUT_MS;
  return DEFAULT_TIMEOUT_MS;
}

export interface ToolCallResult {
  result: string;
  duration: number;
}

export async function executeToolCall(
  registry: ToolRegistry,
  toolId: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolCallResult> {
  const plugin = registry.get(toolId);
  if (!plugin) {
    return { result: `Error: unknown tool "${toolId}"`, duration: 0 };
  }

  const start = performance.now();

  try {
    const timeoutMs = getTimeoutForTool(toolId);
    const timeout = rejectAfterTimeout(timeoutMs, ctx.signal);
    try {
      const result = await Promise.race([
        plugin.execute(args, ctx),
        timeout.promise,
      ]);
      return { result, duration: performance.now() - start };
    } finally {
      timeout.cleanup();
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    return { result: `Error: ${message}`, duration: performance.now() - start };
  }
}

function rejectAfterTimeout(ms: number, signal: AbortSignal): { promise: Promise<never>; cleanup: () => void } {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Tool execution timed out after ${ms}ms`)),
      ms,
    );

    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('Tool execution aborted'));
    }, { once: true });
  });
  return { promise, cleanup: () => clearTimeout(timer!) };
}

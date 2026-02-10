import type { ToolContext } from '@/domain/index.js';
import type { ToolRegistry } from './tool-registry.js';

const DEFAULT_TIMEOUT_MS = 30_000;

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
    const result = await Promise.race([
      plugin.execute(args, ctx),
      rejectAfterTimeout(DEFAULT_TIMEOUT_MS, ctx.signal),
    ]);

    return { result, duration: performance.now() - start };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    return { result: `Error: ${message}`, duration: performance.now() - start };
  }
}

function rejectAfterTimeout(ms: number, signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Tool execution timed out after ${ms}ms`)),
      ms,
    );

    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('Tool execution aborted'));
    }, { once: true });
  });
}

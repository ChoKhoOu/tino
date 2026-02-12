import type { TokenUsage } from '@/domain/index.js';

export const zeroUsage = (): TokenUsage => ({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });

export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export function normalizeUsage(usage: unknown): TokenUsage {
  if (!usage || typeof usage !== 'object') return zeroUsage();
  const u = usage as Record<string, unknown>;
  const input = typeof u.inputTokens === 'number' ? u.inputTokens : (typeof u.promptTokens === 'number' ? u.promptTokens : 0);
  const output = typeof u.outputTokens === 'number' ? u.outputTokens : (typeof u.completionTokens === 'number' ? u.completionTokens : 0);
  const total = typeof u.totalTokens === 'number' ? u.totalTokens : input + output;
  return { inputTokens: input, outputTokens: output, totalTokens: total };
}

export function mergeUsage(total: TokenUsage, delta: TokenUsage): TokenUsage {
  return {
    inputTokens: total.inputTokens + delta.inputTokens,
    outputTokens: total.outputTokens + delta.outputTokens,
    totalTokens: total.totalTokens + delta.totalTokens,
  };
}

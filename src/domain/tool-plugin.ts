import type { z } from 'zod';

export interface ToolContext {
  signal: AbortSignal;
  onProgress: (msg: string) => void;
  config: Record<string, unknown>;
}

export interface ToolPlugin<T extends z.ZodType = z.ZodType> {
  id: string;
  domain: string;
  riskLevel: 'safe' | 'moderate' | 'dangerous';
  description: string;
  schema: T;
  execute: (args: unknown, ctx: ToolContext) => Promise<string>;
}

export function defineToolPlugin<T extends z.ZodType>(
  def: ToolPlugin<T>,
): ToolPlugin<T> {
  return def;
}

export const definePlugin = defineToolPlugin;

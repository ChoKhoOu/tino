/**
 * Zod schemas and derived types for Tino settings.
 *
 * Extracted from settings.ts to keep each module under 200 LOC.
 */
import { z } from 'zod';

export const MODEL_TO_PROVIDER_MAP: Record<string, string> = {
  'gpt-5.2': 'openai',
  'claude-sonnet-4-5': 'anthropic',
  'gemini-3': 'google',
};

export const CustomProviderSchema = z.object({
  baseURL: z.string().url(),
  apiKey: z.string().optional(),
  defaultModel: z.string().optional(),
});

export const ProviderOverrideSchema = z.object({
  baseURL: z.string().url().optional(),
  apiKey: z.string().optional(),
  defaultModel: z.string().optional(),
});

export const GraduationThresholdsSchema = z.object({
  backtestSharpe: z.number().optional(),
  backtestMaxDrawdown: z.number().optional(),
  backtestMinTrades: z.number().optional(),
  paperMinDays: z.number().optional(),
  paperPnlDeviation: z.number().optional(),
  liveMinDays: z.number().optional(),
  liveMaxRiskEvents: z.number().optional(),
}).optional();

export const SettingsSchema = z.object({
  provider: z.string().optional(),
  modelId: z.string().optional(),
  model: z.string().optional(),
  exchange: z.string().optional(),
  defaultPair: z.string().optional(),
  customProviders: z.record(z.string(), CustomProviderSchema).optional(),
  providers: z.record(z.string(), ProviderOverrideSchema).optional(),
  providerOverrides: z.record(z.string(), ProviderOverrideSchema).optional(),
  graduationThresholds: GraduationThresholdsSchema,
}).passthrough(); // Allow additional unknown keys for forward compatibility

export type CustomProviderConfig = z.infer<typeof CustomProviderSchema>;
export type ProviderOverrideConfig = z.infer<typeof ProviderOverrideSchema>;
export type TinoSettings = z.infer<typeof SettingsSchema>;

export interface SettingsData {
  provider?: string;
  modelId?: string;
  model?: string;
  customProviders?: Record<string, CustomProviderConfig>;
  providers?: Record<string, ProviderOverrideConfig>;
  providerOverrides?: Record<string, ProviderOverrideConfig>;
  [key: string]: unknown;
}

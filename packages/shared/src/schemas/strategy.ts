import { z } from 'zod';

export const StrategyParametersSchema = z.record(z.string(), z.unknown());

export const StrategyCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  source_code: z.string().min(1),
  parameters: StrategyParametersSchema.optional().default({}),
});

export const StrategySchema = z.object({
  id: z.string().uuid(),
  version_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  name: z.string(),
  description: z.string().optional(),
  source_code: z.string(),
  parameters: StrategyParametersSchema,
  created_at: z.string().datetime(),
  created_by_session: z.string().optional(),
  parent_version_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/).nullable().optional(),
});

export const StrategyListItemSchema = z.object({
  id: z.string().uuid(),
  version_hash: z.string(),
  name: z.string(),
  created_at: z.string().datetime(),
  backtest_count: z.number().int().nonnegative(),
  live_session_count: z.number().int().nonnegative(),
});

export const StrategyListResponseSchema = z.object({
  items: z.array(StrategyListItemSchema),
  total: z.number().int().nonnegative(),
});

export const StrategyCreateResponseSchema = z.object({
  id: z.string().uuid(),
  version_hash: z.string(),
  name: z.string(),
  created_at: z.string().datetime(),
});

export type Strategy = z.infer<typeof StrategySchema>;
export type StrategyCreate = z.infer<typeof StrategyCreateSchema>;
export type StrategyListItem = z.infer<typeof StrategyListItemSchema>;
export type StrategyListResponse = z.infer<typeof StrategyListResponseSchema>;
export type StrategyCreateResponse = z.infer<typeof StrategyCreateResponseSchema>;

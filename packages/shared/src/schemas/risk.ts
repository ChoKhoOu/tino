import { z } from 'zod';

export const RiskModificationLogEntrySchema = z.object({
  timestamp: z.string().datetime(),
  field: z.string(),
  previous_value: z.unknown(),
  new_value: z.unknown(),
  confirmed_by_session: z.string(),
});

export const RiskProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  max_drawdown_pct: z.number().min(0.01).max(1.0),
  single_order_size_cap: z.number().positive(),
  daily_loss_limit: z.number().positive(),
  max_concurrent_strategies: z.number().int().min(1),
  kill_switch_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  modification_log: z.array(RiskModificationLogEntrySchema).optional(),
});

export const RiskProfileUpdateSchema = z.object({
  max_drawdown_pct: z.number().min(0.01).max(1.0).optional(),
  single_order_size_cap: z.number().positive().optional(),
  daily_loss_limit: z.number().positive().optional(),
  max_concurrent_strategies: z.number().int().min(1).optional(),
  confirmed_by_session: z.string(),
});

export type RiskProfile = z.infer<typeof RiskProfileSchema>;
export type RiskProfileUpdate = z.infer<typeof RiskProfileUpdateSchema>;
export type RiskModificationLogEntry = z.infer<typeof RiskModificationLogEntrySchema>;

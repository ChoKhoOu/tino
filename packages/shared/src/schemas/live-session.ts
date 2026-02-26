import { z } from 'zod';

export const LifecycleStateSchema = z.enum([
  'DEPLOYING',
  'RUNNING',
  'PAUSED',
  'STOPPING',
  'STOPPED',
]);

export const PositionSchema = z.object({
  instrument: z.string(),
  side: z.enum(['LONG', 'SHORT', 'FLAT']),
  quantity: z.string(),
  avg_entry_price: z.string(),
  unrealized_pnl: z.string(),
  realized_pnl: z.string(),
});

export const OrderSchema = z.object({
  id: z.string(),
  side: z.enum(['BUY', 'SELL']),
  type: z.enum(['MARKET', 'LIMIT', 'STOP_MARKET', 'STOP_LIMIT']),
  quantity: z.string(),
  price: z.string().optional(),
  fill_price: z.string().optional(),
  fill_quantity: z.string().optional(),
  status: z.enum(['PENDING', 'SUBMITTED', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'REJECTED']).optional(),
});

export const PauseResumeEntrySchema = z.object({
  action: z.enum(['PAUSE', 'RESUME']),
  timestamp: z.string().datetime(),
  reason: z.string().optional(),
});

export const LiveDeploySchema = z.object({
  strategy_version_hash: z.string(),
  trading_pair: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).optional(),
  risk_profile_id: z.string().uuid(),
  confirmed_by_session: z.string(),
});

export const LiveSessionSchema = z.object({
  id: z.string().uuid(),
  strategy_version_hash: z.string(),
  trading_pair: z.string(),
  exchange: z.string().default('BINANCE'),
  lifecycle_state: LifecycleStateSchema,
  positions: z.array(PositionSchema),
  open_orders: z.array(OrderSchema),
  realized_pnl: z.string(),
  unrealized_pnl: z.string(),
  risk_profile_id: z.string().uuid(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  confirmed_by: z.string(),
  started_at: z.string().datetime(),
  paused_at: z.string().datetime().nullable().optional(),
  stopped_at: z.string().datetime().nullable().optional(),
  pause_resume_history: z.array(PauseResumeEntrySchema).optional(),
});

export const LiveDeployResponseSchema = z.object({
  id: z.string().uuid(),
  lifecycle_state: LifecycleStateSchema,
  ws_url: z.string(),
});

export const KillSwitchResponseSchema = z.object({
  killed_sessions: z.number().int().nonnegative(),
  cancelled_orders: z.number().int().nonnegative(),
  flattened_positions: z.number().int().nonnegative(),
  executed_at: z.string().datetime(),
});

export type LifecycleState = z.infer<typeof LifecycleStateSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type LiveDeploy = z.infer<typeof LiveDeploySchema>;
export type LiveSession = z.infer<typeof LiveSessionSchema>;
export type LiveDeployResponse = z.infer<typeof LiveDeployResponseSchema>;
export type KillSwitchResponse = z.infer<typeof KillSwitchResponseSchema>;

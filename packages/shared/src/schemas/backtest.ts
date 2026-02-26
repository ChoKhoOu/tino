import { z } from 'zod';

export const BacktestStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export const BacktestMetricsSchema = z.object({
  total_pnl: z.string(),
  sharpe_ratio: z.number(),
  sortino_ratio: z.number(),
  win_rate: z.number().min(0).max(1),
  max_drawdown: z.number().min(0).max(1),
  total_trades: z.number().int().nonnegative(),
  avg_trade_pnl: z.string().optional(),
  profit_factor: z.number().nonnegative(),
  max_consecutive_wins: z.number().int().nonnegative().optional(),
  max_consecutive_losses: z.number().int().nonnegative().optional(),
});

export const TradeLogEntrySchema = z.object({
  id: z.string(),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.string(),
  entry_price: z.string(),
  exit_price: z.string(),
  pnl: z.string(),
  entry_time: z.string().datetime(),
  exit_time: z.string().datetime(),
});

export const EquityCurvePointSchema = z.object({
  timestamp: z.string().datetime(),
  equity: z.string(),
});

export const BacktestCreateSchema = z.object({
  strategy_version_hash: z.string(),
  trading_pair: z.string().min(1),
  start_date: z.string(),
  end_date: z.string(),
  bar_type: z.string().default('1-HOUR'),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

export const BacktestRunSchema = z.object({
  id: z.string().uuid(),
  strategy_version_hash: z.string(),
  trading_pair: z.string(),
  exchange: z.string().default('BINANCE'),
  start_date: z.string(),
  end_date: z.string(),
  bar_type: z.string(),
  status: BacktestStatusSchema,
  progress_pct: z.number().min(0).max(100).optional(),
  metrics: BacktestMetricsSchema.nullable().optional(),
  trade_log: z.array(TradeLogEntrySchema).optional(),
  equity_curve: z.array(EquityCurvePointSchema).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  dataset_identifier: z.string().optional(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().nullable().optional(),
  error_message: z.string().nullable().optional(),
});

export const BacktestCreateResponseSchema = z.object({
  id: z.string().uuid(),
  status: BacktestStatusSchema,
  ws_url: z.string(),
});

export type BacktestStatus = z.infer<typeof BacktestStatusSchema>;
export type BacktestMetrics = z.infer<typeof BacktestMetricsSchema>;
export type TradeLogEntry = z.infer<typeof TradeLogEntrySchema>;
export type EquityCurvePoint = z.infer<typeof EquityCurvePointSchema>;
export type BacktestCreate = z.infer<typeof BacktestCreateSchema>;
export type BacktestRun = z.infer<typeof BacktestRunSchema>;
export type BacktestCreateResponse = z.infer<typeof BacktestCreateResponseSchema>;

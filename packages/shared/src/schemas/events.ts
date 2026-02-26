import { z } from 'zod';
import { BacktestMetricsSchema } from './backtest.js';
import { PositionSchema, OrderSchema, LifecycleStateSchema } from './live-session.js';

// Base event envelope
export const EventEnvelopeSchema = z.object({
  type: z.string(),
  timestamp: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()),
});

// Backtest events
export const BacktestProgressEventSchema = z.object({
  type: z.literal('backtest.progress'),
  timestamp: z.string().datetime(),
  payload: z.object({
    backtest_id: z.string().uuid(),
    progress_pct: z.number().min(0).max(100),
    current_date: z.string(),
    trades_so_far: z.number().int().nonnegative(),
    current_pnl: z.string(),
  }),
});

export const BacktestCompletedEventSchema = z.object({
  type: z.literal('backtest.completed'),
  timestamp: z.string().datetime(),
  payload: z.object({
    backtest_id: z.string().uuid(),
    metrics: BacktestMetricsSchema,
  }),
});

export const BacktestFailedEventSchema = z.object({
  type: z.literal('backtest.failed'),
  timestamp: z.string().datetime(),
  payload: z.object({
    backtest_id: z.string().uuid(),
    error: z.string(),
    message: z.string(),
  }),
});

export const BacktestCancelEventSchema = z.object({
  type: z.literal('backtest.cancel'),
  payload: z.object({
    backtest_id: z.string().uuid(),
  }),
});

// Live trading events
export const LiveStateChangeEventSchema = z.object({
  type: z.literal('live.state_change'),
  timestamp: z.string().datetime(),
  payload: z.object({
    session_id: z.string().uuid(),
    previous_state: LifecycleStateSchema,
    current_state: LifecycleStateSchema,
  }),
});

export const LivePositionUpdateEventSchema = z.object({
  type: z.literal('live.position_update'),
  timestamp: z.string().datetime(),
  payload: z.object({
    session_id: z.string().uuid(),
    positions: z.array(PositionSchema),
    total_unrealized_pnl: z.string(),
    total_realized_pnl: z.string(),
  }),
});

export const LiveOrderEventSchema = z.object({
  type: z.literal('live.order_event'),
  timestamp: z.string().datetime(),
  payload: z.object({
    session_id: z.string().uuid(),
    event: z.enum(['SUBMITTED', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'REJECTED']),
    order: OrderSchema,
  }),
});

export const LiveTradeExecutedEventSchema = z.object({
  type: z.literal('live.trade_executed'),
  timestamp: z.string().datetime(),
  payload: z.object({
    session_id: z.string().uuid(),
    trade: z.object({
      id: z.string(),
      side: z.enum(['BUY', 'SELL']),
      quantity: z.string(),
      price: z.string(),
      pnl: z.string().nullable(),
      is_entry: z.boolean(),
    }),
  }),
});

export const LiveRiskAlertEventSchema = z.object({
  type: z.literal('live.risk_alert'),
  timestamp: z.string().datetime(),
  payload: z.object({
    session_id: z.string().uuid(),
    alert_level: z.enum(['WARNING', 'CRITICAL']),
    rule: z.string(),
    message: z.string(),
    action_taken: z.string(),
  }),
});

export const LiveRiskCircuitBreakerEventSchema = z.object({
  type: z.literal('live.risk_circuit_breaker'),
  timestamp: z.string().datetime(),
  payload: z.object({
    session_id: z.string().uuid(),
    rule: z.string(),
    threshold: z.number(),
    actual: z.number(),
    action: z.literal('KILL_SWITCH_TRIGGERED'),
    cancelled_orders: z.number().int().nonnegative(),
    flattened_positions: z.number().int().nonnegative(),
  }),
});

export const LiveErrorEventSchema = z.object({
  type: z.literal('live.error'),
  timestamp: z.string().datetime(),
  payload: z.object({
    session_id: z.string().uuid(),
    error: z.string(),
    message: z.string(),
    severity: z.enum(['WARNING', 'ERROR', 'CRITICAL']),
  }),
});

// Dashboard events
export const DashboardSessionListEventSchema = z.object({
  type: z.literal('dashboard.session_list'),
  timestamp: z.string().datetime(),
  payload: z.object({
    active_backtests: z.array(z.object({
      id: z.string().uuid(),
      strategy_name: z.string(),
      status: z.string(),
      progress_pct: z.number().optional(),
    })),
    active_live_sessions: z.array(z.object({
      id: z.string().uuid(),
      strategy_name: z.string(),
      state: z.string(),
      pnl: z.string(),
    })),
  }),
});

// Heartbeat
export const PingEventSchema = z.object({ type: z.literal('ping') });
export const PongEventSchema = z.object({ type: z.literal('pong') });

// Discriminated union of all server events
export const ServerEventSchema = z.discriminatedUnion('type', [
  BacktestProgressEventSchema,
  BacktestCompletedEventSchema,
  BacktestFailedEventSchema,
  LiveStateChangeEventSchema,
  LivePositionUpdateEventSchema,
  LiveOrderEventSchema,
  LiveTradeExecutedEventSchema,
  LiveRiskAlertEventSchema,
  LiveRiskCircuitBreakerEventSchema,
  LiveErrorEventSchema,
  DashboardSessionListEventSchema,
  PingEventSchema,
]);

// Client events
export const ClientEventSchema = z.discriminatedUnion('type', [
  BacktestCancelEventSchema,
  PongEventSchema,
]);

export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
export type BacktestProgressEvent = z.infer<typeof BacktestProgressEventSchema>;
export type BacktestCompletedEvent = z.infer<typeof BacktestCompletedEventSchema>;
export type BacktestFailedEvent = z.infer<typeof BacktestFailedEventSchema>;
export type LiveStateChangeEvent = z.infer<typeof LiveStateChangeEventSchema>;
export type LivePositionUpdateEvent = z.infer<typeof LivePositionUpdateEventSchema>;
export type LiveOrderEvent = z.infer<typeof LiveOrderEventSchema>;
export type LiveTradeExecutedEvent = z.infer<typeof LiveTradeExecutedEventSchema>;
export type LiveRiskAlertEvent = z.infer<typeof LiveRiskAlertEventSchema>;
export type LiveRiskCircuitBreakerEvent = z.infer<typeof LiveRiskCircuitBreakerEventSchema>;
export type LiveErrorEvent = z.infer<typeof LiveErrorEventSchema>;
export type DashboardSessionListEvent = z.infer<typeof DashboardSessionListEventSchema>;
export type ServerEvent = z.infer<typeof ServerEventSchema>;
export type ClientEvent = z.infer<typeof ClientEventSchema>;

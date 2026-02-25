/**
 * PostToolUse hook that sends Telegram notifications for trading events.
 *
 * Only processes: trading_live (submit_order), trading_sim (backtest complete).
 * Always returns { allow: true } — notifications never block tool execution.
 */

import type { HookDefinition, HookContext } from '@/domain/index.js';
import { TelegramNotifier } from './telegram.js';
import type { TelegramSettings } from './types.js';

export function createNotificationHook(settings: TelegramSettings): HookDefinition {
  const notifier = new TelegramNotifier(settings.botToken, settings.chatId);
  const events = settings.events ?? {};

  return {
    event: 'PostToolUse',
    type: 'function',
    fn: async (ctx: HookContext) => {
      try {
        if (ctx.toolId === 'trading_live' && events.tradeSignals !== false) {
          await handleTradingLive(notifier, ctx);
        } else if (ctx.toolId === 'trading_sim' && events.backtestComplete) {
          await handleTradingSim(notifier, ctx);
        }
      } catch {
        // Non-fatal: notification failures never block
      }
      return { allow: true };
    },
  };
}

async function handleTradingLive(
  notifier: TelegramNotifier,
  ctx: HookContext,
): Promise<void> {
  if (!ctx.result) return;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(ctx.result);
  } catch {
    return;
  }

  const data = (parsed.data ?? parsed) as Record<string, unknown>;
  if (data.status !== 'submitted') return;

  const args = ctx.args ?? {};
  const order = (args.order ?? {}) as Record<string, unknown>;

  await notifier.sendTradeSignal({
    type: 'trade_signal',
    symbol: String(order.instrument ?? ''),
    side: (String(order.side ?? 'buy')) as 'buy' | 'sell',
    price: Number(order.price ?? 0),
    quantity: Number(order.quantity ?? 0),
    venue: String(args.venue ?? 'SIM'),
    orderId: data.orderId ? String(data.orderId) : undefined,
  });
}

async function handleTradingSim(
  notifier: TelegramNotifier,
  ctx: HookContext,
): Promise<void> {
  if (!ctx.result) return;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(ctx.result);
  } catch {
    return;
  }

  const data = (parsed.data ?? parsed) as Record<string, unknown>;
  if (data.status !== 'completed' || !data.result) return;

  const result = data.result as Record<string, unknown>;
  const args = ctx.args ?? {};

  await notifier.sendBacktestResult({
    type: 'backtest_result',
    strategyName: String(args.strategy_file ?? 'unknown'),
    totalReturn: Number(result.totalReturn ?? 0),
    sharpeRatio: Number(result.sharpeRatio ?? 0),
    maxDrawdown: Number(result.maxDrawdown ?? 0),
    totalTrades: result.totalTrades !== undefined ? Number(result.totalTrades) : undefined,
    winRate: result.winRate !== undefined ? Number(result.winRate) : undefined,
  });
}

export { TelegramNotifier } from './telegram.js';
export { createNotificationHook } from './notification-hook.js';
export type {
  TradeSignalEvent,
  PnLReportEvent,
  RiskAlertEvent,
  BacktestResultEvent,
  NotificationEvent,
  TelegramSettings,
} from './types.js';

import { TelegramNotifier } from './telegram.js';
import type { TelegramSettings } from './types.js';

export function createNotifier(settings: TelegramSettings): TelegramNotifier | null {
  if (!settings.enabled || !settings.botToken || !settings.chatId) {
    return null;
  }
  return new TelegramNotifier(settings.botToken, settings.chatId);
}

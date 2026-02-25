/**
 * Notification event types for Telegram integration.
 */

export interface TradeSignalEvent {
  type: 'trade_signal';
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  venue: string;
  orderId?: string;
}

export interface PnLReportEvent {
  type: 'pnl_report';
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  openPositions: number;
}

export interface RiskAlertEvent {
  type: 'risk_alert';
  alertType: string;
  severity: 'warning' | 'critical';
  details: string;
  recommendedAction: string;
}

export interface BacktestResultEvent {
  type: 'backtest_result';
  strategyName: string;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades?: number;
  winRate?: number;
}

export type NotificationEvent =
  | TradeSignalEvent
  | PnLReportEvent
  | RiskAlertEvent
  | BacktestResultEvent;

export interface TelegramSettings {
  botToken: string;
  chatId: string;
  enabled: boolean;
  events: {
    tradeSignals: boolean;
    pnlReports: boolean;
    riskAlerts: boolean;
    backtestComplete: boolean;
  };
  pnlReportInterval: 'hourly' | 'daily';
}

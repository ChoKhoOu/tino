/**
 * Telegram Bot API notifier for trading signals, PnL reports, and risk alerts.
 *
 * Security: bot token is never included in error messages or logs.
 * Resilience: all public methods return boolean and never throw.
 */

import type {
  TradeSignalEvent,
  PnLReportEvent,
  RiskAlertEvent,
  BacktestResultEvent,
} from './types.js';

function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function formatNumber(n: number, decimals = 2): string {
  return escapeMarkdownV2(n.toFixed(decimals));
}

function formatPercent(n: number): string {
  return escapeMarkdownV2((n * 100).toFixed(2) + '%');
}

export class TelegramNotifier {
  private readonly apiBase: string;
  private readonly chatId: string;

  constructor(botToken: string, chatId: string) {
    this.apiBase = `https://api.telegram.org/bot${botToken}/sendMessage`;
    this.chatId = chatId;
  }

  async sendMessage(
    text: string,
    parseMode: 'MarkdownV2' | 'HTML' = 'MarkdownV2',
  ): Promise<boolean> {
    try {
      const response = await fetch(this.apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: parseMode,
        }),
      });
      return response.ok;
    } catch {
      // Never throw — notification failures are non-fatal
      return false;
    }
  }

  async sendTradeSignal(signal: TradeSignalEvent): Promise<boolean> {
    const side = signal.side === 'buy' ? '🟢 BUY' : '🔴 SELL';
    const text = [
      `*${escapeMarkdownV2(side)}* ${escapeMarkdownV2(signal.symbol)}`,
      '',
      `Price: ${formatNumber(signal.price, 4)}`,
      `Quantity: ${formatNumber(signal.quantity, 6)}`,
      `Venue: ${escapeMarkdownV2(signal.venue)}`,
      signal.orderId ? `Order ID: ${escapeMarkdownV2(signal.orderId)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return this.sendMessage(text);
  }

  async sendPnLReport(report: PnLReportEvent): Promise<boolean> {
    const text = [
      '*📊 PnL Report*',
      '',
      `Total Return: ${formatPercent(report.totalReturn)}`,
      `Sharpe Ratio: ${formatNumber(report.sharpeRatio)}`,
      `Max Drawdown: ${formatPercent(report.maxDrawdown)}`,
      `Open Positions: ${escapeMarkdownV2(String(report.openPositions))}`,
    ].join('\n');

    return this.sendMessage(text);
  }

  async sendRiskAlert(alert: RiskAlertEvent): Promise<boolean> {
    const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
    const text = [
      `*${icon} Risk Alert \\- ${escapeMarkdownV2(alert.alertType)}*`,
      '',
      `Severity: ${escapeMarkdownV2(alert.severity.toUpperCase())}`,
      `Details: ${escapeMarkdownV2(alert.details)}`,
      `Action: ${escapeMarkdownV2(alert.recommendedAction)}`,
    ].join('\n');

    return this.sendMessage(text);
  }

  async sendBacktestResult(result: BacktestResultEvent): Promise<boolean> {
    const lines = [
      `*🧪 Backtest Complete \\- ${escapeMarkdownV2(result.strategyName)}*`,
      '',
      `Total Return: ${formatPercent(result.totalReturn)}`,
      `Sharpe Ratio: ${formatNumber(result.sharpeRatio)}`,
      `Max Drawdown: ${formatPercent(result.maxDrawdown)}`,
    ];

    if (result.totalTrades !== undefined) {
      lines.push(`Total Trades: ${escapeMarkdownV2(String(result.totalTrades))}`);
    }
    if (result.winRate !== undefined) {
      lines.push(`Win Rate: ${formatPercent(result.winRate)}`);
    }

    return this.sendMessage(lines.join('\n'));
  }
}

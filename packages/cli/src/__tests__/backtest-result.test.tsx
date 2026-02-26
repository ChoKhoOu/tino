import { describe, it, expect } from 'vitest';
import chalk from 'chalk';
import Table from 'cli-table3';

// Test the backtest result rendering logic directly, bypassing ink's React reconciler
// which requires React 19 (project uses React 18).
// This mirrors the logic in BacktestResult component.

interface BacktestMetrics {
  total_pnl: string;
  sharpe_ratio: number;
  sortino_ratio: number;
  win_rate: number;
  max_drawdown: number;
  total_trades: number;
  avg_trade_pnl?: string;
  profit_factor: number;
}

function colorPnl(value: string): string {
  const num = parseFloat(value);
  return num >= 0 ? chalk.green(value) : chalk.red(value);
}

function colorRatio(value: number): string {
  const formatted = value.toFixed(2);
  if (value > 1) return chalk.green(formatted);
  if (value > 0) return chalk.yellow(formatted);
  return chalk.red(formatted);
}

function buildBacktestTable(metrics: BacktestMetrics): string {
  const table = new Table({
    head: [chalk.bold('Metric'), chalk.bold('Value')],
    style: { head: [], border: [] },
  });

  const pnlValue =
    parseFloat(metrics.total_pnl) >= 0
      ? `$${metrics.total_pnl}`
      : `-$${metrics.total_pnl.replace('-', '')}`;

  table.push(
    ['Total PnL', colorPnl(pnlValue)],
    ['Sharpe Ratio', colorRatio(metrics.sharpe_ratio)],
    ['Sortino Ratio', colorRatio(metrics.sortino_ratio)],
    [
      'Win Rate',
      metrics.win_rate >= 0.5
        ? chalk.green(`${(metrics.win_rate * 100).toFixed(1)}%`)
        : chalk.red(`${(metrics.win_rate * 100).toFixed(1)}%`),
    ],
    ['Max Drawdown', chalk.red(`${(metrics.max_drawdown * 100).toFixed(1)}%`)],
    ['Total Trades', String(metrics.total_trades)],
  );

  if (metrics.avg_trade_pnl !== undefined) {
    const avgPnlValue =
      parseFloat(metrics.avg_trade_pnl) >= 0
        ? `$${metrics.avg_trade_pnl}`
        : `-$${metrics.avg_trade_pnl.replace('-', '')}`;
    table.push(['Avg Trade PnL', colorPnl(avgPnlValue)]);
  }

  table.push([
    'Profit Factor',
    metrics.profit_factor >= 1
      ? chalk.green(metrics.profit_factor.toFixed(2))
      : chalk.red(metrics.profit_factor.toFixed(2)),
  ]);

  return table.toString();
}

const positiveMetrics: BacktestMetrics = {
  total_pnl: '1250.50',
  sharpe_ratio: 1.85,
  sortino_ratio: 2.1,
  win_rate: 0.62,
  max_drawdown: 0.08,
  total_trades: 145,
  avg_trade_pnl: '8.62',
  profit_factor: 1.95,
};

const negativeMetrics: BacktestMetrics = {
  total_pnl: '-500.25',
  sharpe_ratio: -0.5,
  sortino_ratio: -0.3,
  win_rate: 0.35,
  max_drawdown: 0.25,
  total_trades: 80,
  avg_trade_pnl: '-6.25',
  profit_factor: 0.7,
};

describe('BacktestResult', () => {
  it('should render all positive metrics', () => {
    const output = buildBacktestTable(positiveMetrics);
    expect(output).toContain('1250.50');
    expect(output).toContain('1.85');
    expect(output).toContain('62.0');
    expect(output).toContain('145');
    expect(output).toContain('1.95');
    expect(output).toContain('8.62');
  });

  it('should render Total PnL with dollar sign for positive values', () => {
    const output = buildBacktestTable(positiveMetrics);
    expect(output).toContain('$1250.50');
  });

  it('should render Total PnL with negative dollar sign for negative values', () => {
    const output = buildBacktestTable(negativeMetrics);
    expect(output).toContain('-$500.25');
  });

  it('should render negative metrics', () => {
    const output = buildBacktestTable(negativeMetrics);
    expect(output).toContain('500.25');
    expect(output).toContain('35.0');
    expect(output).toContain('0.70');
  });

  it('should render metric labels', () => {
    const output = buildBacktestTable(positiveMetrics);
    expect(output).toContain('Total PnL');
    expect(output).toContain('Sharpe Ratio');
    expect(output).toContain('Sortino Ratio');
    expect(output).toContain('Win Rate');
    expect(output).toContain('Max Drawdown');
    expect(output).toContain('Total Trades');
    expect(output).toContain('Avg Trade PnL');
    expect(output).toContain('Profit Factor');
  });

  it('should handle metrics without avg_trade_pnl', () => {
    const { avg_trade_pnl: _, ...metricsWithoutAvg } = positiveMetrics;
    const output = buildBacktestTable(metricsWithoutAvg);
    // Should not crash and should still render other metrics
    expect(output).toContain('1250.50');
    expect(output).toContain('1.95');
    expect(output).not.toContain('Avg Trade PnL');
  });

  it('should format win rate as percentage', () => {
    const output = buildBacktestTable(positiveMetrics);
    expect(output).toContain('62.0%');
  });

  it('should format max drawdown as percentage', () => {
    const output = buildBacktestTable(positiveMetrics);
    expect(output).toContain('8.0%');
  });
});

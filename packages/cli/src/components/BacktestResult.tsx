import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import Table from 'cli-table3';

interface BacktestResultProps {
  metrics: {
    total_pnl: string;
    sharpe_ratio: number;
    sortino_ratio: number;
    win_rate: number;
    max_drawdown: number;
    total_trades: number;
    avg_trade_pnl?: string;
    profit_factor: number;
  };
  strategyName?: string;
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

export function BacktestResult({ metrics, strategyName }: BacktestResultProps) {
  const table = new Table({
    head: [chalk.bold('Metric'), chalk.bold('Value')],
    style: { head: [], border: [] },
  });

  const pnlValue = parseFloat(metrics.total_pnl) >= 0
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
    const avgPnlValue = parseFloat(metrics.avg_trade_pnl) >= 0
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

  return (
    <Box flexDirection="column" paddingY={1}>
      {strategyName && (
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            Strategy: {strategyName}
          </Text>
        </Box>
      )}
      <Text>{table.toString()}</Text>
    </Box>
  );
}

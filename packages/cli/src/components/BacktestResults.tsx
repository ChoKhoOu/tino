import React from 'react';
import { Box, Text } from 'ink';

export interface BacktestMetrics {
  total_pnl: string;
  sharpe_ratio: number;
  sortino_ratio: number;
  win_rate: number;
  max_drawdown: number;
  total_trades: number;
  profit_factor: number;
  avg_trade_pnl?: string;
}

interface BacktestResultsProps {
  backtestId: string;
  status: string;
  metrics: BacktestMetrics | null;
  progressPct?: number;
  tradingPair?: string;
  dateRange?: string;
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box>
      <Box width={24}>
        <Text color="gray">{label}</Text>
      </Box>
      <Text color={color || 'white'} bold>
        {value}
      </Text>
    </Box>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const width = 30;
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const color = percent === 100 ? 'green' : 'cyan';

  return (
    <Box>
      <Text color={color}>{bar}</Text>
      <Text color="white"> {percent.toFixed(1)}%</Text>
    </Box>
  );
}

export function BacktestResults({
  backtestId,
  status,
  metrics,
  progressPct,
  tradingPair,
  dateRange,
}: BacktestResultsProps) {
  const statusColor =
    status === 'COMPLETED'
      ? 'green'
      : status === 'RUNNING'
        ? 'cyan'
        : status === 'FAILED'
          ? 'red'
          : 'yellow';

  return (
    <Box flexDirection="column" paddingY={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Backtest
        </Text>
        <Text color="gray"> {backtestId.slice(0, 8)}... </Text>
        <Text color={statusColor} bold>
          [{status}]
        </Text>
      </Box>

      {/* Info */}
      {tradingPair && (
        <Box>
          <Text color="gray">Pair: </Text>
          <Text>{tradingPair}</Text>
          {dateRange && (
            <>
              <Text color="gray"> | Range: </Text>
              <Text>{dateRange}</Text>
            </>
          )}
        </Box>
      )}

      {/* Progress bar */}
      {status === 'RUNNING' && progressPct !== undefined && (
        <Box marginY={1}>
          <ProgressBar percent={progressPct} />
        </Box>
      )}

      {/* Metrics table */}
      {metrics && (
        <Box flexDirection="column" marginTop={1} paddingX={1} borderStyle="single" borderColor="green">
          <Box marginBottom={1}>
            <Text color="green" bold>
              Performance Metrics
            </Text>
          </Box>
          <MetricRow
            label="Total PnL"
            value={`$${metrics.total_pnl}`}
            color={parseFloat(metrics.total_pnl) >= 0 ? 'green' : 'red'}
          />
          <MetricRow label="Sharpe Ratio" value={metrics.sharpe_ratio.toFixed(2)} />
          <MetricRow label="Sortino Ratio" value={metrics.sortino_ratio.toFixed(2)} />
          <MetricRow
            label="Win Rate"
            value={`${(metrics.win_rate * 100).toFixed(1)}%`}
            color={metrics.win_rate >= 0.5 ? 'green' : 'red'}
          />
          <MetricRow
            label="Max Drawdown"
            value={`${(metrics.max_drawdown * 100).toFixed(1)}%`}
            color={metrics.max_drawdown <= 0.1 ? 'green' : metrics.max_drawdown <= 0.2 ? 'yellow' : 'red'}
          />
          <MetricRow label="Total Trades" value={String(metrics.total_trades)} />
          <MetricRow label="Profit Factor" value={metrics.profit_factor.toFixed(2)} />
          {metrics.avg_trade_pnl && (
            <MetricRow label="Avg Trade PnL" value={`$${metrics.avg_trade_pnl}`} />
          )}
        </Box>
      )}
    </Box>
  );
}

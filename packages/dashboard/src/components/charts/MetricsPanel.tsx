import React from 'react';

interface Metrics {
  total_pnl: string;
  sharpe_ratio: number;
  sortino_ratio: number;
  win_rate: number;
  max_drawdown: number;
  total_trades: number;
  profit_factor: number;
}

interface MetricsPanelProps {
  metrics: Metrics;
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 flex flex-col items-center">
      <span className="text-sm text-gray-400 mb-1">{label}</span>
      <span className={`text-xl font-bold ${color || 'text-white'}`}>{value}</span>
    </div>
  );
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  const pnl = parseFloat(metrics.total_pnl);
  const pnlColor = pnl >= 0 ? 'text-green-400' : 'text-red-400';
  const winRateColor = metrics.win_rate >= 0.5 ? 'text-green-400' : 'text-red-400';
  const ddColor =
    metrics.max_drawdown <= 0.1
      ? 'text-green-400'
      : metrics.max_drawdown <= 0.2
        ? 'text-yellow-400'
        : 'text-red-400';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricCard label="Total PnL" value={`$${metrics.total_pnl}`} color={pnlColor} />
      <MetricCard label="Sharpe Ratio" value={metrics.sharpe_ratio.toFixed(2)} />
      <MetricCard label="Sortino Ratio" value={metrics.sortino_ratio.toFixed(2)} />
      <MetricCard
        label="Win Rate"
        value={`${(metrics.win_rate * 100).toFixed(1)}%`}
        color={winRateColor}
      />
      <MetricCard
        label="Max Drawdown"
        value={`${(metrics.max_drawdown * 100).toFixed(1)}%`}
        color={ddColor}
      />
      <MetricCard label="Total Trades" value={String(metrics.total_trades)} />
      <MetricCard label="Profit Factor" value={metrics.profit_factor.toFixed(2)} />
    </div>
  );
}

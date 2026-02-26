import React from 'react';
import { CandlestickChart } from '../components/charts/CandlestickChart';
import { EquityCurve } from '../components/charts/EquityCurve';
import { DrawdownChart } from '../components/charts/DrawdownChart';
import { MetricsPanel } from '../components/charts/MetricsPanel';

interface BacktestDetailProps {
  backtest: {
    id: string;
    strategy_name: string;
    trading_pair: string;
    start_date: string;
    end_date: string;
    status: string;
    metrics: any;
    equity_curve: any[];
    trade_log: any[];
  } | null;
}

export function BacktestDetail({ backtest }: BacktestDetailProps) {
  if (!backtest) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a backtest to view details
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{backtest.strategy_name}</h2>
          <p className="text-gray-400">
            {backtest.trading_pair} | {backtest.start_date} to {backtest.end_date}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            backtest.status === 'COMPLETED'
              ? 'bg-green-900 text-green-300'
              : backtest.status === 'RUNNING'
                ? 'bg-blue-900 text-blue-300'
                : 'bg-red-900 text-red-300'
          }`}
        >
          {backtest.status}
        </span>
      </div>

      {/* Metrics */}
      {backtest.metrics && <MetricsPanel metrics={backtest.metrics} />}

      {/* Charts */}
      <div className="bg-slate-900 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-2">Price Chart</h3>
        <CandlestickChart
          data={[]}
          trades={backtest.trade_log?.map((t: any) => ({
            time: t.entry_time,
            side: t.side,
            price: parseFloat(t.entry_price),
          }))}
        />
      </div>

      {backtest.equity_curve && backtest.equity_curve.length > 0 && (
        <>
          <div className="bg-slate-900 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Equity Curve</h3>
            <EquityCurve data={backtest.equity_curve} />
          </div>

          <div className="bg-slate-900 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Drawdown</h3>
            <DrawdownChart equityData={backtest.equity_curve} />
          </div>
        </>
      )}

      {/* Trade Log */}
      {backtest.trade_log && backtest.trade_log.length > 0 && (
        <div className="bg-slate-900 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-2">Trade Log</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-300">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-2">Side</th>
                  <th className="text-left p-2">Quantity</th>
                  <th className="text-left p-2">Entry</th>
                  <th className="text-left p-2">Exit</th>
                  <th className="text-right p-2">PnL</th>
                </tr>
              </thead>
              <tbody>
                {backtest.trade_log.map((trade: any, i: number) => (
                  <tr key={i} className="border-b border-gray-800">
                    <td className={`p-2 ${trade.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.side}
                    </td>
                    <td className="p-2">{trade.quantity}</td>
                    <td className="p-2">${trade.entry_price}</td>
                    <td className="p-2">${trade.exit_price}</td>
                    <td className={`p-2 text-right ${parseFloat(trade.pnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${trade.pnl}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

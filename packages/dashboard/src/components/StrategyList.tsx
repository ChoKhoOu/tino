import React from 'react';

interface StrategyItem {
  id: string;
  version_hash: string;
  name: string;
  created_at: string;
  backtest_count: number;
  live_session_count: number;
}

interface StrategyListProps {
  strategies: StrategyItem[];
  selectedHash?: string;
  onSelect: (hash: string) => void;
}

export function StrategyList({ strategies, selectedHash, onSelect }: StrategyListProps) {
  if (strategies.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-center">
        No strategies yet. Create one from the CLI.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {strategies.map((strategy) => (
        <button
          key={strategy.id}
          onClick={() => onSelect(strategy.version_hash)}
          className={`w-full text-left p-3 rounded-lg transition-colors ${
            selectedHash === strategy.version_hash
              ? 'bg-slate-700 border border-cyan-500'
              : 'bg-slate-800 hover:bg-slate-700 border border-transparent'
          }`}
        >
          <div className="font-medium text-white truncate">{strategy.name}</div>
          <div className="text-xs text-gray-400 mt-1 flex justify-between">
            <span>{strategy.version_hash.slice(0, 15)}...</span>
            <span>{strategy.backtest_count} backtests</span>
          </div>
          {strategy.live_session_count > 0 && (
            <div className="text-xs text-green-400 mt-1">
              {strategy.live_session_count} live
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

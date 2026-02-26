import React, { useState, useEffect } from 'react';
import { StrategyList } from '../components/StrategyList';
import { BacktestDetail } from './BacktestDetail';

interface Strategy {
  id: string;
  version_hash: string;
  name: string;
  created_at: string;
  backtest_count: number;
  live_session_count: number;
}

const ENGINE_URL = 'http://localhost:8000';

export function Dashboard() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [selectedBacktest, setSelectedBacktest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStrategies();
    const interval = setInterval(fetchStrategies, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStrategies() {
    try {
      const resp = await fetch(`${ENGINE_URL}/api/strategies`);
      if (resp.ok) {
        const data = await resp.json();
        setStrategies(data.items);
      }
    } catch {
      // Engine offline
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectStrategy(hash: string) {
    setSelectedHash(hash);
    try {
      const resp = await fetch(`${ENGINE_URL}/api/backtest?strategy_hash=${encodeURIComponent(hash)}&limit=1`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.items.length > 0) {
          const backtestResp = await fetch(`${ENGINE_URL}/api/backtest/${data.items[0].id}`);
          if (backtestResp.ok) {
            setSelectedBacktest(await backtestResp.json());
          }
        } else {
          setSelectedBacktest(null);
        }
      }
    } catch {
      setSelectedBacktest(null);
    }
  }

  return (
    <div className="flex h-screen bg-slate-950 text-white">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xl font-bold text-cyan-400">Tino</h1>
          <p className="text-xs text-gray-500">Quantitative Trading Dashboard</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <h2 className="text-sm font-semibold text-gray-400 px-2 py-2">Strategies</h2>
          {loading ? (
            <div className="text-gray-500 text-center p-4">Loading...</div>
          ) : (
            <StrategyList
              strategies={strategies}
              selectedHash={selectedHash || undefined}
              onSelect={handleSelectStrategy}
            />
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <BacktestDetail backtest={selectedBacktest} />
      </div>
    </div>
  );
}

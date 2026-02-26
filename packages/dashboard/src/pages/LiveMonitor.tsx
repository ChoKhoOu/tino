import React, { useState, useEffect } from 'react';

const ENGINE_URL = 'http://localhost:8000';

interface LiveSession {
  id: string;
  strategy_version_hash: string;
  trading_pair: string;
  lifecycle_state: string;
  realized_pnl: string;
  unrealized_pnl: string;
  started_at: string;
}

export function LiveMonitor() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchSessions() {
    try {
      const resp = await fetch(`${ENGINE_URL}/api/live`);
      if (resp.ok) setSessions(await resp.json());
    } catch { /* offline */ }
    finally { setLoading(false); }
  }

  async function handleKillSwitch() {
    if (!confirm('KILL SWITCH: Cancel all orders and flatten all positions?')) return;
    await fetch(`${ENGINE_URL}/api/kill-switch`, { method: 'POST' });
    fetchSessions();
  }

  const stateColor = (state: string) => {
    switch (state) {
      case 'RUNNING': return 'text-green-400';
      case 'PAUSED': return 'text-yellow-400';
      case 'STOPPED': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Live Trading Monitor</h1>
        <button
          onClick={handleKillSwitch}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg"
        >
          KILL SWITCH
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : sessions.length === 0 ? (
        <div className="text-gray-500 text-center py-8">No active live sessions</div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <div key={session.id} className="bg-slate-900 rounded-lg p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-white">{session.trading_pair}</span>
                <span className={`font-bold ${stateColor(session.lifecycle_state)}`}>
                  {session.lifecycle_state}
                </span>
              </div>
              <div className="text-sm text-gray-400 space-y-1">
                <div>Realized PnL: <span className={parseFloat(session.realized_pnl) >= 0 ? 'text-green-400' : 'text-red-400'}>${session.realized_pnl}</span></div>
                <div>Unrealized PnL: <span className={parseFloat(session.unrealized_pnl) >= 0 ? 'text-green-400' : 'text-red-400'}>${session.unrealized_pnl}</span></div>
                <div className="text-xs text-gray-600">{session.id.slice(0, 8)}... | Started: {new Date(session.started_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

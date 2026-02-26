const ENGINE_URL = 'http://localhost:8000';

export async function fetchStrategies(limit = 20, offset = 0) {
  const resp = await fetch(`${ENGINE_URL}/api/strategies?limit=${limit}&offset=${offset}`);
  if (!resp.ok) throw new Error('Failed to fetch strategies');
  return resp.json();
}

export async function fetchBacktest(id: string) {
  const resp = await fetch(`${ENGINE_URL}/api/backtest/${id}`);
  if (!resp.ok) throw new Error('Failed to fetch backtest');
  return resp.json();
}

export async function fetchBacktestList(strategyHash?: string, limit = 20) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (strategyHash) params.set('strategy_hash', strategyHash);
  const resp = await fetch(`${ENGINE_URL}/api/backtest?${params}`);
  if (!resp.ok) throw new Error('Failed to fetch backtests');
  return resp.json();
}

export async function fetchLiveSessions() {
  const resp = await fetch(`${ENGINE_URL}/api/live`);
  if (!resp.ok) throw new Error('Failed to fetch live sessions');
  return resp.json();
}

export async function fetchRiskProfile() {
  const resp = await fetch(`${ENGINE_URL}/api/risk/profile`);
  if (!resp.ok) throw new Error('Failed to fetch risk profile');
  return resp.json();
}

export async function triggerKillSwitch() {
  const resp = await fetch(`${ENGINE_URL}/api/kill-switch`, { method: 'POST' });
  if (!resp.ok) throw new Error('Kill switch failed');
  return resp.json();
}

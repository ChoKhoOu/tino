/**
 * Live trading agent: manages deployment, monitoring, and control flow.
 */

export interface LiveDeployRequest {
  strategyVersionHash: string;
  tradingPair: string;
  parameters?: Record<string, unknown>;
  riskProfileId: string;
  confirmedBySession: string;
}

export interface LiveSessionStatus {
  id: string;
  state: string;
  tradingPair: string;
  positions: Array<{
    instrument: string;
    side: string;
    quantity: string;
    avg_entry_price: string;
    unrealized_pnl: string;
  }>;
  realizedPnl: string;
  unrealizedPnl: string;
  openOrders: number;
}

export class LiveAgent {
  private engineUrl: string;

  constructor(engineUrl: string = 'http://localhost:8000') {
    this.engineUrl = engineUrl;
  }

  async deploy(request: LiveDeployRequest): Promise<{ id: string; wsUrl: string }> {
    const response = await fetch(`${this.engineUrl}/api/live/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy_version_hash: request.strategyVersionHash,
        trading_pair: request.tradingPair,
        parameters: request.parameters,
        risk_profile_id: request.riskProfileId,
        confirmed_by_session: request.confirmedBySession,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.detail?.message || error.message || 'Deployment failed');
    }

    const data = await response.json();
    return { id: data.id, wsUrl: data.ws_url };
  }

  async pause(sessionId: string): Promise<void> {
    const resp = await fetch(`${this.engineUrl}/api/live/${sessionId}/pause`, { method: 'POST' });
    if (!resp.ok) throw new Error('Failed to pause session');
  }

  async resume(sessionId: string, confirmedBy: string): Promise<void> {
    const resp = await fetch(`${this.engineUrl}/api/live/${sessionId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed_by_session: confirmedBy }),
    });
    if (!resp.ok) throw new Error('Failed to resume session');
  }

  async stop(sessionId: string): Promise<void> {
    const resp = await fetch(`${this.engineUrl}/api/live/${sessionId}/stop`, { method: 'POST' });
    if (!resp.ok) throw new Error('Failed to stop session');
  }

  async killSwitch(): Promise<{
    killedSessions: number;
    cancelledOrders: number;
    flattenedPositions: number;
  }> {
    const resp = await fetch(`${this.engineUrl}/api/kill-switch`, { method: 'POST' });
    if (!resp.ok) throw new Error('Kill switch failed');
    const data = await resp.json();
    return {
      killedSessions: data.killed_sessions,
      cancelledOrders: data.cancelled_orders,
      flattenedPositions: data.flattened_positions,
    };
  }

  async getStatus(sessionId: string): Promise<LiveSessionStatus> {
    const resp = await fetch(`${this.engineUrl}/api/live/${sessionId}`);
    if (!resp.ok) throw new Error('Failed to get session status');
    const data = await resp.json();
    return {
      id: data.id,
      state: data.lifecycle_state,
      tradingPair: data.trading_pair,
      positions: data.positions || [],
      realizedPnl: data.realized_pnl,
      unrealizedPnl: data.unrealized_pnl,
      openOrders: data.open_orders?.length || 0,
    };
  }

  async listSessions(): Promise<LiveSessionStatus[]> {
    const resp = await fetch(`${this.engineUrl}/api/live`);
    if (!resp.ok) throw new Error('Failed to list sessions');
    const data = await resp.json();
    return data.map((s: any) => ({
      id: s.id,
      state: s.lifecycle_state,
      tradingPair: s.trading_pair,
      positions: [],
      realizedPnl: s.realized_pnl,
      unrealizedPnl: s.unrealized_pnl,
      openOrders: 0,
    }));
  }
}

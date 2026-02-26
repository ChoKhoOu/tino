/**
 * Backtest agent: handles CLI backtest command flow.
 * Submits backtests, connects to WebSocket for streaming progress,
 * and displays results.
 */

export interface BacktestRequest {
  strategyVersionHash: string;
  tradingPair: string;
  startDate: string;
  endDate: string;
  barType?: string;
  parameters?: Record<string, unknown>;
}

export interface BacktestProgress {
  backtestId: string;
  progressPct: number;
  currentDate: string;
  tradesSoFar: number;
  currentPnl: string;
}

export interface BacktestResult {
  backtestId: string;
  status: string;
  metrics: {
    total_pnl: string;
    sharpe_ratio: number;
    sortino_ratio: number;
    win_rate: number;
    max_drawdown: number;
    total_trades: number;
    profit_factor: number;
    avg_trade_pnl?: string;
  } | null;
  tradingPair: string;
  dateRange: string;
}

export type BacktestCallback = (
  event:
    | { type: 'progress'; data: BacktestProgress }
    | { type: 'completed'; data: BacktestResult }
    | { type: 'failed'; error: string }
) => void;

export class BacktestAgent {
  private engineUrl: string;
  private wsUrl: string;

  constructor(engineUrl: string = 'http://localhost:8000') {
    this.engineUrl = engineUrl;
    this.wsUrl = engineUrl.replace('http', 'ws');
  }

  async submitBacktest(
    request: BacktestRequest,
    onEvent?: BacktestCallback,
  ): Promise<BacktestResult> {
    // Submit backtest via REST
    const response = await fetch(`${this.engineUrl}/api/backtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy_version_hash: request.strategyVersionHash,
        trading_pair: request.tradingPair,
        start_date: request.startDate,
        end_date: request.endDate,
        bar_type: request.barType || '1-HOUR',
        parameters: request.parameters,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Failed to submit backtest: ${error.message || error.detail}`);
    }

    const { id: backtestId, ws_url } = await response.json();

    // Connect to WebSocket for progress streaming
    return new Promise<BacktestResult>((resolve, reject) => {
      const wsFullUrl = `${this.wsUrl}${ws_url}`;

      try {
        const ws = new WebSocket(wsFullUrl);
        let result: BacktestResult | null = null;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string);

            switch (data.type) {
              case 'backtest.progress':
                onEvent?.({
                  type: 'progress',
                  data: {
                    backtestId,
                    progressPct: data.payload.progress_pct,
                    currentDate: data.payload.current_date,
                    tradesSoFar: data.payload.trades_so_far,
                    currentPnl: data.payload.current_pnl,
                  },
                });
                break;

              case 'backtest.completed':
                result = {
                  backtestId,
                  status: 'COMPLETED',
                  metrics: data.payload.metrics,
                  tradingPair: request.tradingPair,
                  dateRange: `${request.startDate} to ${request.endDate}`,
                };
                onEvent?.({ type: 'completed', data: result });
                ws.close();
                break;

              case 'backtest.failed':
                onEvent?.({ type: 'failed', error: data.payload.message });
                ws.close();
                reject(new Error(data.payload.message));
                return;

              case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
            }
          } catch (e) {
            // Ignore parse errors
          }
        };

        ws.onclose = () => {
          if (result) {
            resolve(result);
          }
        };

        ws.onerror = () => {
          // Fallback: poll REST endpoint
          this._pollForResult(backtestId, request, onEvent)
            .then(resolve)
            .catch(reject);
        };
      } catch {
        // WebSocket not available, fallback to polling
        this._pollForResult(backtestId, request, onEvent)
          .then(resolve)
          .catch(reject);
      }
    });
  }

  async getBacktest(backtestId: string): Promise<BacktestResult> {
    const response = await fetch(`${this.engineUrl}/api/backtest/${backtestId}`);
    if (!response.ok) {
      throw new Error(`Failed to get backtest: ${response.statusText}`);
    }
    const data = await response.json();
    return {
      backtestId: data.id,
      status: data.status,
      metrics: data.metrics,
      tradingPair: data.trading_pair,
      dateRange: `${data.start_date} to ${data.end_date}`,
    };
  }

  private async _pollForResult(
    backtestId: string,
    request: BacktestRequest,
    onEvent?: BacktestCallback,
  ): Promise<BacktestResult> {
    const maxAttempts = 120; // 2 minutes with 1s interval
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1000));

      const response = await fetch(
        `${this.engineUrl}/api/backtest/${backtestId}`,
      );
      if (!response.ok) continue;

      const data = await response.json();

      if (data.status === 'RUNNING' && data.progress_pct !== undefined) {
        onEvent?.({
          type: 'progress',
          data: {
            backtestId,
            progressPct: data.progress_pct,
            currentDate: '',
            tradesSoFar: 0,
            currentPnl: '0',
          },
        });
      }

      if (data.status === 'COMPLETED') {
        const result: BacktestResult = {
          backtestId,
          status: 'COMPLETED',
          metrics: data.metrics,
          tradingPair: request.tradingPair,
          dateRange: `${request.startDate} to ${request.endDate}`,
        };
        onEvent?.({ type: 'completed', data: result });
        return result;
      }

      if (data.status === 'FAILED') {
        onEvent?.({ type: 'failed', error: data.error_message || 'Unknown error' });
        throw new Error(data.error_message || 'Backtest failed');
      }
    }

    throw new Error('Backtest timed out');
  }
}

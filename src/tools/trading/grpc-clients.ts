import { BacktestClient } from '../../grpc/backtest-client.js';
import { TradingClient } from '../../grpc/trading-client.js';

let _backtestClient: BacktestClient | null = null;
let _tradingClient: TradingClient | null = null;

export function getBacktestClient(): BacktestClient {
  if (!_backtestClient) _backtestClient = new BacktestClient();
  return _backtestClient;
}

export function getTradingClient(): TradingClient {
  if (!_tradingClient) _tradingClient = new TradingClient();
  return _tradingClient;
}

export function __setClients(opts: {
  backtestClient?: BacktestClient | null;
  tradingClient?: TradingClient | null;
}): void {
  if (opts.backtestClient !== undefined) _backtestClient = opts.backtestClient;
  if (opts.tradingClient !== undefined) _tradingClient = opts.tradingClient;
}

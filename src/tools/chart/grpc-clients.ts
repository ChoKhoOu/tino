import { ChartClient } from '../../grpc/chart-client.js';

let _client: ChartClient | null = null;

export function getChartClient(): ChartClient {
  if (!_client) _client = new ChartClient();
  return _client;
}

export function __setClients(opts: {
  chartClient?: ChartClient | null;
}): void {
  if (opts.chartClient !== undefined) _client = opts.chartClient;
}

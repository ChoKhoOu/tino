import { PortfolioClient } from '../../grpc/portfolio-client.js';

let _client: PortfolioClient | null = null;

export function getPortfolioClient(): PortfolioClient {
  if (!_client) _client = new PortfolioClient();
  return _client;
}

export function __setClients(opts: {
  portfolioClient?: PortfolioClient | null;
}): void {
  if (opts.portfolioClient !== undefined) _client = opts.portfolioClient;
}

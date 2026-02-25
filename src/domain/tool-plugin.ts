import type { z } from 'zod';
import type { TradingClient } from '@/grpc/trading-client.js';
import type { BacktestClient } from '@/grpc/backtest-client.js';
import type { PortfolioClient } from '@/grpc/portfolio-client.js';
import type { ChartClient } from '@/grpc/chart-client.js';
import type { StreamingClient } from '@/grpc/streaming-client.js';
import type { DataClient } from '@/grpc/data-client.js';
import type { ExchangeClient } from '@/grpc/exchange-client.js';

export interface GrpcClients {
  trading: TradingClient;
  backtest: BacktestClient;
  portfolio: PortfolioClient;
  chart: ChartClient;
  streaming: StreamingClient;
  data: DataClient;
  exchange: ExchangeClient;
}

export interface ToolContext {
  signal: AbortSignal;
  onProgress: (msg: string) => void;
  /** @deprecated Use typed fields instead. Kept for backwards compatibility. */
  config: Record<string, unknown>;
  /** Typed gRPC clients — prefer over global singletons */
  grpc?: GrpcClients;
}

export interface ToolPlugin<T extends z.ZodType = z.ZodType> {
  id: string;
  domain: string;
  riskLevel: 'safe' | 'moderate' | 'dangerous';
  description: string;
  schema: T;
  execute: (args: unknown, ctx: ToolContext) => Promise<string>;
}

export function defineToolPlugin<T extends z.ZodType>(
  def: ToolPlugin<T>,
): ToolPlugin<T> {
  return def;
}

export const definePlugin = defineToolPlugin;

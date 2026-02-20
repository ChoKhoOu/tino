import type { Interceptor, Transport } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { createTimeoutInterceptor } from "./interceptors/timeout.js";
import { createRetryInterceptor } from "./interceptors/retry.js";

export interface GrpcClientOptions {
  host: string;
  port: number;
  interceptors?: Interceptor[];
}

const DEFAULT_OPTIONS: Omit<GrpcClientOptions, "interceptors"> = {
  host: "127.0.0.1",
  port: 50051,
};

export function createTinoTransport(
  opts: Partial<GrpcClientOptions> = {}
): Transport {
  const { host, port } = { ...DEFAULT_OPTIONS, ...opts };
  const interceptors = opts.interceptors ?? [
    createTimeoutInterceptor(),
    createRetryInterceptor(),
  ];
  return createGrpcTransport({
    baseUrl: `http://${host}:${port}`,
    interceptors,
  });
}

export class GrpcClient {
  protected readonly transport: Transport;
  private readonly host: string;
  private readonly port: number;

  constructor(opts: Partial<GrpcClientOptions> = {}) {
    const merged = { ...DEFAULT_OPTIONS, ...opts };
    this.host = merged.host;
    this.port = merged.port;
    this.transport = createTinoTransport(merged);
  }

  get address(): string {
    return `${this.host}:${this.port}`;
  }
}

import type { Transport } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";

export interface GrpcClientOptions {
  host: string;
  port: number;
}

const DEFAULT_OPTIONS: GrpcClientOptions = {
  host: "127.0.0.1",
  port: 50051,
};

export function createTinoTransport(
  opts: Partial<GrpcClientOptions> = {}
): Transport {
  const { host, port } = { ...DEFAULT_OPTIONS, ...opts };
  return createGrpcTransport({
    baseUrl: `http://${host}:${port}`,
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

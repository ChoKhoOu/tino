import { createClient } from "@connectrpc/connect";
import type { Client } from "@connectrpc/connect";
import { DaemonService } from "./gen/tino/daemon/v1/daemon_pb.js";
import { GrpcClient, type GrpcClientOptions } from "./client.js";
import { create } from "@bufbuild/protobuf";
import { GetSystemInfoRequestSchema } from "./gen/tino/daemon/v1/daemon_pb.js";

type DaemonServiceClient = Client<typeof DaemonService>;

export class DaemonClient extends GrpcClient {
  private readonly client: DaemonServiceClient;

  constructor(opts: Partial<GrpcClientOptions> = {}) {
    super(opts);
    this.client = createClient(DaemonService, this.transport);
  }

  async getSystemInfo(): Promise<{ pythonVersion: string; nautilusVersion: string } | null> {
    try {
      const request = create(GetSystemInfoRequestSchema, {});
      const response = await this.client.getSystemInfo(request);
      return {
        pythonVersion: response.pythonVersion,
        nautilusVersion: response.nautilusVersion,
      };
    } catch {
      return null;
    }
  }
}

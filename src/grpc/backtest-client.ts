import { createClient } from "@connectrpc/connect";
import type { Client } from "@connectrpc/connect";
import {
  BacktestService,
  type RunBacktestRequest,
  type RunBacktestResponse,
  type CancelBacktestResponse,
  type GetResultResponse,
  type ListResultsResponse,
} from "./gen/tino/backtest/v1/backtest_pb.js";
import { GrpcClient, type GrpcClientOptions } from "./client.js";
import { create } from "@bufbuild/protobuf";
import {
  RunBacktestRequestSchema,
  CancelBacktestRequestSchema,
  GetResultRequestSchema,
  ListResultsRequestSchema,
} from "./gen/tino/backtest/v1/backtest_pb.js";

type BacktestServiceClient = Client<typeof BacktestService>;

export class BacktestClient extends GrpcClient {
  private readonly client: BacktestServiceClient;

  constructor(opts: Partial<GrpcClientOptions> = {}) {
    super(opts);
    this.client = createClient(BacktestService, this.transport);
  }

  async *runBacktest(
    params: Omit<RunBacktestRequest, "$typeName" | "$unknown">
  ): AsyncGenerator<RunBacktestResponse> {
    const request = create(RunBacktestRequestSchema, params);
    for await (const response of this.client.runBacktest(request)) {
      yield response;
    }
  }

  async cancelBacktest(id: string): Promise<CancelBacktestResponse> {
    const request = create(CancelBacktestRequestSchema, { id });
    return await this.client.cancelBacktest(request);
  }

  async getResult(id: string): Promise<GetResultResponse> {
    const request = create(GetResultRequestSchema, { id });
    return await this.client.getResult(request);
  }

  async listResults(): Promise<ListResultsResponse> {
    const request = create(ListResultsRequestSchema, {});
    return await this.client.listResults(request);
  }
}

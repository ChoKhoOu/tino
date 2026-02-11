import { createClient } from "@connectrpc/connect";
import type { Client } from "@connectrpc/connect";
import {
  PortfolioService,
  type RecordTradeRequest,
  type RecordTradeResponse,
  type GetPositionsResponse,
  type GetTradesResponse,
  type GetPnLHistoryResponse,
  type GetSummaryResponse,
} from "./gen/tino/portfolio/v1/portfolio_pb.js";
import { GrpcClient, type GrpcClientOptions } from "./client.js";
import { create } from "@bufbuild/protobuf";
import {
  RecordTradeRequestSchema,
  GetPositionsRequestSchema,
  GetTradesRequestSchema,
  GetPnLHistoryRequestSchema,
  GetSummaryRequestSchema,
} from "./gen/tino/portfolio/v1/portfolio_pb.js";

type PortfolioServiceClient = Client<typeof PortfolioService>;

export class PortfolioClient extends GrpcClient {
  private readonly client: PortfolioServiceClient;

  constructor(opts: Partial<GrpcClientOptions> = {}) {
    super(opts);
    this.client = createClient(PortfolioService, this.transport);
  }

  async recordTrade(
    params: Omit<RecordTradeRequest, "$typeName" | "$unknown">
  ): Promise<RecordTradeResponse> {
    const request = create(RecordTradeRequestSchema, params);
    return await this.client.recordTrade(request);
  }

  async getPositions(instrument = ""): Promise<GetPositionsResponse> {
    const request = create(GetPositionsRequestSchema, { instrument });
    return await this.client.getPositions(request);
  }

  async getTrades(opts: {
    instrument?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): Promise<GetTradesResponse> {
    const request = create(GetTradesRequestSchema, {
      instrument: opts.instrument ?? "",
      startDate: opts.startDate ?? "",
      endDate: opts.endDate ?? "",
      limit: opts.limit ?? 50,
    });
    return await this.client.getTrades(request);
  }

  async getPnLHistory(opts: {
    instrument?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<GetPnLHistoryResponse> {
    const request = create(GetPnLHistoryRequestSchema, {
      instrument: opts.instrument ?? "",
      startDate: opts.startDate ?? "",
      endDate: opts.endDate ?? "",
    });
    return await this.client.getPnLHistory(request);
  }

  async getSummary(): Promise<GetSummaryResponse> {
    const request = create(GetSummaryRequestSchema, {});
    return await this.client.getSummary(request);
  }
}

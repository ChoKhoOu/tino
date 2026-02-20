import { createClient } from "@connectrpc/connect";
import type { Client } from "@connectrpc/connect";
import {
  TradingService,
  type StartTradingRequest,
  type StartTradingResponse,
  type StopTradingResponse,
  type GetPositionsResponse,
  type GetOrdersResponse,
  type SubmitOrderRequest,
  type SubmitOrderResponse,
  type CancelOrderResponse,
  type GetAccountSummaryResponse,
} from "./gen/tino/trading/v1/trading_pb.js";
import { GrpcClient, type GrpcClientOptions } from "./client.js";
import { create } from "@bufbuild/protobuf";
import {
  StartTradingRequestSchema,
  StopTradingRequestSchema,
  GetPositionsRequestSchema,
  GetOrdersRequestSchema,
  SubmitOrderRequestSchema,
  CancelOrderRequestSchema,
  GetAccountSummaryRequestSchema,
} from "./gen/tino/trading/v1/trading_pb.js";

type TradingServiceClient = Client<typeof TradingService>;

export class TradingClient extends GrpcClient {
  private readonly client: TradingServiceClient;

  constructor(opts: Partial<GrpcClientOptions> = {}) {
    super(opts);
    this.client = createClient(TradingService, this.transport);
  }

  async *startTrading(
    params: Omit<StartTradingRequest, "$typeName" | "$unknown">
  ): AsyncGenerator<StartTradingResponse> {
    const request = create(StartTradingRequestSchema, params);
    for await (const response of this.client.startTrading(request)) {
      yield response;
    }
  }

  async stopTrading(flattenPositions = true): Promise<StopTradingResponse> {
    const request = create(StopTradingRequestSchema, { flattenPositions });
    return await this.client.stopTrading(request);
  }

  async getPositions(): Promise<GetPositionsResponse> {
    const request = create(GetPositionsRequestSchema, {});
    return await this.client.getPositions(request);
  }

  async getOrders(limit = 50): Promise<GetOrdersResponse> {
    const request = create(GetOrdersRequestSchema, { limit });
    return await this.client.getOrders(request);
  }

  async submitOrder(
    params: Omit<SubmitOrderRequest, "$typeName" | "$unknown">
  ): Promise<SubmitOrderResponse> {
    const request = create(SubmitOrderRequestSchema, params);
    return await this.client.submitOrder(request);
  }

  async cancelOrder(orderId: string): Promise<CancelOrderResponse> {
    const request = create(CancelOrderRequestSchema, { orderId });
    return await this.client.cancelOrder(request);
  }

  async getAccountSummary(): Promise<GetAccountSummaryResponse> {
    const request = create(GetAccountSummaryRequestSchema, {});
    return await this.client.getAccountSummary(request);
  }
}

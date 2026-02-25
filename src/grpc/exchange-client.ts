import { createClient } from "@connectrpc/connect";
import type { Client } from "@connectrpc/connect";
import {
  ExchangeService,
  type PlaceTpSlOrderRequest,
  type PlaceTpSlOrderResponse,
  type PlaceTrailingStopRequest,
  type PlaceTrailingStopResponse,
  type PlaceStopOrderRequest,
  type PlaceStopOrderResponse,
  type GetAccountBalanceResponse,
  type GetExchangePositionsResponse,
} from "./gen/tino/exchange/v1/exchange_pb.js";
import { GrpcClient, type GrpcClientOptions } from "./client.js";
import { create } from "@bufbuild/protobuf";
import {
  PlaceTpSlOrderRequestSchema,
  PlaceTrailingStopRequestSchema,
  PlaceStopOrderRequestSchema,
  GetAccountBalanceRequestSchema,
  GetExchangePositionsRequestSchema,
} from "./gen/tino/exchange/v1/exchange_pb.js";

type ExchangeServiceClient = Client<typeof ExchangeService>;

export class ExchangeClient extends GrpcClient {
  private readonly client: ExchangeServiceClient;

  constructor(opts: Partial<GrpcClientOptions> = {}) {
    super(opts);
    this.client = createClient(ExchangeService, this.transport);
  }

  async placeTpSlOrder(
    params: Omit<PlaceTpSlOrderRequest, "$typeName" | "$unknown">
  ): Promise<PlaceTpSlOrderResponse> {
    const request = create(PlaceTpSlOrderRequestSchema, params);
    return await this.client.placeTpSlOrder(request);
  }

  async placeTrailingStop(
    params: Omit<PlaceTrailingStopRequest, "$typeName" | "$unknown">
  ): Promise<PlaceTrailingStopResponse> {
    const request = create(PlaceTrailingStopRequestSchema, params);
    return await this.client.placeTrailingStop(request);
  }

  async placeStopOrder(
    params: Omit<PlaceStopOrderRequest, "$typeName" | "$unknown">
  ): Promise<PlaceStopOrderResponse> {
    const request = create(PlaceStopOrderRequestSchema, params);
    return await this.client.placeStopOrder(request);
  }

  async getAccountBalance(exchange: string): Promise<GetAccountBalanceResponse> {
    const request = create(GetAccountBalanceRequestSchema, { exchange });
    return await this.client.getAccountBalance(request);
  }

  async getExchangePositions(
    exchange: string,
    symbol?: string,
  ): Promise<GetExchangePositionsResponse> {
    const request = create(GetExchangePositionsRequestSchema, {
      exchange,
      symbol: symbol ?? "",
    });
    return await this.client.getExchangePositions(request);
  }
}

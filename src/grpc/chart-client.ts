import { createClient } from "@connectrpc/connect";
import type { Client } from "@connectrpc/connect";
import {
  ChartService,
  type RenderCandlestickRequest,
  type RenderCandlestickResponse,
  type RenderLineChartRequest,
  type RenderLineChartResponse,
  type RenderSubplotRequest,
  type RenderSubplotResponse,
} from "./gen/tino/chart/v1/chart_pb.js";
import { GrpcClient, type GrpcClientOptions } from "./client.js";
import { create } from "@bufbuild/protobuf";
import {
  RenderCandlestickRequestSchema,
  RenderLineChartRequestSchema,
  RenderSubplotRequestSchema,
} from "./gen/tino/chart/v1/chart_pb.js";

type ChartServiceClient = Client<typeof ChartService>;

export class ChartClient extends GrpcClient {
  private readonly client: ChartServiceClient;

  constructor(opts: Partial<GrpcClientOptions> = {}) {
    super(opts);
    this.client = createClient(ChartService, this.transport);
  }

  async renderCandlestick(
    params: Omit<RenderCandlestickRequest, "$typeName" | "$unknown">
  ): Promise<RenderCandlestickResponse> {
    const request = create(RenderCandlestickRequestSchema, params);
    return await this.client.renderCandlestick(request);
  }

  async renderLineChart(
    params: Omit<RenderLineChartRequest, "$typeName" | "$unknown">
  ): Promise<RenderLineChartResponse> {
    const request = create(RenderLineChartRequestSchema, params);
    return await this.client.renderLineChart(request);
  }

  async renderSubplot(
    params: Omit<RenderSubplotRequest, "$typeName" | "$unknown">
  ): Promise<RenderSubplotResponse> {
    const request = create(RenderSubplotRequestSchema, params);
    return await this.client.renderSubplot(request);
  }
}

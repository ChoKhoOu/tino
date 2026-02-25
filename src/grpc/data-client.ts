import { createClient } from "@connectrpc/connect";
import type { Client } from "@connectrpc/connect";
import {
  DataService,
  type IngestDataRequest,
  type IngestDataResponse,
  type ListCatalogResponse,
  type DeleteCatalogResponse,
  type GetMarketQuoteRequest,
  type GetMarketQuoteResponse,
  type GetMarketKlinesRequest,
  type GetMarketKlinesResponse,
  type GetMarketOverviewRequest,
  type GetMarketOverviewResponse,
  type ListSupportedExchangesResponse,
} from "./gen/tino/data/v1/data_pb.js";
import { GrpcClient, type GrpcClientOptions } from "./client.js";
import { create } from "@bufbuild/protobuf";
import {
  IngestDataRequestSchema,
  ListCatalogRequestSchema,
  DeleteCatalogRequestSchema,
  GetMarketQuoteRequestSchema,
  GetMarketKlinesRequestSchema,
  GetMarketOverviewRequestSchema,
  ListSupportedExchangesRequestSchema,
} from "./gen/tino/data/v1/data_pb.js";

type DataServiceClient = Client<typeof DataService>;

export class DataClient extends GrpcClient {
  private readonly client: DataServiceClient;

  constructor(opts: Partial<GrpcClientOptions> = {}) {
    super(opts);
    this.client = createClient(DataService, this.transport);
  }

  async *ingestData(
    params: Omit<IngestDataRequest, "$typeName" | "$unknown">
  ): AsyncGenerator<IngestDataResponse> {
    const request = create(IngestDataRequestSchema, params);
    for await (const response of this.client.ingestData(request)) {
      yield response;
    }
  }

  async listCatalog(): Promise<ListCatalogResponse> {
    const request = create(ListCatalogRequestSchema, {});
    return await this.client.listCatalog(request);
  }

  async deleteCatalog(
    instrument: string,
    barType: string
  ): Promise<DeleteCatalogResponse> {
    const request = create(DeleteCatalogRequestSchema, {
      instrument,
      barType,
    });
    return await this.client.deleteCatalog(request);
  }

  async getMarketQuote(
    params: Omit<GetMarketQuoteRequest, "$typeName" | "$unknown">
  ): Promise<GetMarketQuoteResponse> {
    const request = create(GetMarketQuoteRequestSchema, params);
    return await this.client.getMarketQuote(request);
  }

  async getMarketKlines(
    params: Omit<GetMarketKlinesRequest, "$typeName" | "$unknown">
  ): Promise<GetMarketKlinesResponse> {
    const request = create(GetMarketKlinesRequestSchema, params);
    return await this.client.getMarketKlines(request);
  }

  async getMarketOverview(
    params: Omit<GetMarketOverviewRequest, "$typeName" | "$unknown">
  ): Promise<GetMarketOverviewResponse> {
    const request = create(GetMarketOverviewRequestSchema, params);
    return await this.client.getMarketOverview(request);
  }

  async listSupportedExchanges(): Promise<ListSupportedExchangesResponse> {
    const request = create(ListSupportedExchangesRequestSchema, {});
    return await this.client.listSupportedExchanges(request);
  }
}

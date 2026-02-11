import { createClient } from "@connectrpc/connect";
import type { Client } from "@connectrpc/connect";
import {
  StreamingService,
  type SubscribeRequest,
  type SubscribeResponse,
  type UnsubscribeResponse,
  type ListSubscriptionsResponse,
} from "./gen/tino/streaming/v1/streaming_pb.js";
import { GrpcClient, type GrpcClientOptions } from "./client.js";
import { create } from "@bufbuild/protobuf";
import {
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  ListSubscriptionsRequestSchema,
} from "./gen/tino/streaming/v1/streaming_pb.js";

type StreamingServiceClient = Client<typeof StreamingService>;

export class StreamingClient extends GrpcClient {
  private readonly client: StreamingServiceClient;

  constructor(opts: Partial<GrpcClientOptions> = {}) {
    super(opts);
    this.client = createClient(StreamingService, this.transport);
  }

  async *subscribe(
    params: Omit<SubscribeRequest, "$typeName" | "$unknown">
  ): AsyncGenerator<SubscribeResponse> {
    const request = create(SubscribeRequestSchema, params);
    for await (const response of this.client.subscribe(request)) {
      yield response;
    }
  }

  async unsubscribe(params: {
    instrument: string;
    source?: string;
  }): Promise<UnsubscribeResponse> {
    const request = create(UnsubscribeRequestSchema, {
      instrument: params.instrument,
      source: params.source ?? "",
    });
    return await this.client.unsubscribe(request);
  }

  async listSubscriptions(): Promise<ListSubscriptionsResponse> {
    const request = create(ListSubscriptionsRequestSchema, {});
    return await this.client.listSubscriptions(request);
  }
}

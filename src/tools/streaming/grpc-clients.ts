import { StreamingClient } from '../../grpc/streaming-client.js';

let _client: StreamingClient | null = null;

export function getStreamingClient(): StreamingClient {
  if (!_client) _client = new StreamingClient();
  return _client;
}

export function __setClients(opts: {
  streamingClient?: StreamingClient | null;
}): void {
  if (opts.streamingClient !== undefined) _client = opts.streamingClient;
}

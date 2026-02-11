import { describe, test, expect } from 'bun:test';
import { StreamingClient } from '../streaming-client.js';
import { GrpcClient } from '../client.js';

describe('StreamingClient', () => {
  test('extends GrpcClient', () => {
    const client = new StreamingClient();
    expect(client).toBeInstanceOf(GrpcClient);
  });

  test('accepts custom options', () => {
    const client = new StreamingClient({ host: '192.168.1.1', port: 9999 });
    expect(client.address).toBe('192.168.1.1:9999');
  });

  test('uses default options when none provided', () => {
    const client = new StreamingClient();
    expect(client.address).toBe('127.0.0.1:50051');
  });

  test('has all expected RPC methods', () => {
    const client = new StreamingClient();
    expect(typeof client.subscribe).toBe('function');
    expect(typeof client.unsubscribe).toBe('function');
    expect(typeof client.listSubscriptions).toBe('function');
  });

  test('subscribe returns an async generator', () => {
    const client = new StreamingClient();
    const gen = client.subscribe({ instrument: 'AAPL', source: 'polygon', eventType: 'quote' });
    expect(gen[Symbol.asyncIterator]).toBeDefined();
  });
});

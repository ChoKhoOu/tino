import { describe, test, expect } from 'bun:test';
import { ChartClient } from '../chart-client.js';
import { GrpcClient } from '../client.js';

describe('ChartClient', () => {
  test('extends GrpcClient', () => {
    const client = new ChartClient();
    expect(client).toBeInstanceOf(GrpcClient);
  });

  test('accepts custom options', () => {
    const client = new ChartClient({ host: '192.168.1.1', port: 9999 });
    expect(client.address).toBe('192.168.1.1:9999');
  });

  test('uses default options when none provided', () => {
    const client = new ChartClient();
    expect(client.address).toBe('127.0.0.1:50051');
  });

  test('has all expected RPC methods', () => {
    const client = new ChartClient();
    expect(typeof client.renderCandlestick).toBe('function');
    expect(typeof client.renderLineChart).toBe('function');
    expect(typeof client.renderSubplot).toBe('function');
  });
});

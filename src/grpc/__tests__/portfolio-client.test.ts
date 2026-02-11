import { describe, test, expect } from 'bun:test';
import { PortfolioClient } from '../portfolio-client.js';
import { GrpcClient } from '../client.js';

describe('PortfolioClient', () => {
  test('extends GrpcClient', () => {
    const client = new PortfolioClient();
    expect(client).toBeInstanceOf(GrpcClient);
  });

  test('accepts custom options', () => {
    const client = new PortfolioClient({ host: '192.168.1.1', port: 9999 });
    expect(client.address).toBe('192.168.1.1:9999');
  });

  test('uses default options when none provided', () => {
    const client = new PortfolioClient();
    expect(client.address).toBe('127.0.0.1:50051');
  });

  test('has all expected RPC methods', () => {
    const client = new PortfolioClient();
    expect(typeof client.recordTrade).toBe('function');
    expect(typeof client.getPositions).toBe('function');
    expect(typeof client.getTrades).toBe('function');
    expect(typeof client.getPnLHistory).toBe('function');
    expect(typeof client.getSummary).toBe('function');
  });
});

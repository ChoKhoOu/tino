import { describe, test, expect } from 'bun:test';
import { TradingClient } from '../trading-client.js';
import { GrpcClient } from '../client.js';

describe('TradingClient', () => {
  test('extends GrpcClient', () => {
    const client = new TradingClient();
    expect(client).toBeInstanceOf(GrpcClient);
  });

  test('default address is 127.0.0.1:50051', () => {
    const client = new TradingClient();
    expect(client.address).toBe('127.0.0.1:50051');
  });

  test('accepts custom port', () => {
    const client = new TradingClient({ port: 9999 });
    expect(client.address).toBe('127.0.0.1:9999');
  });

  test('has all expected RPC methods', () => {
    const client = new TradingClient();
    expect(typeof client.startTrading).toBe('function');
    expect(typeof client.stopTrading).toBe('function');
    expect(typeof client.getPositions).toBe('function');
    expect(typeof client.getOrders).toBe('function');
    expect(typeof client.submitOrder).toBe('function');
    expect(typeof client.cancelOrder).toBe('function');
    expect(typeof client.getAccountSummary).toBe('function');
  });

  test('methods are functions', () => {
    const client = new TradingClient();
    const methods = [
      'startTrading',
      'stopTrading',
      'getPositions',
      'getOrders',
      'submitOrder',
      'cancelOrder',
      'getAccountSummary',
    ] as const;
    for (const method of methods) {
      expect(typeof client[method]).toBe('function');
    }
  });
});

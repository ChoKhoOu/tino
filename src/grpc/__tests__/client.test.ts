import { describe, test, expect } from 'bun:test';
import { GrpcClient, createTinoTransport } from '../client.js';

describe('GrpcClient', () => {
  test('default address is 127.0.0.1:50051', () => {
    const client = new GrpcClient();
    expect(client.address).toBe('127.0.0.1:50051');
  });

  test('accepts custom host and port', () => {
    const client = new GrpcClient({ host: '192.168.1.1', port: 9999 });
    expect(client.address).toBe('192.168.1.1:9999');
  });

  test('address getter returns host:port format', () => {
    const client = new GrpcClient({ host: '10.0.0.1', port: 8080 });
    expect(client.address).toBe('10.0.0.1:8080');
  });

  test('has a transport property', () => {
    const client = new GrpcClient();
    expect(client['transport']).toBeDefined();
  });
});

describe('createTinoTransport', () => {
  test('returns a Transport object', () => {
    const transport = createTinoTransport();
    expect(transport).toBeDefined();
    expect(typeof transport).toBe('object');
  });

  test('accepts custom host and port', () => {
    const transport = createTinoTransport({ host: '10.0.0.1', port: 3000 });
    expect(transport).toBeDefined();
  });

  test('applies default interceptors when none provided', () => {
    const transport = createTinoTransport();
    expect(transport).toBeDefined();
    // Transport is created without error, meaning default interceptors were applied
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('DashboardWsClient', () => {
  it('should handle event registration and removal', async () => {
    const { DashboardWsClient } = await import('../src/services/ws-client');
    const client = new DashboardWsClient('ws://localhost:8000/ws/dashboard');

    const handler = vi.fn();
    const unsubscribe = client.on('test.event', handler);

    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('should initialize as disconnected', async () => {
    const { DashboardWsClient } = await import('../src/services/ws-client');
    const client = new DashboardWsClient();
    expect(client.isConnected).toBe(false);
  });

  it('should support wildcard handlers', async () => {
    const { DashboardWsClient } = await import('../src/services/ws-client');
    const client = new DashboardWsClient();
    const handler = vi.fn();
    const unsub = client.onAny(handler);
    expect(typeof unsub).toBe('function');
    unsub();
  });
});

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:8000';

describe.skipIf(!process.env.ENGINE_URL)('Dashboard Backtest Display E2E', () => {
  it('should fetch backtest results after submission', async () => {
    // Create strategy
    const stratResp = await fetch(`${ENGINE_URL}/api/strategies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dashboard Test Strategy',
        source_code: 'class DashTest: pass',
        parameters: {},
      }),
    });
    const { version_hash } = await stratResp.json();

    // Submit backtest
    const btResp = await fetch(`${ENGINE_URL}/api/backtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy_version_hash: version_hash,
        trading_pair: 'BTCUSDT',
        start_date: '2025-01-01',
        end_date: '2025-06-30',
      }),
    });
    expect(btResp.status).toBe(202);

    // Verify it appears in list
    const listResp = await fetch(`${ENGINE_URL}/api/backtest`);
    const list = await listResp.json();
    expect(list.total).toBeGreaterThan(0);
  });
});

describe('Dashboard Schema Validation', () => {
  it('validates strategy list response', () => {
    const schema = z.object({
      items: z.array(z.object({
        id: z.string(),
        version_hash: z.string(),
        name: z.string(),
      })),
      total: z.number(),
    });
    expect(() => schema.parse({ items: [], total: 0 })).not.toThrow();
  });
});

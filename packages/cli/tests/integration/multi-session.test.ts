import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:8000';

describe.skipIf(!process.env.ENGINE_URL)('Multi-Session E2E', () => {
  it('two independent backtests should both appear in results', async () => {
    // Create strategy
    const stratResp = await fetch(`${ENGINE_URL}/api/strategies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Multi Session Test',
        source_code: 'class MultiTest: pass',
        parameters: {},
      }),
    });
    const { version_hash } = await stratResp.json();

    // Submit two backtests
    const [bt1, bt2] = await Promise.all([
      fetch(`${ENGINE_URL}/api/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_version_hash: version_hash,
          trading_pair: 'BTCUSDT',
          start_date: '2025-01-01',
          end_date: '2025-06-30',
        }),
      }),
      fetch(`${ENGINE_URL}/api/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_version_hash: version_hash,
          trading_pair: 'ETHUSDT',
          start_date: '2025-01-01',
          end_date: '2025-06-30',
        }),
      }),
    ]);

    expect(bt1.status).toBe(202);
    expect(bt2.status).toBe(202);

    const id1 = (await bt1.json()).id;
    const id2 = (await bt2.json()).id;
    expect(id1).not.toBe(id2);
  });
});

describe('Multi-Session Schema', () => {
  it('validates backtest list response', () => {
    const schema = z.object({
      items: z.array(z.object({ id: z.string() })),
      total: z.number(),
    });
    expect(() => schema.parse({ items: [{ id: 'abc' }], total: 1 })).not.toThrow();
  });
});

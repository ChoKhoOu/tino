import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:8000';

const StrategyCreateResponseSchema = z.object({
  id: z.string(),
  version_hash: z.string(),
  name: z.string(),
  created_at: z.string(),
});

const StrategyResponseSchema = z.object({
  id: z.string(),
  version_hash: z.string(),
  name: z.string(),
  source_code: z.string(),
  parameters: z.record(z.unknown()),
});

// This test requires the engine to be running
describe.skipIf(!process.env.ENGINE_URL)('Strategy Flow E2E', () => {
  const testStrategy = {
    name: 'E2E Test Strategy',
    description: 'Strategy created by e2e test',
    source_code: `from nautilus_trader.trading.strategy import Strategy

class E2ETestStrategy(Strategy):
    """E2E test strategy."""
    def on_start(self):
        pass
    def on_bar(self, bar):
        pass
    def on_stop(self):
        pass
`,
    parameters: { fast_period: 10, slow_period: 20 },
  };

  it('should create a strategy via REST API', async () => {
    const response = await fetch(`${ENGINE_URL}/api/strategies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testStrategy),
    });
    expect(response.status).toBe(201);

    const data = StrategyCreateResponseSchema.parse(await response.json());
    expect(data.version_hash).toMatch(/^sha256:/);
    expect(data.name).toBe('E2E Test Strategy');
  });

  it('should retrieve the strategy by hash', async () => {
    // Create first
    const createResp = await fetch(`${ENGINE_URL}/api/strategies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testStrategy),
    });
    const { version_hash } = await createResp.json();

    // Retrieve
    const getResp = await fetch(
      `${ENGINE_URL}/api/strategies/${encodeURIComponent(version_hash)}`,
    );
    expect(getResp.status).toBe(200);

    const data = StrategyResponseSchema.parse(await getResp.json());
    expect(data.source_code).toContain('E2ETestStrategy');
    expect(data.parameters).toEqual(testStrategy.parameters);
  });

  it('should list strategies including the created one', async () => {
    const response = await fetch(`${ENGINE_URL}/api/strategies`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.some((s: any) => s.name === 'E2E Test Strategy')).toBe(
      true,
    );
  });
});

describe('Strategy Flow Schema Validation', () => {
  it('validates strategy create response', () => {
    const valid = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      version_hash: 'sha256:abc123',
      name: 'Test',
      created_at: '2026-01-01T00:00:00Z',
    };
    expect(() => StrategyCreateResponseSchema.parse(valid)).not.toThrow();
  });
});

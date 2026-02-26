import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const HealthResponseSchema = z.object({
  status: z.string(),
  engine_version: z.string(),
  nautilus_version: z.string(),
  active_live_sessions: z.number(),
  running_backtests: z.number(),
});

// NOTE: This test requires the engine to be running at localhost:8000
// Run with: ENGINE_URL=http://localhost:8000 npx vitest run tests/integration/health.test.ts
const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:8000';

describe.skipIf(!process.env.ENGINE_URL)('Engine Health Integration', () => {
  it('GET /api/health returns valid response', async () => {
    const response = await fetch(`${ENGINE_URL}/api/health`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    const parsed = HealthResponseSchema.parse(data);

    expect(parsed.status).toBe('healthy');
    expect(parsed.engine_version).toBeDefined();
    expect(parsed.active_live_sessions).toBeGreaterThanOrEqual(0);
    expect(parsed.running_backtests).toBeGreaterThanOrEqual(0);
  });
});

describe('Health Response Schema Validation', () => {
  it('validates a correct health response', () => {
    const valid = {
      status: 'healthy',
      engine_version: '0.1.0',
      nautilus_version: '1.0.0',
      active_live_sessions: 0,
      running_backtests: 0,
    };
    expect(() => HealthResponseSchema.parse(valid)).not.toThrow();
  });

  it('rejects an invalid health response', () => {
    const invalid = { status: 'healthy' };
    expect(() => HealthResponseSchema.parse(invalid)).toThrow();
  });
});

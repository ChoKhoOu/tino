import { describe, expect, it, beforeEach } from 'bun:test';
import { join } from 'node:path';
import {
  detectStrategyType,
  getTemplateEntries,
  loadTemplateCode,
  _resetTemplateCache,
} from '../strategy-lab-generate.js';

const TEMPLATES_DIR = join(import.meta.dir, '..', '..', '..', '..', 'templates');

describe('detectStrategyType', () => {
  it('detects trend strategy from EMA keywords', () => {
    expect(detectStrategyType('Build a dual EMA crossover trend following strategy')).toBe('trend');
  });

  it('detects trend strategy from moving average keywords', () => {
    expect(detectStrategyType('Use a moving average breakout system')).toBe('trend');
  });

  it('detects mean_reversion strategy from Bollinger keywords', () => {
    expect(detectStrategyType('Bollinger band mean reversion with RSI filter')).toBe(
      'mean_reversion',
    );
  });

  it('detects momentum strategy from RSI + volume keywords', () => {
    expect(detectStrategyType('Buy on RSI and volume surge momentum')).toBe('momentum');
  });

  it('detects grid strategy', () => {
    expect(detectStrategyType('Grid trading with DCA on BTC')).toBe('grid');
  });

  it('detects arbitrage strategy', () => {
    expect(detectStrategyType('Funding rate arbitrage between spot and perpetual')).toBe(
      'arbitrage',
    );
  });

  it('returns null for unrecognizable descriptions', () => {
    expect(detectStrategyType('do something random with no clear pattern')).toBeNull();
  });

  it('picks the highest-scoring type when multiple keywords match', () => {
    // "trend follow" matches trend (trend + follow = 2), RSI alone matches momentum (1)
    expect(detectStrategyType('trend follow using RSI filter')).toBe('trend');
  });
});

describe('getTemplateEntries', () => {
  beforeEach(() => {
    _resetTemplateCache();
  });

  it('returns entries for known templates in the templates directory', () => {
    const entries = getTemplateEntries(TEMPLATES_DIR);
    expect(entries.length).toBeGreaterThanOrEqual(3);

    const types = entries.map((e) => e.type);
    expect(types).toContain('trend');
    expect(types).toContain('mean_reversion');
    expect(types).toContain('momentum');
  });

  it('returns empty array for non-existent directory', () => {
    const entries = getTemplateEntries('/non/existent/path');
    expect(entries).toEqual([]);
  });

  it('caches results after first call', () => {
    const first = getTemplateEntries(TEMPLATES_DIR);
    const second = getTemplateEntries(TEMPLATES_DIR);
    expect(first).toBe(second); // same reference
  });
});

describe('loadTemplateCode', () => {
  beforeEach(() => {
    _resetTemplateCache();
  });

  it('loads trend template code', async () => {
    const result = await loadTemplateCode('trend', TEMPLATES_DIR);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('ema_crossover');
    expect(result!.code).toContain('class EmaCrossoverStrategy');
    expect(result!.code).toContain('on_start');
    expect(result!.code).toContain('on_bar');
  });

  it('loads mean_reversion template code', async () => {
    const result = await loadTemplateCode('mean_reversion', TEMPLATES_DIR);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('mean_reversion');
    expect(result!.code).toContain('class MeanReversionStrategy');
  });

  it('loads momentum template code', async () => {
    const result = await loadTemplateCode('momentum', TEMPLATES_DIR);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('momentum');
    expect(result!.code).toContain('class MomentumStrategy');
  });

  it('returns null for strategy type with no template', async () => {
    const result = await loadTemplateCode('grid', TEMPLATES_DIR);
    expect(result).toBeNull();
  });

  it('returns null when templates dir does not exist', async () => {
    const result = await loadTemplateCode('trend', '/non/existent/path');
    expect(result).toBeNull();
  });
});

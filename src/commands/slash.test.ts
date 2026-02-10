import { describe, test, expect } from 'bun:test';
import { parseSlashCommand, SLASH_COMMANDS } from './slash.js';

// ---------------------------------------------------------------------------
// parseSlashCommand
// ---------------------------------------------------------------------------

describe('parseSlashCommand', () => {
  test('returns null for non-slash input', () => {
    expect(parseSlashCommand('hello world')).toBeNull();
    expect(parseSlashCommand('What is AAPL price?')).toBeNull();
    expect(parseSlashCommand('')).toBeNull();
  });

  test('/help returns all commands', () => {
    const result = parseSlashCommand('/help');
    expect(result).not.toBeNull();
    expect(result!.handled).toBe(true);
    expect(result!.action).toBe('help');
    expect(result!.output).toBeDefined();
    // Verify all commands appear in help output
    for (const cmd of Object.keys(SLASH_COMMANDS)) {
      expect(result!.output).toContain(cmd);
    }
  });

  test('/backtest ema_cross parses strategy name', () => {
    const result = parseSlashCommand('/backtest ema_cross');
    expect(result).not.toBeNull();
    expect(result!.handled).toBe(true);
    expect(result!.action).toBe('backtest');
    expect(result!.agentQuery).toContain('ema_cross');
  });

  test('/backtest without strategy shows usage', () => {
    const result = parseSlashCommand('/backtest');
    expect(result).not.toBeNull();
    expect(result!.handled).toBe(true);
    expect(result!.action).toBe('backtest');
    expect(result!.output).toContain('Usage');
    expect(result!.agentQuery).toBeUndefined();
  });

  test('/positions returns positions action', () => {
    const result = parseSlashCommand('/positions');
    expect(result).not.toBeNull();
    expect(result!.handled).toBe(true);
    expect(result!.action).toBe('positions');
    expect(result!.agentQuery).toBeDefined();
  });

  test('/stop returns stop action', () => {
    const result = parseSlashCommand('/stop');
    expect(result).not.toBeNull();
    expect(result!.handled).toBe(true);
    expect(result!.action).toBe('stop');
    expect(result!.agentQuery).toContain('kill switch');
  });

  test('/data AAPL parses instrument', () => {
    const result = parseSlashCommand('/data AAPL');
    expect(result).not.toBeNull();
    expect(result!.handled).toBe(true);
    expect(result!.action).toBe('data');
    expect(result!.agentQuery).toContain('AAPL');
  });

  test('/data without instrument lists all data', () => {
    const result = parseSlashCommand('/data');
    expect(result).not.toBeNull();
    expect(result!.handled).toBe(true);
    expect(result!.action).toBe('data');
    expect(result!.agentQuery).toContain('available');
  });

  test('/export returns export action', () => {
    const result = parseSlashCommand('/export');
    expect(result).not.toBeNull();
    expect(result!.handled).toBe(true);
    expect(result!.action).toBe('export');
    expect(result!.output).toBeDefined();
  });

  test('/model returns model action', () => {
    const result = parseSlashCommand('/model');
    expect(result).not.toBeNull();
    expect(result!.handled).toBe(true);
    expect(result!.action).toBe('model');
  });

  test('unknown /foo returns not handled', () => {
    const result = parseSlashCommand('/foo');
    expect(result).not.toBeNull();
    expect(result!.handled).toBe(false);
  });

  test('handles leading/trailing whitespace', () => {
    const result = parseSlashCommand('  /help  ');
    expect(result).not.toBeNull();
    expect(result!.handled).toBe(true);
    expect(result!.action).toBe('help');
  });

  test('is case-insensitive for command names', () => {
    const result = parseSlashCommand('/HELP');
    expect(result).not.toBeNull();
    expect(result!.handled).toBe(true);
    expect(result!.action).toBe('help');
  });

  test('/backtest with multi-word strategy', () => {
    const result = parseSlashCommand('/backtest mean reversion');
    expect(result).not.toBeNull();
    expect(result!.handled).toBe(true);
    expect(result!.agentQuery).toContain('mean reversion');
  });
});

// ---------------------------------------------------------------------------
// SLASH_COMMANDS registry
// ---------------------------------------------------------------------------

describe('SLASH_COMMANDS', () => {
  test('contains all expected commands', () => {
    const expected = ['/export', '/backtest', '/positions', '/stop', '/data', '/model', '/help'];
    for (const cmd of expected) {
      expect(SLASH_COMMANDS).toHaveProperty(cmd);
    }
  });

  test('all descriptions are non-empty strings', () => {
    for (const [cmd, desc] of Object.entries(SLASH_COMMANDS)) {
      expect(typeof desc).toBe('string');
      expect(desc.length).toBeGreaterThan(0);
    }
  });
});

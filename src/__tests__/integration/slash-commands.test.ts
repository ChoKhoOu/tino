import { describe, expect, test } from 'bun:test';
import { parseSlashCommand, SLASH_COMMANDS } from '../../commands/slash.js';

describe('slash command to agent-query integration', () => {
  test('all 7 slash commands parse correctly', () => {
    const commandInputs: Record<string, string> = {
      '/help': '/help',
      '/model': '/model',
      '/export': '/export',
      '/positions': '/positions',
      '/stop': '/stop',
      '/data': '/data AAPL',
      '/backtest': '/backtest ema_cross',
    };

    expect(Object.keys(SLASH_COMMANDS)).toHaveLength(7);

    for (const [command, input] of Object.entries(commandInputs)) {
      const result = parseSlashCommand(input);
      expect(result).not.toBeNull();
      expect(result?.handled).toBe(true);
      expect(SLASH_COMMANDS).toHaveProperty(command);
    }
  });

  test('/backtest with strategy name produces expected agent query', () => {
    const result = parseSlashCommand('/backtest momentum breakout');

    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('backtest');
    expect(result?.agentQuery).toContain('Run a backtest');
    expect(result?.agentQuery).toContain('momentum breakout');
  });

  test('/stop produces kill switch agent query', () => {
    const result = parseSlashCommand('/stop');

    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('stop');
    expect(result?.agentQuery).toContain('kill switch');
    expect(result?.agentQuery).toContain('flatten all positions');
  });

  test('unknown slash command returns not handled', () => {
    const result = parseSlashCommand('/unknown-command');

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(false);
  });
});

import { describe, test, expect } from 'bun:test';
import { isBashQuickCommand, executeBashQuick, formatBashOutput } from './bash-quick.js';

describe('bash quick mode (! prefix)', () => {
  describe('isBashQuickCommand', () => {
    test('detects ! prefix', () => {
      expect(isBashQuickCommand('!ls')).toBe(true);
      expect(isBashQuickCommand('!git status')).toBe(true);
      expect(isBashQuickCommand('! echo hello')).toBe(true);
    });

    test('rejects non-! input', () => {
      expect(isBashQuickCommand('ls')).toBe(false);
      expect(isBashQuickCommand('/help')).toBe(false);
      expect(isBashQuickCommand('run !something')).toBe(false);
      expect(isBashQuickCommand('')).toBe(false);
    });

    test('rejects bare ! with no command', () => {
      expect(isBashQuickCommand('!')).toBe(false);
      expect(isBashQuickCommand('!  ')).toBe(false);
    });
  });

  describe('executeBashQuick', () => {
    test('executes simple command and captures stdout', async () => {
      const result = await executeBashQuick('echo hello');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('hello');
      expect(result.stderr).toBe('');
    });

    test('captures stderr', async () => {
      const result = await executeBashQuick('echo err >&2');
      expect(result.stderr).toContain('err');
    });

    test('returns non-zero exit code', async () => {
      const result = await executeBashQuick('exit 42');
      expect(result.exitCode).toBe(42);
    });

    test('handles multi-word commands', async () => {
      const result = await executeBashQuick('echo one two three');
      expect(result.stdout).toContain('one two three');
    });
  });

  describe('formatBashOutput', () => {
    test('formats stdout-only output', () => {
      const output = formatBashOutput('ls', { exitCode: 0, stdout: 'file.txt\n', stderr: '' });
      expect(output).toContain('$ ls');
      expect(output).toContain('file.txt');
    });

    test('formats stderr output', () => {
      const output = formatBashOutput('bad', { exitCode: 1, stdout: '', stderr: 'not found\n' });
      expect(output).toContain('$ bad');
      expect(output).toContain('not found');
      expect(output).toContain('exit code: 1');
    });

    test('includes both stdout and stderr', () => {
      const output = formatBashOutput('cmd', { exitCode: 0, stdout: 'out\n', stderr: 'warn\n' });
      expect(output).toContain('out');
      expect(output).toContain('warn');
    });

    test('truncates output exceeding 50KB', () => {
      const longOutput = 'x'.repeat(60 * 1024);
      const output = formatBashOutput('cmd', { exitCode: 0, stdout: longOutput, stderr: '' });
      expect(output.length).toBeLessThan(55 * 1024);
      expect(output).toContain('[truncated');
    });

    test('truncates output exceeding 2000 lines', () => {
      const manyLines = Array.from({ length: 3000 }, (_, i) => `line ${i}`).join('\n');
      const output = formatBashOutput('cmd', { exitCode: 0, stdout: manyLines, stderr: '' });
      expect(output).toContain('[truncated');
    });
  });
});

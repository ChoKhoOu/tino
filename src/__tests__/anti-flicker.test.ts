/**
 * Anti-flicker regression tests.
 *
 * Guards the three properties that eliminate TUI screen flickering during
 * daemon "starting" phase. See each test for the specific Ink internals.
 *
 * If any test fails, the change likely reintroduces screen flicker.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(import.meta.dir, '..');

function readSource(relativePath: string): string {
  return readFileSync(resolve(SRC, relativePath), 'utf-8');
}

describe('anti-flicker invariants', () => {
  test('index.tsx enables incrementalRendering on Ink render()', () => {
    const source = readSource('index.tsx');
    // render(<CLI />, { incrementalRendering: true }) — line-diffing mode
    expect(source).toMatch(/render\s*\([^)]*,\s*\{[^}]*incrementalRendering:\s*true[^}]*\}/);
  });

  test('AppLayout root Box uses height={rows - 1} to avoid clearTerminal path', () => {
    const source = readSource('components/AppLayout.tsx');
    // height={rows - 1} keeps output < terminal rows, avoiding ink.js:181 clearTerminal
    expect(source).toMatch(/height=\{rows\s*-\s*1\}/);
    // height={rows} without subtraction triggers clearTerminal — must not exist
    expect(source).not.toMatch(/height=\{rows\}(?!\s*-)/);
  });

  test('MCP StdioClientTransport uses stderr: pipe to prevent terminal corruption', () => {
    const source = readSource('mcp/mcp-client.ts');
    // stderr: 'pipe' prevents child-process stderr from corrupting cursor in incremental mode
    expect(source).toMatch(/stderr:\s*['"]pipe['"]/);
  });

  test('no console.error/warn calls in runtime paths (bypasses Ink rendering)', () => {
    // console.error/warn bypass Ink → patchConsole clear-rewrite cycle → flicker
    const runtimeFiles = [
      'plugins/discover.ts',
      'runtime/wal-store.ts',
      'runtime/hook-runner.ts',
      'session/session-store.ts',
      'hooks/useFileSearch.ts',
    ];

    for (const file of runtimeFiles) {
      const source = readSource(file);
      const consoleErrorCalls = source.match(/\bconsole\.(error|warn)\s*\(/g) || [];
      expect(consoleErrorCalls).toEqual([]);
    }
  });
});

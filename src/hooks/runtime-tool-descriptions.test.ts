import { describe, expect, test } from 'bun:test';
import { buildToolDescriptions } from './runtime-tool-descriptions.js';

describe('buildToolDescriptions', () => {
  test('prefers rich descriptions when available', () => {
    const output = buildToolDescriptions([
      { id: 'read_file', description: 'short read' },
      { id: 'market_data', description: 'short market' },
    ]);

    expect(output).toContain('### read_file');
    expect(output).not.toContain('short read');
    expect(output).toContain('### market_data');
    expect(output).not.toContain('short market');
  });

  test('falls back to plugin description when no rich mapping exists', () => {
    const output = buildToolDescriptions([{ id: 'custom_tool', description: 'custom short description' }]);
    expect(output).toContain('### custom_tool');
    expect(output).toContain('custom short description');
  });
});

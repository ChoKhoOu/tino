#!/usr/bin/env bun
/**
 * Plugin scaffolding script for Tino.
 *
 * Usage:
 *   bun run scripts/init-plugin.ts <plugin-name> [--dir <target-directory>]
 *
 * Examples:
 *   bun run scripts/init-plugin.ts my-data-source
 *   bun run scripts/init-plugin.ts my-exchange --dir .tino/plugins
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Tino Plugin Scaffolding

Usage:
  bun run scripts/init-plugin.ts <plugin-name> [options]

Options:
  --dir <path>   Target directory (default: ~/.tino/plugins/<plugin-name>)
  --help, -h     Show this help

Examples:
  bun run scripts/init-plugin.ts fear-greed
  bun run scripts/init-plugin.ts my-exchange --dir .tino/plugins/my-exchange
`);
  process.exit(0);
}

const pluginName = args[0]!;
const pluginId = pluginName.replace(/-/g, '_');

// Parse --dir flag
let targetDir: string;
const dirFlagIndex = args.indexOf('--dir');
if (dirFlagIndex !== -1 && args[dirFlagIndex + 1]) {
  targetDir = resolve(args[dirFlagIndex + 1]!);
} else {
  targetDir = join(homedir(), '.tino', 'plugins', pluginName);
}

if (existsSync(targetDir)) {
  console.error(`Error: Directory already exists: ${targetDir}`);
  process.exit(1);
}

// Create directory
mkdirSync(targetDir, { recursive: true });

// Generate plugin file
const pluginContent = `/**
 * Tino Plugin: ${pluginName}
 *
 * TODO: Describe what this plugin does.
 *
 * Usage:
 *   Copy this directory to ~/.tino/plugins/ and start Tino.
 */
import { z } from 'zod';

const schema = z.object({
  action: z.enum(['fetch']).describe('The action to perform'),
  // TODO: Add your parameters here
  // query: z.string().optional().describe('Search query'),
  // limit: z.number().optional().describe('Max results'),
});

const description = \`
TODO: Describe when the agent should use this tool.

## When to Use

- Scenario 1
- Scenario 2

## When NOT to Use

- Anti-pattern 1 (use X instead)

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| fetch | TODO: describe | (none) |
\`.trim();

export default {
  id: '${pluginId}',
  domain: 'utility',
  riskLevel: 'safe' as const,
  description,
  schema,
  execute: async (raw: unknown, ctx?: { signal?: AbortSignal; onProgress?: (msg: string) => void }) => {
    const input = schema.parse(raw);

    try {
      switch (input.action) {
        case 'fetch': {
          ctx?.onProgress?.('Fetching data...');
          // TODO: Implement your logic here
          return JSON.stringify({ message: 'Hello from ${pluginName}!' });
        }
        default:
          return JSON.stringify({ error: \`Unknown action: \${input.action}\` });
      }
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};
`;

// Generate test file
const testContent = `import { describe, test, expect } from 'bun:test';
import plugin from './index.ts';

describe('${pluginName}', () => {
  test('has valid plugin structure', () => {
    expect(plugin.id).toBe('${pluginId}');
    expect(typeof plugin.domain).toBe('string');
    expect(['safe', 'moderate', 'dangerous']).toContain(plugin.riskLevel);
    expect(typeof plugin.description).toBe('string');
    expect(plugin.schema).toBeDefined();
    expect(typeof plugin.execute).toBe('function');
  });

  test('passes Tino validation check', () => {
    const obj = plugin as Record<string, unknown>;
    expect(typeof obj.id).toBe('string');
    expect(typeof obj.schema).not.toBe('undefined');
    expect(typeof obj.execute).toBe('function');
  });

  test('executes fetch action', async () => {
    const result = await plugin.execute({ action: 'fetch' });
    const parsed = JSON.parse(result);
    expect(parsed).toBeDefined();
    expect(parsed.error).toBeUndefined();
  });
});
`;

// Generate README
const readmeContent = `# ${pluginName}

A Tino plugin. TODO: describe what it does.

## Installation

Copy this directory to your Tino plugins folder:

\`\`\`bash
cp -r . ~/.tino/plugins/${pluginName}
\`\`\`

## Testing

\`\`\`bash
bun test ${targetDir}/index.test.ts
\`\`\`

## Configuration

No configuration required. (TODO: list any required API keys or settings)
`;

writeFileSync(join(targetDir, 'index.ts'), pluginContent);
writeFileSync(join(targetDir, 'index.test.ts'), testContent);
writeFileSync(join(targetDir, 'README.md'), readmeContent);

console.log(`Plugin scaffolded at: ${targetDir}`);
console.log('');
console.log('Files created:');
console.log(`  ${join(targetDir, 'index.ts')}       — Plugin implementation`);
console.log(`  ${join(targetDir, 'index.test.ts')}  — Tests`);
console.log(`  ${join(targetDir, 'README.md')}      — Documentation`);
console.log('');
console.log('Next steps:');
console.log(`  1. Edit ${join(targetDir, 'index.ts')} to implement your plugin`);
console.log(`  2. Run tests: bun test ${join(targetDir, 'index.test.ts')}`);
console.log('  3. Start Tino and ask the agent to use your tool');

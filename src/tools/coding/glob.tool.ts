import { z } from 'zod';
import { join, resolve } from 'node:path';
import { stat } from 'node:fs/promises';
import { definePlugin } from '@/domain/index.js';

const MAX_RESULTS = 100;
const EXCLUDED_DIRS = ['.git', 'node_modules'];

const schema = z.object({
  pattern: z.string().describe('Glob pattern to match files (e.g., **/*.ts, src/**/*.tsx)'),
  path: z.string().optional().describe('Directory to search in (defaults to current directory)'),
});

function isExcluded(filePath: string): boolean {
  const segments = filePath.split('/');
  return segments.some((s) => EXCLUDED_DIRS.includes(s));
}

async function tryRipgrep(pattern: string, cwd: string): Promise<string[] | null> {
  try {
    const proc = Bun.spawn(['rg', '--files', '--glob', pattern, cwd], {
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 60_000,
    });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0 && exitCode !== 1) return null;
    if (!output.trim()) return [];
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return null;
  }
}

async function fallbackBunGlob(pattern: string, cwd: string): Promise<string[]> {
  const glob = new Bun.Glob(pattern);
  const results: string[] = [];
  try {
    for await (const path of glob.scan({ cwd, absolute: true })) {
      results.push(path);
    }
  } catch {
    return [];
  }
  return results;
}

async function getMtime(filePath: string): Promise<number> {
  try {
    const s = await stat(filePath);
    return s.mtimeMs;
  } catch {
    return 0;
  }
}

async function sortByMtime(paths: string[]): Promise<string[]> {
  const withMtime = await Promise.all(
    paths.map(async (p) => ({ path: p, mtime: await getMtime(p) })),
  );
  withMtime.sort((a, b) => b.mtime - a.mtime);
  return withMtime.map((e) => e.path);
}

export default definePlugin({
  id: 'glob',
  domain: 'coding',
  riskLevel: 'safe',
  description: 'Find files matching glob patterns. Supports **/*.ts, src/**/*.tsx, etc.',
  schema,
  execute: async (raw) => {
    const { pattern, path: inputPath } = schema.parse(raw);
    const cwd = inputPath ? resolve(inputPath) : process.cwd();

    let files = await tryRipgrep(pattern, cwd);
    if (files === null || files.length === 0) {
      const bunFiles = await fallbackBunGlob(pattern, cwd);
      if (bunFiles.length > 0 || files === null) files = bunFiles;
    }

    const filtered = (files ?? [])
      .map((f) => (f.startsWith('/') ? f : join(cwd, f)))
      .filter((f) => !isExcluded(f));

    const sorted = await sortByMtime(filtered);
    const truncated = sorted.length > MAX_RESULTS;
    const limited = sorted.slice(0, MAX_RESULTS);

    if (limited.length === 0) {
      return JSON.stringify({
        filePaths: [],
        message: `No files found matching pattern '${pattern}'`,
      });
    }

    return JSON.stringify({
      filePaths: limited,
      totalFound: sorted.length,
      ...(truncated && { truncated: true }),
    });
  },
});

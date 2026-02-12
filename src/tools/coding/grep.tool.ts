import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';

const schema = z.object({
  pattern: z.string().describe('Regex pattern to search for in file contents'),
  path: z.string().optional().describe('Directory to search in (default: current directory)'),
  include: z.string().optional().describe('File glob filter, e.g. "*.ts" or "*.{ts,tsx}"'),
});

const MAX_MATCHES = 100;
const TIMEOUT_MS = 60_000;

async function hasRipgrep(): Promise<boolean> {
  try {
    const proc = Bun.spawn(['which', 'rg'], { stdout: 'pipe', stderr: 'pipe' });
    const code = await proc.exited;
    return code === 0;
  } catch {
    return false;
  }
}

function buildRgArgs(pattern: string, searchPath: string, include?: string): string[] {
  const args = ['rg', '--line-number', '--no-heading', '--color=never', `--max-count=${MAX_MATCHES}`];
  if (include) args.push('--glob', include);
  args.push('--', pattern, searchPath);
  return args;
}

function buildGrepArgs(pattern: string, searchPath: string, include?: string): string[] {
  const args = [
    'grep', '-rn',
    '--exclude-dir=.git', '--exclude-dir=node_modules',
    '--binary-files=without-match',
  ];
  if (include) args.push(`--include=${include}`);
  args.push('--', pattern, searchPath);
  return args;
}

async function runSearch(args: string[], timeoutMs: number): Promise<string> {
  const proc = Bun.spawn(args, {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env },
  });

  const timer = setTimeout(() => proc.kill(), timeoutMs);
  const [stdout, code] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ]);
  clearTimeout(timer);

  if (code !== 0 && code !== 1) {
    const stderr = await new Response(proc.stderr).text();
    if (stderr.trim()) throw new Error(stderr.trim());
  }

  return stdout;
}

function formatOutput(raw: string): string {
  if (!raw.trim()) return 'No matches found.';

  const lines = raw.trim().split('\n');
  const limited = lines.slice(0, MAX_MATCHES);
  return limited.join('\n');
}

export default definePlugin({
  id: 'grep',
  domain: 'coding',
  riskLevel: 'safe',
  description: 'Search file contents using regex patterns. Prefers ripgrep (rg) with fallback to grep.',
  schema,
  execute: async (raw) => {
    const { pattern, path: searchPath, include } = schema.parse(raw);
    const dir = searchPath || '.';

    const useRg = await hasRipgrep();
    const args = useRg
      ? buildRgArgs(pattern, dir, include)
      : buildGrepArgs(pattern, dir, include);

    try {
      const stdout = await runSearch(args, TIMEOUT_MS);
      return formatOutput(stdout);
    } catch (err) {
      return `Search error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

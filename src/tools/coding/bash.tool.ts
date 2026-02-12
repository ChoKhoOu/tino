import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { formatToolResult } from '../types.js';
import { isDangerousCommand } from './bash-blacklist.js';

const MAX_OUTPUT_BYTES = 50 * 1024;
const MAX_OUTPUT_LINES = 2000;
const KEEP_LINES = 1000;
const DEFAULT_TIMEOUT_MS = 120_000;

const schema = z.object({
  command: z.string().describe('The shell command to execute'),
  workdir: z.string().optional().describe('Working directory for command execution'),
  timeout: z.number().optional().describe('Timeout in milliseconds (default: 120000)'),
  description: z.string().optional().describe('Brief description of what this command does'),
});

function truncateOutput(output: string): string {
  if (output.length > MAX_OUTPUT_BYTES) {
    output = output.slice(0, MAX_OUTPUT_BYTES);
  }

  const lines = output.split('\n');
  if (lines.length <= MAX_OUTPUT_LINES) return output;

  const head = lines.slice(0, KEEP_LINES);
  const tail = lines.slice(-KEEP_LINES);
  const omitted = lines.length - KEEP_LINES * 2;
  return [...head, `\n[truncated ${omitted} lines]\n`, ...tail].join('\n');
}

export default definePlugin({
  id: 'bash',
  domain: 'coding',
  riskLevel: 'moderate',
  description: 'Execute shell commands via Bun.spawn(). Supports timeout, working directory, and dangerous command blocking.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);

    if (isDangerousCommand(input.command)) {
      return formatToolResult({
        error: `Blocked: command matches dangerous pattern blacklist`,
        command: input.command,
      });
    }

    const timeoutMs = input.timeout ?? DEFAULT_TIMEOUT_MS;

    try {
      const proc = Bun.spawn(['sh', '-c', input.command], {
        cwd: input.workdir,
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env },
      });

      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; proc.kill(); }, timeoutMs);

      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);

      clearTimeout(timer);
      const exitCode = await proc.exited;

      const result: Record<string, unknown> = {
        exitCode,
        stdout: truncateOutput(stdout),
        stderr,
      };
      if (timedOut) result.error = `Command timed out after ${timeoutMs}ms`;

      return formatToolResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return formatToolResult({
        exitCode: 1,
        stdout: '',
        stderr: '',
        error: message,
      });
    }
  },
});

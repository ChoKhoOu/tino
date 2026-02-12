const MAX_OUTPUT_BYTES = 50 * 1024;
const MAX_OUTPUT_LINES = 2000;
const KEEP_LINES = 500;

export interface BashQuickResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Check if input starts with `!` followed by a non-empty command. */
export function isBashQuickCommand(input: string): boolean {
  return input.startsWith('!') && input.slice(1).trim().length > 0;
}

/** Execute a shell command directly via Bun.spawn and capture output. */
export async function executeBashQuick(command: string): Promise<BashQuickResult> {
  try {
    const proc = Bun.spawn(['sh', '-c', command], {
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env },
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    const exitCode = await proc.exited;
    return { exitCode, stdout, stderr };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { exitCode: 1, stdout: '', stderr: message };
  }
}

function truncateText(text: string): string {
  let result = text;

  if (result.length > MAX_OUTPUT_BYTES) {
    result = result.slice(0, MAX_OUTPUT_BYTES) + '\n[truncated — exceeded 50KB]';
    return result;
  }

  const lines = result.split('\n');
  if (lines.length > MAX_OUTPUT_LINES) {
    const head = lines.slice(0, KEEP_LINES);
    const tail = lines.slice(-KEEP_LINES);
    const omitted = lines.length - KEEP_LINES * 2;
    result = [...head, `\n[truncated ${omitted} lines]\n`, ...tail].join('\n');
  }

  return result;
}

/** Format bash output for display in conversation history. */
export function formatBashOutput(command: string, result: BashQuickResult): string {
  const parts: string[] = [`$ ${command}`];

  if (result.stdout) {
    parts.push(truncateText(result.stdout.trimEnd()));
  }

  if (result.stderr) {
    parts.push(`stderr:\n${truncateText(result.stderr.trimEnd())}`);
  }

  if (result.exitCode !== 0) {
    parts.push(`exit code: ${result.exitCode}`);
  }

  return parts.join('\n\n');
}

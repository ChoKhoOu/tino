import { z } from 'zod';
import { dirname, resolve, normalize } from 'path';
import { mkdir, readFile, lstat, realpath } from 'fs/promises';
import { definePlugin } from '@/domain/index.js';
import { getPostEditDiagnostics } from './lsp-diagnostics-helper.js';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const schema = z.object({
  filePath: z.string().describe('Absolute path to the file to write'),
  content: z.string().describe('Content to write to the file'),
});

function containsGitSegment(filePath: string): boolean {
  const normalized = normalize(filePath);
  const segments = normalized.split('/');
  return segments.includes('.git');
}

function computeDiff(oldText: string, newText: string): { linesAdded: number; linesRemoved: number } {
  const oldLines = new Set(oldText.split('\n'));
  const newLines = new Set(newText.split('\n'));

  let linesAdded = 0;
  let linesRemoved = 0;

  for (const line of newLines) {
    if (!oldLines.has(line)) linesAdded++;
  }
  for (const line of oldLines) {
    if (!newLines.has(line)) linesRemoved++;
  }

  return { linesAdded, linesRemoved };
}

async function isSymlinkEscape(filePath: string): Promise<boolean> {
  const cwd = process.cwd();
  const normalized = normalize(filePath);
  if (!normalized.startsWith(cwd + '/') && normalized !== cwd) return false;

  const relative = normalized.slice(cwd.length + 1);
  const segments = relative.split('/');
  let current = cwd;
  for (const seg of segments) {
    current = resolve(current, seg);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) {
        const real = await realpath(current);
        if (!real.startsWith(cwd + '/') && real !== cwd) return true;
      }
    } catch {
      break;
    }
  }
  return false;
}

export default definePlugin({
  id: 'write_file',
  domain: 'coding',
  riskLevel: 'moderate',
  description: 'Create a new file or overwrite an existing file. Auto-creates parent directories.',
  schema,
  execute: async (raw) => {
    const { filePath, content } = schema.parse(raw);

    if (containsGitSegment(filePath)) {
      return JSON.stringify({ error: 'Refusing to write inside .git/ directory' });
    }

    const contentBytes = Buffer.byteLength(content, 'utf-8');
    if (contentBytes > MAX_SIZE) {
      return JSON.stringify({ error: `Content exceeds 5MB limit (${contentBytes} bytes)` });
    }

    if (await isSymlinkEscape(filePath)) {
      return JSON.stringify({ error: 'Refusing to write: symlink resolves outside project root' });
    }

    let existingContent: string | undefined;
    try {
      existingContent = await readFile(filePath, 'utf-8');
    } catch {
      // File doesn't exist — that's fine
    }

    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });
    await Bun.write(filePath, content);

    const overwritten = existingContent !== undefined;
    const result: Record<string, unknown> = {
      success: true,
      filePath,
      bytesWritten: contentBytes,
      overwritten,
    };

    if (overwritten && existingContent !== undefined) {
      result.diff = computeDiff(existingContent, content);
    }

    const diag = await getPostEditDiagnostics(filePath, content);
    return JSON.stringify(result) + diag;
  },
});

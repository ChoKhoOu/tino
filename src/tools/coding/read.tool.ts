import { z } from 'zod';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { definePlugin } from '@/domain/index.js';

const DEFAULT_LIMIT = 2000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const BINARY_CHECK_SIZE = 8192;

const schema = z.object({
  filePath: z.string().describe('Absolute path to the file or directory to read'),
  offset: z.number().optional().describe('Line number to start from (1-indexed)'),
  limit: z.number().optional().describe('Maximum number of lines to read (default 2000)'),
});

function isGitPath(filePath: string): boolean {
  const segments = filePath.split('/');
  return segments.includes('.git');
}

function hasBinaryContent(buffer: Buffer): boolean {
  const checkLen = Math.min(buffer.length, BINARY_CHECK_SIZE);
  for (let i = 0; i < checkLen; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function formatLines(text: string, offset: number, limit: number) {
  const allLines = text.split('\n');
  if (text.endsWith('\n') && allLines[allLines.length - 1] === '') {
    allLines.pop();
  }
  const totalLines = allLines.length;
  const startIdx = offset - 1;
  const sliced = allLines.slice(startIdx, startIdx + limit);
  const content = sliced
    .map((line, i) => `${startIdx + i + 1}: ${line}`)
    .join('\n');
  const truncated = totalLines > startIdx + limit;
  return { content, totalLines, truncated };
}

async function readDirectory(filePath: string): Promise<string> {
  const dirents = await readdir(filePath, { withFileTypes: true });
  const entries = dirents
    .map((d) => (d.isDirectory() ? `${d.name}/` : d.name))
    .sort();
  return JSON.stringify({ type: 'directory', entries });
}

async function readFile(filePath: string, offset: number, limit: number): Promise<string> {
  const info = await stat(filePath);
  if (info.size > MAX_FILE_SIZE) {
    return JSON.stringify({ error: `File too large: ${info.size} bytes (max ${MAX_FILE_SIZE})` });
  }

  const file = Bun.file(filePath);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (hasBinaryContent(buffer)) {
    return JSON.stringify({ error: `File appears to be binary: ${filePath}` });
  }

  const text = buffer.toString('utf-8');
  if (text.length === 0) {
    return JSON.stringify({ content: '', totalLines: 0, truncated: false });
  }

  const { content, totalLines, truncated } = formatLines(text, offset, limit);
  return JSON.stringify({ content, totalLines, truncated });
}

export default definePlugin({
  id: 'read_file',
  domain: 'coding',
  riskLevel: 'safe',
  description: 'Read file contents with line numbers or list directory entries',
  schema,
  execute: async (raw) => {
    const { filePath, offset: rawOffset, limit: rawLimit } = schema.parse(raw);

    if (isGitPath(filePath)) {
      return JSON.stringify({ error: 'Reading .git directory contents is not allowed' });
    }

    const offset = rawOffset ?? 1;
    const limit = rawLimit ?? DEFAULT_LIMIT;

    try {
      const info = await stat(filePath);
      if (info.isDirectory()) {
        return readDirectory(filePath);
      }
      return readFile(filePath, offset, limit);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ENOENT')) {
        return JSON.stringify({ error: `Path not found: ${filePath}` });
      }
      return JSON.stringify({ error: msg });
    }
  },
});

import { describe, test, expect, afterEach } from 'bun:test';
import { detectEditor, createTempFile, readTempFile, cleanupTempFile } from '../useExternalEditor.js';
import { tmpdir } from 'os';
import { existsSync, unlinkSync } from 'fs';

describe('detectEditor', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('uses $EDITOR when set', () => {
    process.env.EDITOR = 'nano';
    process.env.VISUAL = 'code';
    expect(detectEditor()).toBe('nano');
  });

  test('falls back to $VISUAL when $EDITOR not set', () => {
    delete process.env.EDITOR;
    process.env.VISUAL = 'code';
    expect(detectEditor()).toBe('code');
  });

  test('falls back to vi when neither set', () => {
    delete process.env.EDITOR;
    delete process.env.VISUAL;
    expect(detectEditor()).toBe('vi');
  });

  test('falls back to $VISUAL when $EDITOR is empty string', () => {
    process.env.EDITOR = '';
    process.env.VISUAL = 'code';
    expect(detectEditor()).toBe('code');
  });

  test('falls back to vi when both are empty strings', () => {
    process.env.EDITOR = '';
    process.env.VISUAL = '';
    expect(detectEditor()).toBe('vi');
  });
});

describe('createTempFile', () => {
  const paths: string[] = [];

  afterEach(() => {
    for (const p of paths) {
      if (existsSync(p)) unlinkSync(p);
    }
    paths.length = 0;
  });

  test('creates temp file with correct content', async () => {
    const p = await createTempFile('hello world');
    paths.push(p);
    expect(existsSync(p)).toBe(true);
    const content = await Bun.file(p).text();
    expect(content).toBe('hello world');
  });

  test('creates temp file in os tmpdir', async () => {
    const p = await createTempFile('test');
    paths.push(p);
    expect(p.startsWith(tmpdir())).toBe(true);
  });

  test('creates temp file with .txt extension', async () => {
    const p = await createTempFile('test');
    paths.push(p);
    expect(p.endsWith('.txt')).toBe(true);
  });

  test('creates temp file with empty content', async () => {
    const p = await createTempFile('');
    paths.push(p);
    expect(existsSync(p)).toBe(true);
    const content = await Bun.file(p).text();
    expect(content).toBe('');
  });

  test('handles multiline content', async () => {
    const multiline = 'line1\nline2\nline3';
    const p = await createTempFile(multiline);
    paths.push(p);
    const content = await Bun.file(p).text();
    expect(content).toBe(multiline);
  });
});

describe('readTempFile', () => {
  const paths: string[] = [];

  afterEach(() => {
    for (const p of paths) {
      if (existsSync(p)) unlinkSync(p);
    }
    paths.length = 0;
  });

  test('reads content back from temp file', async () => {
    const p = await createTempFile('original');
    paths.push(p);
    // Simulate editor modifying the file
    await Bun.write(p, 'edited content');
    const result = await readTempFile(p);
    expect(result).toBe('edited content');
  });

  test('trims trailing newline from content', async () => {
    const p = await createTempFile('');
    paths.push(p);
    await Bun.write(p, 'edited\n');
    const result = await readTempFile(p);
    expect(result).toBe('edited');
  });

  test('returns empty string for non-existent file', async () => {
    const result = await readTempFile('/tmp/nonexistent-tino-test-file.txt');
    expect(result).toBe('');
  });
});

describe('cleanupTempFile', () => {
  test('removes the temp file', async () => {
    const p = await createTempFile('cleanup test');
    expect(existsSync(p)).toBe(true);
    cleanupTempFile(p);
    expect(existsSync(p)).toBe(false);
  });

  test('does not throw for non-existent file', () => {
    expect(() => cleanupTempFile('/tmp/nonexistent-tino-test-file.txt')).not.toThrow();
  });
});

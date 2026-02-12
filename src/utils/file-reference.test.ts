import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { parseFileReferences, resolveFileReferences } from './file-reference.js';
import { writeFile, unlink } from 'node:fs/promises';

describe('file-reference', () => {
  describe('parseFileReferences', () => {
    it('should return empty array if no references', () => {
      expect(parseFileReferences('hello world')).toEqual([]);
    });

    it('should extract single reference', () => {
      expect(parseFileReferences('look at @src/index.ts')).toEqual(['src/index.ts']);
    });

    it('should extract multiple references', () => {
      expect(parseFileReferences('compare @foo.ts and @bar.ts')).toEqual(['foo.ts', 'bar.ts']);
    });

    it('should ignore email-like patterns if possible, or just accept them (simple regex)', () => {
      expect(parseFileReferences('contact @support')).toEqual(['support']);
    });

    it('should handle references at start/end', () => {
      expect(parseFileReferences('@start middle @end')).toEqual(['start', 'end']);
    });
  });

  describe('resolveFileReferences', () => {
    const testFile = 'test-ref-file.txt';
    const testContent = 'some content';

    beforeAll(async () => {
      await writeFile(testFile, testContent);
    });

    afterAll(async () => {
      await unlink(testFile);
    });

    it('should replace reference with file content', async () => {
      const input = `read @${testFile}`;
      const result = await resolveFileReferences(input);
      
      expect(result).toContain(`--- ${testFile} ---`);
      expect(result).toContain(testContent);
      expect(result).toContain('--- end ---');
    });

    it('should handle missing files gracefully', async () => {
      const input = 'read @non-existent.txt';
      const result = await resolveFileReferences(input);
      
      expect(result).toContain('Error reading non-existent.txt');
    });

    it('should resolve multiple files', async () => {
      const input = `read @${testFile} and @${testFile}`;
      const result = await resolveFileReferences(input);
      
      const matches = result.match(new RegExp(`--- ${testFile} ---`, 'g'));
      expect(matches?.length).toBe(2);
    });
  });

  describe('scanFiles', () => {
    it('should find files matching pattern', async () => {
      const { scanFiles } = await import('./file-reference.js');
      const cwd = process.cwd();
      const results = await scanFiles('file-reference.test', cwd);
      expect(results).toContain('src/utils/file-reference.test.ts');
    });
  });
});

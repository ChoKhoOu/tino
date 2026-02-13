import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { OutputStyle } from '../types.js';

const TEST_DIR = join(tmpdir(), `tino-style-loader-test-${Date.now()}`);

function writeStyleFile(name: string, content: string): string {
  const filePath = join(TEST_DIR, `${name}.md`);
  writeFileSync(filePath, content);
  return filePath;
}

describe('style loader', () => {
  let parseStyleFile: (content: string, path: string, source: OutputStyle['source']) => OutputStyle;
  let discoverCustomStyles: (dirs: string[]) => OutputStyle[];

  beforeEach(async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const mod = await import('../loader.js');
    parseStyleFile = mod.parseStyleFile;
    discoverCustomStyles = mod.discoverCustomStyles;
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('parseStyleFile', () => {
    it('parses markdown with YAML frontmatter', () => {
      const content = `---
name: my-style
description: A custom style
---
Be very formal and use academic language.`;

      const style = parseStyleFile(content, '/fake/path.md', 'user');
      expect(style.name).toBe('my-style');
      expect(style.description).toBe('A custom style');
      expect(style.systemPromptModifier).toBe('Be very formal and use academic language.');
      expect(style.source).toBe('user');
    });

    it('throws when name is missing', () => {
      const content = `---
description: No name
---
Body text.`;
      expect(() => parseStyleFile(content, '/fake/path.md', 'user')).toThrow('name');
    });

    it('throws when description is missing', () => {
      const content = `---
name: no-desc
---
Body text.`;
      expect(() => parseStyleFile(content, '/fake/path.md', 'user')).toThrow('description');
    });

    it('trims whitespace from body', () => {
      const content = `---
name: trimmed
description: Test trim
---

  Some instructions with whitespace.

`;
      const style = parseStyleFile(content, '/fake/path.md', 'project');
      expect(style.systemPromptModifier).toBe('Some instructions with whitespace.');
    });
  });

  describe('discoverCustomStyles', () => {
    it('returns empty array for nonexistent directory', () => {
      const styles = discoverCustomStyles(['/nonexistent/path']);
      expect(styles).toEqual([]);
    });

    it('discovers .md files in directory', () => {
      writeStyleFile('formal', `---
name: formal
description: Formal style
---
Use formal language.`);

      const styles = discoverCustomStyles([TEST_DIR]);
      expect(styles).toHaveLength(1);
      expect(styles[0].name).toBe('formal');
    });

    it('skips invalid files silently', () => {
      writeStyleFile('valid', `---
name: valid
description: Valid style
---
Valid body.`);
      writeStyleFile('invalid', 'no frontmatter here');

      const styles = discoverCustomStyles([TEST_DIR]);
      expect(styles).toHaveLength(1);
      expect(styles[0].name).toBe('valid');
    });

    it('scans multiple directories', () => {
      const dir2 = join(TEST_DIR, 'subdir');
      mkdirSync(dir2, { recursive: true });

      writeStyleFile('style-a', `---
name: style-a
description: Style A
---
A instructions.`);
      writeFileSync(join(dir2, 'style-b.md'), `---
name: style-b
description: Style B
---
B instructions.`);

      const styles = discoverCustomStyles([TEST_DIR, dir2]);
      const names = styles.map((s: OutputStyle) => s.name);
      expect(names).toContain('style-a');
      expect(names).toContain('style-b');
    });

    it('ignores non-.md files', () => {
      writeStyleFile('good', `---
name: good
description: Good style
---
Good body.`);
      writeFileSync(join(TEST_DIR, 'readme.txt'), 'not a style');

      const styles = discoverCustomStyles([TEST_DIR]);
      expect(styles).toHaveLength(1);
    });
  });
});

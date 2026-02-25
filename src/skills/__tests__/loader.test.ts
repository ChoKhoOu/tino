import { afterAll, describe, test, expect, spyOn, beforeEach } from 'bun:test';
import * as fs from 'fs';
import { parseSkillFile } from '../loader.js';

const mockReadFileSync = spyOn(fs, 'readFileSync') as unknown as ReturnType<typeof spyOn>;

// loadSkillFromPath and extractSkillMetadata use fs.readFileSync internally,
// so spyOn(fs, 'readFileSync') will intercept their calls via ESM live bindings.
const { loadSkillFromPath, extractSkillMetadata } = await import('../loader.js');

afterAll(() => {
  mockReadFileSync.mockRestore();
});

describe('parseSkillFile', () => {
  const validContent = [
    '---',
    'name: test-skill',
    'description: A test skill for unit testing',
    '---',
    '',
    'These are the instructions.',
    '',
  ].join('\n');

  test('valid frontmatter returns skill object', () => {
    const skill = parseSkillFile(validContent, '/path/to/SKILL.md', 'builtin');
    expect(skill.name).toBe('test-skill');
    expect(skill.description).toBe('A test skill for unit testing');
    expect(skill.path).toBe('/path/to/SKILL.md');
    expect(skill.source).toBe('builtin');
    expect(skill.instructions).toBe('These are the instructions.');
  });

  test('missing name throws', () => {
    const content = [
      '---',
      'description: A test skill',
      '---',
      'Instructions here.',
    ].join('\n');
    expect(() => parseSkillFile(content, '/path/SKILL.md', 'project')).toThrow(
      "missing required 'name' field",
    );
  });

  test('missing description throws', () => {
    const content = [
      '---',
      'name: my-skill',
      '---',
      'Instructions here.',
    ].join('\n');
    expect(() => parseSkillFile(content, '/path/SKILL.md', 'project')).toThrow(
      "missing required 'description' field",
    );
  });

  test('name that is not a string throws', () => {
    const content = [
      '---',
      'name: 123',
      'description: A test skill',
      '---',
      'Instructions.',
    ].join('\n');
    expect(() => parseSkillFile(content, '/path/SKILL.md', 'user')).toThrow(
      "missing required 'name' field",
    );
  });

  test('instructions are trimmed', () => {
    const content = [
      '---',
      'name: trimmed-skill',
      'description: Test trimming',
      '---',
      '',
      '  Some instructions with whitespace  ',
      '',
      '',
    ].join('\n');
    const skill = parseSkillFile(content, '/path/SKILL.md', 'builtin');
    expect(skill.instructions).toBe('Some instructions with whitespace');
  });
});

describe('extractSkillMetadata', () => {
  beforeEach(() => {
    mockReadFileSync.mockReset();
  });

  test('returns only metadata without instructions', () => {
    const content = [
      '---',
      'name: meta-skill',
      'description: Metadata only',
      '---',
      '',
      'Full instructions here.',
    ].join('\n');
    mockReadFileSync.mockReturnValue(content);
    const meta = extractSkillMetadata('/skills/SKILL.md', 'project');
    expect(meta.name).toBe('meta-skill');
    expect(meta.description).toBe('Metadata only');
    expect(meta.path).toBe('/skills/SKILL.md');
    expect(meta.source).toBe('project');
    expect((meta as Record<string, unknown>).instructions).toBeUndefined();
  });

  test('missing name throws', () => {
    const content = [
      '---',
      'description: No name here',
      '---',
      'Instructions.',
    ].join('\n');
    mockReadFileSync.mockReturnValue(content);
    expect(() => extractSkillMetadata('/skills/SKILL.md', 'builtin')).toThrow();
  });
});

describe('loadSkillFromPath', () => {
  beforeEach(() => {
    mockReadFileSync.mockReset();
  });

  test('reads file and parses skill', () => {
    const content = [
      '---',
      'name: loaded-skill',
      'description: Loaded from path',
      '---',
      '',
      'Loaded instructions.',
    ].join('\n');
    mockReadFileSync.mockReturnValue(content);
    const skill = loadSkillFromPath('/skills/SKILL.md', 'user');
    expect(skill.name).toBe('loaded-skill');
    expect(skill.description).toBe('Loaded from path');
    expect(skill.path).toBe('/skills/SKILL.md');
    expect(skill.source).toBe('user');
    expect(skill.instructions).toBe('Loaded instructions.');
  });
});

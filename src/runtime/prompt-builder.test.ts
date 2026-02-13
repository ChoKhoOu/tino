import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { buildSystemPrompt } from './prompt-builder.js';
import { setSetting } from '@/config/settings.js';
import { clearStyleCache, setCustomStyleProvider, _overrideActiveStyleName } from '@/styles/registry.js';

describe('buildSystemPrompt', () => {
  const mockToolDescriptions = 'Tool: mock-tool\nDescription: A mock tool.';
  const mockSkillsSection = '- Skill: mock-skill';

  beforeEach(() => {
    clearStyleCache();
    setCustomStyleProvider(null);
    setSetting('outputStyle', 'default');
  });

  afterEach(() => {
    setSetting('outputStyle', 'default');
    clearStyleCache();
  });

  test('should include dual identity', () => {
    const prompt = buildSystemPrompt(mockToolDescriptions);
    expect(prompt).toContain('You are Tino, an AI coding assistant and quantitative trading workbench');
  });

  test('should include coding tool policies', () => {
    const prompt = buildSystemPrompt(mockToolDescriptions);
    expect(prompt).toContain('Always read a file before editing it');
    expect(prompt).toContain('Use precise oldString matching');
    expect(prompt).toContain('Use for creating new files or full file replacement');
    expect(prompt).toContain('Use for running commands');
    expect(prompt).toContain('Use for searching code content by regex pattern');
    expect(prompt).toContain('Use for finding files by name pattern');
  });

  test('should include safety constraints', () => {
    const prompt = buildSystemPrompt(mockToolDescriptions);
    expect(prompt).toContain('## Safety Constraints');
    expect(prompt).toContain('Never run destructive commands');
  });

  test('should inject dynamic context', () => {
    const options = {
      cwd: '/test/cwd',
      gitBranch: 'feature/test',
      projectLanguages: ['TypeScript', 'Python'],
      agentsMd: '# Project Instructions\n\nDo this.',
    };
    const prompt = buildSystemPrompt(mockToolDescriptions, undefined, options);
    
    expect(prompt).toContain('Current Working Directory: /test/cwd');
    expect(prompt).toContain('Git Branch: feature/test');
    expect(prompt).toContain('Project Languages: TypeScript, Python');
    expect(prompt).toContain('# Project Instructions');
    expect(prompt).toContain('Do this.');
  });

  test('should keep financial tool policies', () => {
    const prompt = buildSystemPrompt(mockToolDescriptions);
    expect(prompt).toContain('Only use tools when the query requires external or fresh data');
    expect(prompt).toContain('Prefer specialized domain tools over generic search tools');
  });

  test('should include tool descriptions and skills', () => {
    const prompt = buildSystemPrompt(mockToolDescriptions, mockSkillsSection);
    expect(prompt).toContain(mockToolDescriptions);
    expect(prompt).toContain(mockSkillsSection);
  });

  test('should stay under 8000 tokens (approx 32000 chars)', () => {
    const prompt = buildSystemPrompt(mockToolDescriptions);
    expect(prompt.length).toBeLessThan(32000);
  });

  test('should not append style section for default style', () => {
    const prompt = buildSystemPrompt(mockToolDescriptions);
    expect(prompt).not.toContain('## Output Style');
  });

  test('should append style modifier when non-default style is active', () => {
    _overrideActiveStyleName('concise');
    const prompt = buildSystemPrompt(mockToolDescriptions);
    expect(prompt).toContain('## Output Style: concise');
    expect(prompt).toContain('concise');
  });

  test('should append trading style modifier', () => {
    _overrideActiveStyleName('trading');
    const prompt = buildSystemPrompt(mockToolDescriptions);
    expect(prompt).toContain('## Output Style: trading');
    expect(prompt).toContain('quantitative');
  });
});

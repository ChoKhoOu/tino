import { describe, expect, test } from 'bun:test';
import {
  buildSkillMetadataSection,
  clearSkillCache,
  discoverSkills,
  getSkill,
} from '../../skills/index.js';

const EXPECTED_BUILTIN_SKILLS = [
  'backtest',
  'comprehensive-research',
  'dcf-valuation',
  'factor-analysis',
  'funding-rate-arb',
  'live-trade',
  'options-analysis',
  'paper-trade',
  'strategy-generation',
] as const;

describe('skill discovery and loading integration', () => {
  test('discoverSkills finds all 9 builtin skills', () => {
    clearSkillCache();
    const builtinSkills = discoverSkills().filter((skill) => skill.source === 'builtin');
    const names = builtinSkills.map((skill) => skill.name).sort();

    expect(builtinSkills).toHaveLength(9);
    expect(names).toEqual([...EXPECTED_BUILTIN_SKILLS].sort());
  });

  test('getSkill loads full instructions for each builtin skill', () => {
    clearSkillCache();

    for (const skillName of EXPECTED_BUILTIN_SKILLS) {
      const skill = getSkill(skillName);
      expect(skill).toBeDefined();
      expect(skill?.name).toBe(skillName);
      expect(skill?.instructions.length ?? 0).toBeGreaterThan(20);
      expect(skill?.path.endsWith('/SKILL.md')).toBe(true);
    }
  });

  test('buildSkillMetadataSection includes all builtin skills', () => {
    clearSkillCache();
    const section = buildSkillMetadataSection();

    for (const skillName of EXPECTED_BUILTIN_SKILLS) {
      expect(section).toContain(`**${skillName}**`);
    }
  });

  test('builtin skill names match the expected list', () => {
    clearSkillCache();
    const names = discoverSkills()
      .filter((skill) => skill.source === 'builtin')
      .map((skill) => skill.name)
      .sort();

    expect(names).toEqual([...EXPECTED_BUILTIN_SKILLS].sort());
  });
});

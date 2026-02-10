import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getSkill, discoverSkills } from '@/skills/index.js';

const schema = z.object({
  skill: z.string().describe('Name of the skill to invoke (e.g., "dcf")'),
  args: z.string().optional().describe('Optional arguments for the skill (e.g., ticker symbol)'),
});

export default definePlugin({
  id: 'skill',
  domain: 'skill',
  riskLevel: 'safe',
  description:
    'Execute a skill to get specialized instructions for a task. Returns instructions to follow.',
  schema,
  execute: async (raw) => {
    const { skill, args } = schema.parse(raw);
    const skillDef = getSkill(skill);

    if (!skillDef) {
      const available = discoverSkills().map((s) => s.name).join(', ');
      return `Error: Skill "${skill}" not found. Available skills: ${available || 'none'}`;
    }

    let result = `## Skill: ${skillDef.name}\n\n`;

    if (args) {
      result += `**Arguments provided:** ${args}\n\n`;
    }

    result += skillDef.instructions;

    return result;
  },
});

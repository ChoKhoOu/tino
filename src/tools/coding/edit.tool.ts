import { z } from 'zod';
import { readFile } from 'fs/promises';
import { normalize } from 'path';
import { definePlugin } from '@/domain/index.js';
import { findMatches, applyReplacement, applyAllReplacements } from './edit-matcher.js';

const schema = z.object({
  filePath: z.string().describe('Absolute path to the file to edit'),
  oldString: z.string().describe('The text to find and replace'),
  newString: z.string().describe('The replacement text'),
  replaceAll: z.boolean().optional().describe('Replace all occurrences (default false)'),
});

function containsGitSegment(filePath: string): boolean {
  const normalized = normalize(filePath);
  const segments = normalized.split('/');
  return segments.includes('.git');
}

export default definePlugin({
  id: 'edit_file',
  domain: 'coding',
  riskLevel: 'moderate',
  description: 'Search-and-replace editing with 3-level fuzzy matching: exact, whitespace-normalized, indent-flexible.',
  schema,
  execute: async (raw) => {
    const { filePath, oldString, newString, replaceAll } = schema.parse(raw);

    if (containsGitSegment(filePath)) {
      return JSON.stringify({ error: 'Refusing to edit files inside .git/ directory' });
    }

    if (oldString === '') {
      return JSON.stringify({ error: 'oldString must not be empty' });
    }

    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: msg });
    }

    if (replaceAll) {
      const { result, count } = applyAllReplacements(content, oldString, newString);
      if (count === 0) {
        return JSON.stringify({ error: 'oldString not found in file content' });
      }
      await Bun.write(filePath, result);
      return JSON.stringify({ success: true, filePath, replacements: count });
    }

    const matches = findMatches(content, oldString);

    if (matches.length === 0) {
      return JSON.stringify({ error: 'oldString not found in file content' });
    }

    if (matches.length > 1) {
      return JSON.stringify({
        error: `Found multiple matches (${matches.length}) for oldString. Use replaceAll=true or provide more context.`,
      });
    }

    const updated = applyReplacement(content, matches[0], newString);
    await Bun.write(filePath, updated);

    return JSON.stringify({
      success: true,
      filePath,
      matchLevel: matches[0].level,
      replacements: 1,
    });
  },
});

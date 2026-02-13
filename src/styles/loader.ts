import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import matter from 'gray-matter';
import type { OutputStyle, StyleSource } from './types.js';

export function parseStyleFile(content: string, path: string, source: StyleSource): OutputStyle {
  const { data, content: body } = matter(content);

  if (!data.name || typeof data.name !== 'string') {
    throw new Error(`Style at ${path} is missing required 'name' field in frontmatter`);
  }
  if (!data.description || typeof data.description !== 'string') {
    throw new Error(`Style at ${path} is missing required 'description' field in frontmatter`);
  }

  return {
    name: data.name,
    description: data.description,
    systemPromptModifier: body.trim(),
    source,
  };
}

function scanDirectory(dirPath: string, source: StyleSource): OutputStyle[] {
  if (!existsSync(dirPath)) return [];

  const styles: OutputStyle[] = [];
  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const filePath = join(dirPath, entry.name);
    try {
      const content = readFileSync(filePath, 'utf-8');
      styles.push(parseStyleFile(content, filePath, source));
    } catch {
      // Skip invalid style files silently
    }
  }

  return styles;
}

const SOURCE_FOR_DIR: Record<string, StyleSource> = {};

export function discoverCustomStyles(dirs: string[]): OutputStyle[] {
  const styles: OutputStyle[] = [];
  for (const dir of dirs) {
    const source = SOURCE_FOR_DIR[dir] ?? 'project';
    styles.push(...scanDirectory(dir, source));
  }
  return styles;
}

export function getCustomStyleDirs(): string[] {
  return [
    join(homedir(), '.tino', 'styles'),
    join(process.cwd(), '.tino', 'styles'),
  ];
}

export function loadCustomStyles(): OutputStyle[] {
  const dirs = getCustomStyleDirs();
  SOURCE_FOR_DIR[dirs[0]] = 'user';
  SOURCE_FOR_DIR[dirs[1]] = 'project';
  return discoverCustomStyles(dirs);
}

import { readFileSync } from 'fs';
import matter from 'gray-matter';
import type { AgentSource } from '@/domain/agent-def.js';
import type { AgentConfig, DiscoveredAgentConfig } from './types.js';

function parseTools(value: unknown, path: string): string[] {
  if (typeof value === 'undefined') {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Agent at ${path} has invalid frontmatter: 'tools' must be a string array`);
  }

  return value;
}

export function parseAgentConfigFile(content: string, path: string): AgentConfig {
  const { data, content: body } = matter(content);

  if (!data.name || typeof data.name !== 'string') {
    throw new Error(`Agent at ${path} is missing required 'name' field in frontmatter`);
  }

  if (!data.description || typeof data.description !== 'string') {
    throw new Error(`Agent at ${path} is missing required 'description' field in frontmatter`);
  }

  if (typeof data.temperature !== 'undefined' && typeof data.temperature !== 'number') {
    throw new Error(`Agent at ${path} has invalid frontmatter: 'temperature' must be a number`);
  }

  return {
    name: data.name,
    description: data.description,
    systemPrompt: body.trim(),
    model: typeof data.model === 'string' ? data.model : undefined,
    temperature: data.temperature,
    allowedTools: parseTools(data.tools, path),
  };
}

export function loadAgentConfigFromPath(path: string, source: AgentSource): DiscoveredAgentConfig {
  const content = readFileSync(path, 'utf-8');
  const parsed = parseAgentConfigFile(content, path);
  return {
    ...parsed,
    path,
    source,
  };
}

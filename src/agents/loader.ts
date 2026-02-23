import { readFileSync } from 'fs';
import matter from 'gray-matter';
import type { AgentSource } from '@/domain/agent-def.js';
import type { AgentConfig, DiscoveredAgentConfig } from './types.js';

function parseTools(value: unknown, path: string): string[] | undefined {
  if (typeof value === 'undefined') {
    return undefined;
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

  if (typeof data.description !== 'undefined' && typeof data.description !== 'string') {
    throw new Error(`Agent at ${path} has invalid frontmatter: 'description' must be a string`);
  }

  if (typeof data.temperature !== 'undefined' && typeof data.temperature !== 'number') {
    throw new Error(`Agent at ${path} has invalid frontmatter: 'temperature' must be a number`);
  }

  if (typeof data.maxTurns !== 'undefined' && typeof data.maxTurns !== 'number') {
    throw new Error(`Agent at ${path} has invalid frontmatter: 'maxTurns' must be a number`);
  }

  if (typeof data.color !== 'undefined' && typeof data.color !== 'string') {
    throw new Error(`Agent at ${path} has invalid frontmatter: 'color' must be a string`);
  }

  return {
    id: typeof data.id === 'string' ? data.id : undefined,
    name: data.name,
    description: typeof data.description === 'string' ? data.description : undefined,
    systemPrompt: body.trim(),
    model: typeof data.model === 'string' ? data.model : undefined,
    temperature: data.temperature,
    maxTurns: data.maxTurns,
    color: data.color,
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

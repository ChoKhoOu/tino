import matter from 'gray-matter';
import type { AgentDefinition, AgentSource } from '@/domain/agent-def.js';

export function parseAgentFile(content: string, path: string, source: AgentSource): AgentDefinition {
  const { data, content: body } = matter(content);

  if (!data.id || typeof data.id !== 'string') {
    throw new Error(`Agent at ${path} is missing required 'id' field in frontmatter`);
  }
  if (!data.name || typeof data.name !== 'string') {
    throw new Error(`Agent at ${path} is missing required 'name' field in frontmatter`);
  }

  return {
    id: data.id,
    name: data.name,
    systemPrompt: body.trim(),
    model: typeof data.model === 'string' ? data.model : undefined,
    tools: Array.isArray(data.tools) ? data.tools : undefined,
    maxTurns: typeof data.maxTurns === 'number' ? data.maxTurns : undefined,
    color: typeof data.color === 'string' ? data.color : undefined,
    path,
    source,
  };
}

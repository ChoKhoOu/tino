import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import type { AgentDefinition, AgentSource } from '@/domain/agent-def.js';
import type { DiscoveredAgentConfig } from './types.js';
import { loadAgentConfigFromPath } from './loader.js';
import { toAgentDefinition } from './types.js';

interface DiscoverAgentOptions {
  cwd?: string;
  homeDir?: string;
}

interface AgentDirectory {
  path: string;
  source: AgentSource;
}

let cache: Map<string, DiscoveredAgentConfig> | null = null;

function getAgentDirectories(options: DiscoverAgentOptions): AgentDirectory[] {
  const cwd = options.cwd ?? process.cwd();
  const home = options.homeDir ?? homedir();

  return [
    { path: join(home, '.tino', 'agents'), source: 'user' },
    { path: join(cwd, '.tino', 'agents'), source: 'project' },
  ];
}

function scanDirectory(dir: AgentDirectory): DiscoveredAgentConfig[] {
  if (!existsSync(dir.path)) {
    return [];
  }

  const results: DiscoveredAgentConfig[] = [];
  const markdownFiles = new Bun.Glob('*.md').scanSync({ cwd: dir.path });

  for (const relativePath of markdownFiles) {
    const filePath = resolve(dir.path, relativePath);
    try {
      results.push(loadAgentConfigFromPath(filePath, dir.source));
    } catch {}
  }

  return results;
}

export function discoverAgentConfigs(options: DiscoverAgentOptions = {}): DiscoveredAgentConfig[] {
  if (!options.cwd && !options.homeDir && cache) {
    return Array.from(cache.values());
  }

  const discovered = new Map<string, DiscoveredAgentConfig>();

  for (const directory of getAgentDirectories(options)) {
    const found = scanDirectory(directory);
    for (const agent of found) {
      discovered.set(agent.name, agent);
    }
  }

  if (!options.cwd && !options.homeDir) {
    cache = discovered;
  }

  return Array.from(discovered.values());
}

export function discoverAgentDefinitions(options: DiscoverAgentOptions = {}): AgentDefinition[] {
  return discoverAgentConfigs(options).map(toAgentDefinition);
}

export function clearAgentRegistryCache(): void {
  cache = null;
}

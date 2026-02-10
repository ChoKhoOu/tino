import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { ToolPlugin } from '@/domain/tool-plugin.js';

const PLUGIN_DIR_NAME = 'plugins';

function getPluginDirs(): string[] {
  return [
    join(homedir(), '.tino', PLUGIN_DIR_NAME),
    join(process.cwd(), '.tino', PLUGIN_DIR_NAME),
  ];
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    await readdir(dir);
    return true;
  } catch {
    return false;
  }
}

function isValidPlugin(value: unknown): value is ToolPlugin {
  if (value == null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.schema !== 'undefined' &&
    typeof obj.execute === 'function'
  );
}

async function loadPluginFile(filePath: string): Promise<ToolPlugin | null> {
  try {
    const mod = await import(filePath);
    const plugin = mod.default ?? mod;
    if (!isValidPlugin(plugin)) {
      console.warn(`[plugins] Invalid plugin (missing id/schema/execute): ${filePath}`);
      return null;
    }
    return plugin;
  } catch (err) {
    console.warn(`[plugins] Failed to load plugin: ${filePath}`, err);
    return null;
  }
}

async function scanDir(dir: string): Promise<ToolPlugin[]> {
  if (!(await dirExists(dir))) return [];

  const entries = await readdir(dir, { withFileTypes: true });
  const tsFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.ts'))
    .map((e) => resolve(dir, e.name));

  const results = await Promise.all(tsFiles.map(loadPluginFile));
  return results.filter((p): p is ToolPlugin => p !== null);
}

export async function discoverPlugins(): Promise<ToolPlugin[]> {
  const dirs = getPluginDirs();
  const nested = await Promise.all(dirs.map(scanDir));
  const plugins = nested.flat();

  const seen = new Set<string>();
  return plugins.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

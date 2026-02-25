import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { defaultRiskJson } from '@/risk/risk-config.js';

export interface InitResult {
  created: string[];
  skipped: string[];
}

export interface InitOptions {
  provider?: string;
  exchange?: string;
  defaultPair?: string;
}

// Risk config template is loaded from risk-config module

function buildDefaultSettings(options?: InitOptions) {
  return {
    provider: options?.provider ?? 'openai',
    exchange: options?.exchange ?? '',
    defaultPair: options?.defaultPair ?? 'BTCUSDT',
  };
}

const DEFAULT_PERMISSIONS = {
  rules: [
    { tool: 'trading_*', action: 'ask' },
    { tool: '*', action: 'allow' },
  ],
  defaultAction: 'ask',
};

const TINO_MD_TEMPLATE = `# TINO Project Knowledge Base

## Overview
Describe your project and trading goals here.

## Strategies
List your active strategies and their parameters.

## Data Sources
Document which data providers and instruments you use.

## Notes
Additional context for the AI agent.
`;

interface FileEntry {
  path: string;
  label: string;
  content?: string;
  isDir?: boolean;
}

function getFileEntries(projectDir: string, options?: InitOptions): FileEntry[] {
  const tinoDir = join(projectDir, '.tino');
  const settings = buildDefaultSettings(options);
  return [
    { path: tinoDir, label: '.tino/', isDir: true },
    { path: join(tinoDir, 'settings.json'), label: '.tino/settings.json', content: JSON.stringify(settings, null, 2) },
    { path: join(tinoDir, 'permissions.json'), label: '.tino/permissions.json', content: JSON.stringify(DEFAULT_PERMISSIONS, null, 2) },
    { path: join(tinoDir, 'risk.json'), label: '.tino/risk.json', content: defaultRiskJson() },
    { path: join(projectDir, 'TINO.md'), label: 'TINO.md', content: TINO_MD_TEMPLATE },
  ];
}

export function runInitProject(projectDir: string, options?: InitOptions): InitResult {
  const created: string[] = [];
  const skipped: string[] = [];

  for (const entry of getFileEntries(projectDir, options)) {
    if (existsSync(entry.path)) {
      skipped.push(entry.label);
      continue;
    }
    if (entry.isDir) {
      mkdirSync(entry.path, { recursive: true });
    } else {
      const dir = join(entry.path, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(entry.path, entry.content ?? '');
    }
    created.push(entry.label);
  }

  return { created, skipped };
}

export function formatInitOutput(result: InitResult): string {
  const lines: string[] = [];

  if (result.created.length > 0) {
    lines.push('Created:');
    for (const f of result.created) {
      lines.push(`  + ${f}`);
    }
  }

  if (result.skipped.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('Skipped (already exist):');
    for (const f of result.skipped) {
      lines.push(`  - ${f}`);
    }
  }

  if (result.created.length === 0) {
    lines.push('');
    lines.push('Project already initialized.');
  }

  return lines.join('\n');
}

import type { PermissionConfig, PermissionRule } from '@/domain/index.js';
import {
  getNextPermissionMode,
  resolvePermissionModeDecision,
  type PermissionDecision as ModePermissionDecision,
  type PermissionMode,
} from '@/domain/permission-mode.js';

function matchGlob(pattern: string, value: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}

function ruleMatches(rule: PermissionRule, toolId: string, resource?: string): boolean {
  if (!matchGlob(rule.tool, toolId)) {
    return false;
  }

  if (rule.resource !== undefined) {
    if (resource === undefined) {
      return false;
    }
    return matchGlob(rule.resource, resource);
  }

  return true;
}

export type PermissionDecision = ModePermissionDecision;

export class PermissionEngine {
  private readonly config: PermissionConfig;
  private currentMode: PermissionMode;

  constructor(config: PermissionConfig, initialMode: PermissionMode = 'default') {
    this.config = config;
    this.currentMode = initialMode;
  }

  getMode(): PermissionMode {
    return this.currentMode;
  }

  setMode(mode: PermissionMode): void {
    this.currentMode = mode;
  }

  cycleMode(): PermissionMode {
    this.currentMode = getNextPermissionMode(this.currentMode);
    return this.currentMode;
  }

  check(toolId: string, resource?: string): PermissionDecision {
    const configuredDecision = this.resolveConfiguredDecision(toolId, resource);
    return resolvePermissionModeDecision(this.currentMode, toolId, configuredDecision);
  }

  private resolveConfiguredDecision(toolId: string, resource?: string): PermissionDecision {
    for (const rule of this.config.rules) {
      if (ruleMatches(rule, toolId, resource)) {
        return rule.action;
      }
    }
    return this.config.defaultAction;
  }
}

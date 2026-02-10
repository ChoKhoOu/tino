import type { PermissionConfig, PermissionRule } from '@/domain/index.js';

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

export type PermissionDecision = 'allow' | 'ask' | 'deny';

export class PermissionEngine {
  private readonly config: PermissionConfig;

  constructor(config: PermissionConfig) {
    this.config = config;
  }

  check(toolId: string, resource?: string): PermissionDecision {
    for (const rule of this.config.rules) {
      if (ruleMatches(rule, toolId, resource)) {
        return rule.action;
      }
    }
    return this.config.defaultAction;
  }
}

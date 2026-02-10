import { existsSync, readFileSync } from 'fs';

const PERMISSIONS_FILE = '.tino/permissions.json';

export interface PermissionRule {
  tool: string;
  resource?: string;
  action: 'allow' | 'ask' | 'deny';
}

export interface PermissionConfig {
  rules: PermissionRule[];
  defaultAction: 'ask' | 'deny';
}

const DEFAULT_PERMISSIONS: PermissionConfig = {
  rules: [
    { tool: 'trading_*', action: 'ask' },
    { tool: '*', action: 'allow' },
  ],
  defaultAction: 'ask',
};

export function loadPermissions(): PermissionConfig {
  if (!existsSync(PERMISSIONS_FILE)) {
    return DEFAULT_PERMISSIONS;
  }

  try {
    const content = readFileSync(PERMISSIONS_FILE, 'utf-8');
    const parsed = JSON.parse(content);

    if (!parsed.rules || !Array.isArray(parsed.rules)) {
      return DEFAULT_PERMISSIONS;
    }

    return {
      rules: parsed.rules,
      defaultAction: parsed.defaultAction ?? 'ask',
    };
  } catch {
    return DEFAULT_PERMISSIONS;
  }
}

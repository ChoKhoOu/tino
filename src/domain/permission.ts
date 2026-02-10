export interface PermissionRule {
  /** Glob-capable: e.g., "finance:*", "browser:navigate" */
  tool: string;
  resource?: string;
  action: 'allow' | 'ask' | 'deny';
}

export interface PermissionConfig {
  rules: PermissionRule[];
  defaultAction: 'ask' | 'deny';
}

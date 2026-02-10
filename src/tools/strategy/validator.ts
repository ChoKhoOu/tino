import type { StrategyValidationResult } from './types.js';

type DangerousImportRule = {
  module: string;
  pattern: RegExp;
};

const DANGEROUS_IMPORT_RULES: DangerousImportRule[] = [
  { module: 'os', pattern: /^\s*import\s+os(?:\s|,|$)/m },
  { module: 'subprocess', pattern: /^\s*import\s+subprocess(?:\s|,|$)/m },
  { module: 'socket', pattern: /^\s*import\s+socket(?:\s|,|$)/m },
  { module: 'shutil', pattern: /^\s*import\s+shutil(?:\s|,|$)/m },
  { module: 'requests', pattern: /^\s*import\s+requests(?:\s|,|$)/m },
  { module: 'urllib', pattern: /^\s*import\s+urllib(?:\.[A-Za-z_][A-Za-z0-9_]*)?(?:\s|,|$)/m },
  { module: 'os', pattern: /^\s*from\s+os\s+import\s+/m },
  { module: 'subprocess', pattern: /^\s*from\s+subprocess\s+import\s+/m },
  { module: 'socket', pattern: /^\s*from\s+socket\s+import\s+/m },
  { module: 'shutil', pattern: /^\s*from\s+shutil\s+import\s+/m },
  { module: 'requests', pattern: /^\s*from\s+requests\s+import\s+/m },
  { module: 'urllib', pattern: /^\s*from\s+urllib(?:\.[A-Za-z_][A-Za-z0-9_]*)?\s+import\s+/m },
  { module: 'pathlib', pattern: /^\s*from\s+pathlib\s+import\s+/m },
];

const DANGEROUS_EXECUTION_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'exec()', pattern: /\bexec\s*\(/ },
  { label: 'eval()', pattern: /\beval\s*\(/ },
  { label: 'compile()', pattern: /\bcompile\s*\(/ },
  { label: '__import__()', pattern: /\b__import__\s*\(/ },
];

const STRATEGY_CLASS_PATTERN = /class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*Strategy[^)]*)\)\s*:/m;

export function extractStrategyClassName(code: string): string | null {
  const match = code.match(STRATEGY_CLASS_PATTERN);
  return match?.[1] ?? null;
}

export function validateStrategyCode(code: string): StrategyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const rule of DANGEROUS_IMPORT_RULES) {
    if (rule.pattern.test(code)) {
      errors.push(`Dangerous import detected: ${rule.module}`);
    }
  }

  for (const execRule of DANGEROUS_EXECUTION_PATTERNS) {
    if (execRule.pattern.test(code)) {
      errors.push(`Dynamic code execution is not allowed: ${execRule.label}`);
    }
  }

  if (!STRATEGY_CLASS_PATTERN.test(code)) {
    errors.push('Generated code must include a class that extends Strategy');
  }

  if (!/\bdef\s+on_start\s*\(/.test(code)) {
    warnings.push('Missing recommended lifecycle method: on_start');
  }

  if (!/\bdef\s+on_bar\s*\(/.test(code)) {
    warnings.push('Missing recommended lifecycle method: on_bar');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

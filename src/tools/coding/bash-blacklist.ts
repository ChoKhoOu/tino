const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+(-\w*\s+)*-rf\s+\/(?![\w.])/,
  /\bmkfs\b/,
  /\bdd\s+.*if=\/dev\/zero\b/,
  /\bdd\s+.*of=\/dev\//,
  /:\(\)\{\s*:\|:&\s*\};:/,
  /\bchmod\s+(-\w+\s+)*-R\s+777\s+\//,
  /\bchown\s+(-\w+\s+)*-R\b/,
  />\s*\/dev\/sd[a-z]/,
  /\bcurl\b.*\|\s*(sh|bash)\b/,
  /\bwget\b.*\|\s*(sh|bash)\b/,
];

export function isDangerousCommand(command: string): boolean {
  const trimmed = command.trim();
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(trimmed));
}

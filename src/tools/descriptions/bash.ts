/**
 * Rich description for the bash tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const BASH_DESCRIPTION = `
Execute shell commands via Bun.spawn with configurable timeout and working directory. Captures stdout, stderr, and exit code.

## When to Use

- Running build tools, test suites, or linters (e.g., bun test, bun run typecheck)
- Installing dependencies (e.g., bun install, pip install)
- Git operations (status, diff, log, commit)
- Running scripts or one-off system commands
- Checking system state (processes, disk usage, network)

## When NOT to Use

- Reading file contents (use read — it provides line numbers)
- Writing or editing files (use write or edit — they handle safety checks)
- Searching file contents (use grep — it's faster and respects .gitignore)
- Finding files by pattern (use glob — it's faster and respects exclusions)

## Parameters

| Parameter | Description | Required |
|-----------|-------------|----------|
| command | Shell command string to execute | yes |
| workdir | Working directory for the command (default: project root) | no |
| timeout | Timeout in milliseconds (default: 120000 / 2 minutes) | no |

## Usage Notes

- Default timeout is 120 seconds; long-running commands should set a higher timeout
- Output is truncated at 50KB or 2000 lines, whichever comes first
- Dangerous commands are blacklisted (e.g., rm -rf /, shutdown, mkfs)
- Use workdir parameter instead of \`cd dir && command\` patterns
- Commands run in a non-interactive shell — no TTY input (no vim, no interactive prompts)
- Exit code is included in the result; non-zero means the command failed
- Stderr is captured separately and included in error output
`.trim();

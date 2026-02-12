/**
 * Rich description for the grep tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const GREP_DESCRIPTION = `
Search file contents using regular expressions. Uses ripgrep when available, with grep fallback. Respects .gitignore and returns matching lines with context.

## When to Use

- Finding all usages of a function, variable, or class across the codebase
- Searching for specific strings, patterns, or error messages
- Locating import statements or configuration values
- Finding TODO/FIXME comments or other code annotations
- Identifying files that reference a specific API or module

## When NOT to Use

- Finding files by name or extension pattern (use glob)
- Reading the full contents of a known file (use read)
- Making changes to file contents (use edit)
- Running commands or scripts (use bash)

## Parameters

| Parameter | Description | Required |
|-----------|-------------|----------|
| pattern | Regular expression pattern to search for | yes |
| path | Directory or file path to search in (default: project root) | no |
| include | File glob filter (e.g., "*.ts", "*.{ts,tsx}") | no |

## Usage Notes

- Patterns use full regex syntax (e.g., \`log.*Error\`, \`function\\s+\\w+\`)
- Results are sorted by file modification time (most recent first)
- .gitignore rules are respected — ignored files are excluded
- Maximum of 100 results returned to prevent overwhelming output
- Use the include parameter to narrow search to specific file types
- Case-sensitive by default; use regex flags like \`(?i)\` for case-insensitive
- Binary files are automatically skipped
`.trim();

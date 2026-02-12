/**
 * Rich description for the glob tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const GLOB_DESCRIPTION = `
Find files by name pattern using glob matching. Uses ripgrep --files when available, with Bun.Glob fallback. Returns matching file paths sorted by modification time.

## When to Use

- Finding files by name or extension (e.g., all \`.test.ts\` files)
- Discovering project structure and file organization
- Locating specific files by partial name (e.g., \`**/router*.ts\`)
- Checking if certain files exist before reading or editing them
- Finding all files in a specific subdirectory matching a pattern

## When NOT to Use

- Searching file contents for patterns (use grep)
- Reading the contents of a known file (use read)
- Running shell commands (use bash)
- Listing a single directory's contents (use read on the directory)

## Parameters

| Parameter | Description | Required |
|-----------|-------------|----------|
| pattern | Glob pattern (e.g., "**/*.ts", "src/**/*.test.ts") | yes |
| path | Base directory to search from (default: project root) | no |

## Usage Notes

- Supports standard glob syntax: \`*\` (any chars), \`**\` (recursive), \`?\` (single char), \`{a,b}\` (alternatives)
- .git/ and node_modules/ directories are automatically excluded
- Maximum of 100 files returned to prevent overwhelming output
- Results are sorted by modification time (most recently modified first)
- Use specific patterns to narrow results (e.g., \`src/tools/**/*.ts\` not \`**/*.ts\`)
- Pattern matching is case-sensitive on Linux, case-insensitive on macOS
`.trim();

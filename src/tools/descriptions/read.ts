/**
 * Rich description for the read tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const READ_DESCRIPTION = `
Read file contents with line numbers, or list directory entries. Supports text files, binary detection, and configurable line ranges.

## When to Use

- Reading source code, configuration files, or documentation
- Listing files and subdirectories in a directory
- Inspecting specific sections of large files with offset/limit
- Checking file contents before making edits
- Understanding project structure by reading directories

## When NOT to Use

- Searching for patterns across many files (use grep)
- Finding files by name pattern (use glob)
- Executing scripts or commands (use bash)
- Modifying file contents (use edit or write)

## Parameters

| Parameter | Description | Required |
|-----------|-------------|----------|
| path | Absolute path to file or directory | yes |
| offset | Starting line number (1-indexed) for partial reads | no |
| limit | Maximum number of lines to return (default: 2000) | no |

## Usage Notes

- Output is prefixed with line numbers (e.g., \`1: content\`) for easy reference in edits
- Directories return entries one per line, with trailing \`/\` for subdirectories
- Binary files are detected and rejected with an error message
- Files inside \`.git/\` directories are excluded for safety
- Maximum file size is 10MB — larger files are rejected
- Default limit is 2000 lines; use offset/limit for large files
- Always read a file before attempting to edit it
`.trim();

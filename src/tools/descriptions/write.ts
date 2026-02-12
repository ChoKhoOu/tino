/**
 * Rich description for the write tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const WRITE_DESCRIPTION = `
Create new files or completely overwrite existing files. Automatically creates parent directories if they don't exist.

## When to Use

- Creating new source files, configs, or scripts from scratch
- Completely replacing file contents when the entire file needs rewriting
- Generating new files (e.g., strategy files, config files, templates)
- Writing files whose full content you already have

## When NOT to Use

- Making small, targeted changes to existing files (use edit instead)
- Appending content to a file (use edit with the end of file as anchor)
- Reading or inspecting file contents (use read)
- Executing shell commands (use bash)

## Parameters

| Parameter | Description | Required |
|-----------|-------------|----------|
| filePath | Absolute path to the file to create or overwrite | yes |
| content | The full content to write to the file | yes |

## Usage Notes

- Parent directories are created automatically if they don't exist
- Writing to paths inside \`.git/\` is blocked for safety
- When overwriting an existing file, a diff summary is shown
- Always prefer edit over write for existing files with small changes
- Read the file first before overwriting to understand current contents
- File content should be complete — partial writes will truncate existing content
`.trim();

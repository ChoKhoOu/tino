/**
 * Rich description for the edit tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const EDIT_DESCRIPTION = `
Make targeted search-and-replace edits to existing files. Uses a 3-level matching strategy: exact match → whitespace-normalized → indent-flexible.

## When to Use

- Modifying specific sections of existing source code
- Fixing bugs by replacing incorrect code with corrected code
- Adding new code blocks at specific locations in a file
- Refactoring: renaming variables, updating function signatures
- Replacing all occurrences of a string across a file

## When NOT to Use

- Creating entirely new files (use write)
- Rewriting most or all of a file (use write)
- Reading file contents (use read)
- Searching across files for patterns (use grep)

## Parameters

| Parameter | Description | Required |
|-----------|-------------|----------|
| filePath | Absolute path to the file to edit | yes |
| oldString | The exact text to find and replace | yes |
| newString | The replacement text (must differ from oldString) | yes |
| replaceAll | Replace all occurrences, not just the first (default: false) | no |

## Usage Notes

- Always read the file first before editing — you need the exact text to match
- The oldString must uniquely identify the target; if multiple matches exist, the edit fails with an error
- When multiple matches are found, provide more surrounding context in oldString to disambiguate
- Use replaceAll=true to rename variables or update repeated patterns across the file
- 3-level matching: tries exact match first, then whitespace-normalized, then indent-flexible
- Indentation in newString is preserved exactly as provided
- An empty oldString is invalid — use write for creating new files
`.trim();

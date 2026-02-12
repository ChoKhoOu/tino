/**
 * Rich description for the lsp tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const LSP_DESCRIPTION = `
Code intelligence operations powered by Language Server Protocol. Navigate definitions, find references, get hover info, list symbols, and check diagnostics.

## When to Use

- Jumping to the definition of a function, class, or variable
- Finding all references/usages of a symbol across the workspace
- Getting type information or documentation via hover
- Listing all symbols in a file (functions, classes, exports)
- Searching for symbols across the entire workspace by name
- Checking for errors and warnings before building

## When NOT to Use

- Searching for arbitrary text patterns (use grep)
- Reading full file contents (use read)
- Finding files by name (use glob)
- Making code changes (use edit)

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| goto_definition | Jump to where a symbol is defined | filePath, line, character |
| find_references | Find all usages of a symbol | filePath, line, character |
| hover | Get type info and docs for a symbol | filePath, line, character |
| document_symbols | List all symbols in a file | filePath |
| workspace_symbols | Search symbols across the workspace | query |
| diagnostics | Get errors/warnings for a file | filePath |

## Usage Notes

- Requires an LSP server to be running for the target language
- Line numbers are 1-indexed; character positions are 0-indexed
- goto_definition and find_references need the cursor position on the symbol
- diagnostics returns errors, warnings, and hints from the language server
- workspace_symbols supports fuzzy matching on symbol names
- Results include file paths, line numbers, and symbol metadata
- Use diagnostics before running the full build to catch issues early
`.trim();

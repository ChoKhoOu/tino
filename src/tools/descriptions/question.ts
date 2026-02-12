/**
 * Rich description for the question tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const QUESTION_DESCRIPTION = `
Ask the user a structured question and pause execution until they respond. Supports free-text input and multiple-choice selection.

## When to Use

- Clarifying ambiguous user requests before proceeding
- Confirming destructive or irreversible operations
- Gathering required information not available in the codebase
- Offering the user a choice between multiple valid approaches
- Requesting credentials, API keys, or preferences

## When NOT to Use

- When the answer is already available in the codebase or context
- For yes/no confirmations on safe, easily reversible operations
- When you can make a reasonable default choice and proceed
- For progress updates (just include them in your response)

## Parameters

| Parameter | Description | Required |
|-----------|-------------|----------|
| question | The question text to display to the user | yes |
| choices | Array of option strings for multiple choice (omit for free-text) | no |

## Usage Notes

- Execution pauses completely until the user responds — use sparingly
- Keep questions concise and specific to minimize user effort
- For multiple choice, provide 2-5 clear, distinct options
- Prefer making reasonable assumptions over asking trivial questions
- The user's response is returned as a string in the tool result
- Batch related questions together rather than asking one at a time
`.trim();

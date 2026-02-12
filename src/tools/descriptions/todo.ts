/**
 * Rich description for the todo tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const TODO_DESCRIPTION = `
Manage a session-level task list for tracking progress on multi-step work. Uses full-replace semantics — send the complete list each time, not incremental updates.

## When to Use

- Tracking progress on multi-step tasks or feature implementations
- Breaking down complex work into manageable, visible steps
- Showing the user what's been done and what remains
- Organizing work when handling multiple related sub-tasks

## When NOT to Use

- Single-step operations that don't need tracking
- Delegating work to child agents (use task)
- Asking the user a question (use question)
- Simple file operations (use read, write, edit directly)

## Parameters

| Parameter | Description | Required |
|-----------|-------------|----------|
| todos | Complete array of all todo items (full replacement) | yes |

## Todo Item Fields

| Field | Values | Required |
|-------|--------|----------|
| id | Unique string identifier | yes |
| content | Brief description of the task | yes |
| status | pending, in_progress, completed, cancelled | yes |
| priority | high, medium, low | yes |

## Usage Notes

- Full-replace semantics: every call must include ALL items, not just changes
- Only one item should be in_progress at a time
- Mark items completed immediately after finishing, not in batches
- Items are displayed to the user in real-time as a progress tracker
- Use clear, concise descriptions — these are shown in the UI
- Cancelled items should remain in the list (not removed) for audit trail
`.trim();

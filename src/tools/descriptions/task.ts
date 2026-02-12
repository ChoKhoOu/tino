/**
 * Rich description for the task tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const TASK_DESCRIPTION = `
Spawn isolated child agent sessions for parallel or delegated work. Child agents have their own context and tool access but cannot spawn sub-agents or manage todos.

## When to Use

- Delegating independent subtasks that can run in parallel
- Exploring multiple approaches simultaneously without polluting main context
- Long-running research or analysis that shouldn't block the main conversation
- Breaking complex work into isolated, focused sub-tasks

## When NOT to Use

- Simple operations that can be done directly with existing tools
- Tasks requiring shared state or coordination between agents
- When you need to manage a todo list (use todo directly)
- Interactive tasks requiring user input (use question)

## Parameters

| Parameter | Description | Required |
|-----------|-------------|----------|
| prompt | Instructions for the child agent | yes |
| agent | Agent definition to use (default: same as parent) | no |
| session_id | Resume a previous child session by its ID | no |
| background | Run asynchronously (true) or block until complete (false, default) | no |

## Usage Notes

- Child agents cannot spawn their own sub-agents (no recursive nesting)
- Child agents cannot use the TodoWrite tool — only the parent manages todos
- Background tasks return a session_id immediately; use session_id to check results later
- Blocking tasks wait for the child to finish and return its full response
- Each child session has isolated context — it does not see the parent's conversation history
- Use specific, self-contained prompts — the child has no implicit knowledge of your context
`.trim();

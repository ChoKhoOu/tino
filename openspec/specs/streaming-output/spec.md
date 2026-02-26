# Capability: Streaming Output

## Purpose

Provides real-time streaming display of LLM responses in the terminal, including incremental token rendering, markdown formatting with syntax highlighting, collapsible content sections, Static/live area management via Ink, and in-flight request cancellation.

## Requirements

### Requirement: Streaming token display
The CLI SHALL render LLM response tokens incrementally as they arrive from the Anthropic streaming API, rather than waiting for the complete response before displaying.

#### Scenario: User sends a message and sees streaming output
- **WHEN** the user submits a natural language message
- **THEN** the CLI begins displaying response text within 500ms of the first token arriving, with subsequent tokens appearing in real-time

#### Scenario: Streaming respects terminal frame rate
- **WHEN** tokens arrive faster than the render frame rate
- **THEN** the CLI batches token updates to at most 30 frames per second to prevent terminal output flooding

### Requirement: Markdown rendering in terminal
The CLI SHALL render LLM responses as formatted markdown in the terminal, including headings, bold/italic text, lists, tables, and code blocks with syntax highlighting.

#### Scenario: Code block with syntax highlighting
- **WHEN** the LLM response contains a fenced code block with a language identifier (e.g., ```python)
- **THEN** the CLI renders the code block with syntax-appropriate color highlighting using highlight.js

#### Scenario: Markdown formatting preserved
- **WHEN** the LLM response contains markdown headings, bold text, or bullet lists
- **THEN** the CLI renders them with appropriate terminal formatting (bold ANSI, indentation, bullet characters)

### Requirement: Collapsible content sections
The CLI SHALL support collapsible sections for verbose output (e.g., tool call details, full trade logs) that can be expanded inline.

#### Scenario: Collapsed by default
- **WHEN** a tool result or verbose output section is rendered
- **THEN** it displays as a single summary line with a "expand" indicator (e.g., "▸ 213 trades")

#### Scenario: User expands section
- **WHEN** the user interacts with a collapsed section
- **THEN** the full content is rendered inline below the summary line

### Requirement: Completed messages use Static rendering
The CLI SHALL render completed messages using Ink's `<Static>` component so they enter the terminal scrollback buffer and are not re-rendered on subsequent state changes.

#### Scenario: Completed message enters scrollback
- **WHEN** a streaming response completes (all tokens received)
- **THEN** the message is moved to the Static render area and becomes part of normal terminal scrollback

#### Scenario: Streaming message in live area
- **WHEN** a response is actively streaming
- **THEN** the in-progress message renders in the live area below all completed messages, with a spinner indicating active generation

### Requirement: Cancellation of in-flight requests
The CLI SHALL allow the user to cancel an in-flight LLM request using Ctrl+C without terminating the CLI process.

#### Scenario: Cancel streaming response
- **WHEN** the user presses Ctrl+C while a response is streaming
- **THEN** the streaming request is aborted, partial output is preserved as a completed message with a "[cancelled]" indicator, and the input prompt is restored

#### Scenario: Ctrl+C with no active request
- **WHEN** the user presses Ctrl+C with no active LLM request
- **THEN** the current input text is cleared (if any), not the CLI process

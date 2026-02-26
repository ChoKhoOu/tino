## ADDED Requirements

### Requirement: Multi-line input support
The CLI SHALL support multi-line text input for composing complex prompts, with Shift+Enter (or a configurable key) inserting a newline.

#### Scenario: Insert newline in input
- **WHEN** the user presses Shift+Enter while typing
- **THEN** a newline is inserted in the input area and the cursor moves to the next line

#### Scenario: Submit multi-line input
- **WHEN** the user presses Enter (without Shift) with multi-line content
- **THEN** the entire multi-line text is submitted as one message

### Requirement: Command history with persistence
The CLI SHALL maintain a command history navigable with up/down arrow keys, persisted across CLI sessions.

#### Scenario: Navigate history
- **WHEN** the user presses the up arrow key
- **THEN** the input area shows the previous command from history

#### Scenario: History persisted across sessions
- **WHEN** the user starts a new CLI session
- **THEN** command history from previous sessions is available via up/down arrow navigation

### Requirement: Input clearing with Escape
The CLI SHALL clear the current input text when the user presses Escape.

#### Scenario: Clear input
- **WHEN** the user presses Escape while text is in the input area
- **THEN** the input text is cleared and the cursor returns to the beginning

### Requirement: Paste support
The CLI SHALL accept pasted text including multi-line content, preserving line breaks.

#### Scenario: Paste multi-line text
- **WHEN** the user pastes text containing newlines into the input area
- **THEN** the text is inserted with line breaks preserved and displayed as multi-line input

### Requirement: Visual input prompt
The CLI SHALL display a clear visual prompt indicating it is ready for input, with a blinking cursor.

#### Scenario: Ready state
- **WHEN** no LLM request is in progress
- **THEN** the input area displays a `>` prompt with a blinking cursor

#### Scenario: Loading state
- **WHEN** an LLM request is in progress
- **THEN** the input area is visually disabled and shows the active spinner in the live area above

# Capability: Slash Commands

## Purpose

Provides a slash-command system for the CLI that routes `/`-prefixed input to registered command handlers, including built-in commands for help, conversation management, strategy operations, backtesting, deployment, status, kill switch, screen clearing, and an extensible registration mechanism.

## Requirements

### Requirement: Slash command routing
The CLI SHALL route user input starting with `/` to registered command handlers, and route all other input to the LLM strategy agent.

#### Scenario: Known command dispatched
- **WHEN** the user types `/backtest BTC/USDT 3m` and presses Enter
- **THEN** the CLI dispatches to the `backtest` command handler with arguments "BTC/USDT 3m"

#### Scenario: Unknown command shows error
- **WHEN** the user types `/unknown` and presses Enter
- **THEN** the CLI displays an error message listing available commands

#### Scenario: Non-slash input goes to agent
- **WHEN** the user types "design a momentum strategy" (no `/` prefix)
- **THEN** the input is forwarded to the LLM strategy agent for processing

### Requirement: Help command
The CLI SHALL provide a `/help` command that lists all available commands with descriptions.

#### Scenario: List all commands
- **WHEN** the user types `/help`
- **THEN** the CLI displays a formatted table of all registered commands with their names, arguments, and descriptions

### Requirement: New conversation command
The CLI SHALL provide a `/new` command that resets the conversation state and strategy agent.

#### Scenario: Reset conversation
- **WHEN** the user types `/new`
- **THEN** the conversation history is cleared, the current strategy is unloaded, and a welcome message is displayed

### Requirement: Save strategy command
The CLI SHALL provide a `/save` command that persists the current strategy to the engine.

#### Scenario: Save current strategy
- **WHEN** the user types `/save` with an active strategy loaded
- **THEN** the strategy is saved via the engine API and the version hash is displayed

#### Scenario: Save with no strategy
- **WHEN** the user types `/save` with no active strategy
- **THEN** the CLI displays an error: "No strategy to save"

### Requirement: Backtest command
The CLI SHALL provide a `/backtest` command that submits a backtest to the engine and displays results.

#### Scenario: Submit backtest
- **WHEN** the user types `/backtest BTC/USDT 3m` with a saved strategy
- **THEN** the CLI submits a backtest request to the engine API and begins displaying progress

#### Scenario: Backtest with no saved strategy
- **WHEN** the user types `/backtest` with no saved strategy
- **THEN** the CLI displays an error: "Save a strategy first with /save"

### Requirement: Deploy command with confirmation gate
The CLI SHALL provide a `/deploy` command that deploys a strategy to live trading, requiring explicit human confirmation.

#### Scenario: Deploy with type-to-confirm
- **WHEN** the user types `/deploy`
- **THEN** the CLI displays strategy details, account info, and capital at risk, then requires the user to type "CONFIRM LIVE" to proceed

#### Scenario: Deploy cancelled
- **WHEN** the user types anything other than "CONFIRM LIVE" at the confirmation prompt
- **THEN** the deployment is cancelled and the user is returned to the input prompt

### Requirement: Status command
The CLI SHALL provide a `/status` command that displays current engine and session status.

#### Scenario: Show engine status
- **WHEN** the user types `/status`
- **THEN** the CLI displays engine health, active backtest count, active live session count, and current strategy info

### Requirement: Kill switch command
The CLI SHALL provide a `/kill` command that triggers the engine kill switch.

#### Scenario: Kill switch execution
- **WHEN** the user types `/kill`
- **THEN** the CLI calls the engine kill switch API, reports the number of cancelled orders and flattened positions

### Requirement: Clear command
The CLI SHALL provide a `/clear` command that clears the terminal screen while preserving conversation state.

#### Scenario: Clear screen
- **WHEN** the user types `/clear`
- **THEN** the terminal screen is cleared and the status bar and input prompt are re-rendered, but conversation history is preserved in memory

### Requirement: Command extensibility
The command system SHALL support registering new commands without modifying the router or dispatcher code.

#### Scenario: New command registration
- **WHEN** a new command module exports a Command interface (name, description, execute function)
- **THEN** registering it with the command registry makes it available to users and visible in `/help`

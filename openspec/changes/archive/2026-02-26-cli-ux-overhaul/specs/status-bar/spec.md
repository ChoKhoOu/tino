## ADDED Requirements

### Requirement: Persistent bottom status bar
The CLI SHALL render a persistent status bar at the bottom of the terminal that remains visible at all times.

#### Scenario: Status bar always visible
- **WHEN** the CLI is running
- **THEN** a status bar is rendered at the bottom of the terminal, below the input area, visible regardless of conversation length or active operations

### Requirement: Model and token information display
The status bar SHALL display the current LLM model name and token usage for the session.

#### Scenario: Token usage display
- **WHEN** LLM requests are made during the session
- **THEN** the status bar shows cumulative token usage (e.g., "Token: 1.2K/4K") updated after each request

#### Scenario: Model name display
- **WHEN** the CLI is running
- **THEN** the status bar shows the active model name (e.g., "claude-sonnet-4-20250514")

### Requirement: Engine health indicator
The status bar SHALL display the engine connection status with color-coded indicators.

#### Scenario: Engine healthy
- **WHEN** the engine health check passes
- **THEN** the status bar displays a green indicator "Engine: healthy"

#### Scenario: Engine reconnecting
- **WHEN** the engine connection is lost and the watchdog is attempting to restart
- **THEN** the status bar displays a yellow indicator "Engine: reconnecting"

#### Scenario: Engine offline
- **WHEN** the engine is unreachable
- **THEN** the status bar displays a red indicator "Engine: offline"

### Requirement: LLM connection status
The status bar SHALL display the LLM API connection status.

#### Scenario: LLM connected
- **WHEN** the LLM API key is valid and the API is reachable
- **THEN** the status bar displays a green indicator "AI: connected"

#### Scenario: LLM offline
- **WHEN** no API key is configured or the API is unreachable
- **THEN** the status bar displays a red indicator "AI: offline"

### Requirement: Keybinding hints
The status bar SHALL display context-relevant keybinding hints.

#### Scenario: Default keybinding hints
- **WHEN** no special operation is in progress
- **THEN** the status bar shows: "/help commands | Ctrl+C cancel | Ctrl+K kill switch"

#### Scenario: Active backtest keybinding hints
- **WHEN** a backtest is in progress
- **THEN** the status bar shows: "Ctrl+C cancel backtest | Ctrl+K kill switch"

### Requirement: Active session info
The status bar SHALL display information about active trading sessions when present.

#### Scenario: Active live session
- **WHEN** a live trading session is active
- **THEN** the status bar shows the session state (RUNNING/PAUSED), trading pair, and current PnL

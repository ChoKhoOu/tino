## ADDED Requirements

### Requirement: Paper/Live mode visual differentiation
The CLI SHALL display a persistent mode banner that clearly distinguishes paper trading from live trading.

#### Scenario: Paper trading mode
- **WHEN** the CLI is in paper trading mode (or no live session is active)
- **THEN** a green single-border banner displays "PAPER TRADING" with "(simulated)" suffix on any balance values

#### Scenario: Live trading mode
- **WHEN** a live trading session is active
- **THEN** a red double-border banner displays "LIVE TRADING" with "(REAL MONEY)" suffix and the exchange account identifier

### Requirement: Real-time trade execution notifications
The CLI SHALL display inline notifications when trades are executed during a live session, sourced from WebSocket `live.trade_executed` events.

#### Scenario: Trade executed notification
- **WHEN** a `live.trade_executed` event is received
- **THEN** the CLI displays a timestamped notification: `[HH:MM:SS] BUY/SELL <quantity> <instrument> @ <price>` with PnL if available, color-coded (green for profitable, red for loss)

### Requirement: Position update display
The CLI SHALL display position updates from WebSocket `live.position_update` events.

#### Scenario: Position update
- **WHEN** a `live.position_update` event is received
- **THEN** the CLI updates the displayed positions showing instrument, side (LONG/SHORT), quantity, average entry price, and unrealized PnL

### Requirement: Risk alert rendering with priority levels
The CLI SHALL render risk alerts with visual priority levels that interrupt the normal conversation flow.

#### Scenario: Warning-level risk alert
- **WHEN** a `live.risk_alert` event with `alert_level: "WARNING"` is received
- **THEN** the CLI displays a yellow-bordered alert box with the rule name, message, and action taken

#### Scenario: Critical-level risk alert
- **WHEN** a `live.risk_alert` event with `alert_level: "CRITICAL"` is received
- **THEN** the CLI displays a red double-bordered alert box with the rule name, message, and action taken, rendered above the input area

### Requirement: Circuit breaker notification
The CLI SHALL render circuit breaker events with maximum visual priority.

#### Scenario: Circuit breaker triggered
- **WHEN** a `live.risk_circuit_breaker` event is received
- **THEN** the CLI displays a full-width red double-bordered banner showing: rule triggered, threshold vs actual value, number of cancelled orders, number of flattened positions, and "KILL_SWITCH_TRIGGERED" action

### Requirement: Live session state change display
The CLI SHALL display state transitions for live trading sessions.

#### Scenario: State change notification
- **WHEN** a `live.state_change` event is received
- **THEN** the CLI displays a notification: "Session <id>: <previous_state> → <current_state>" with state-appropriate colors (RUNNING=green, PAUSED=yellow, STOPPED=red)

### Requirement: Global kill switch shortcut
The CLI SHALL provide a Ctrl+K keyboard shortcut that triggers the kill switch from any state, without requiring a slash command.

#### Scenario: Ctrl+K triggers kill switch
- **WHEN** the user presses Ctrl+K at any time (during input, during streaming, during backtest)
- **THEN** the CLI immediately calls the engine kill switch API, displays results (cancelled orders, flattened positions), and remains running

#### Scenario: Kill switch with no active sessions
- **WHEN** the user presses Ctrl+K with no active live sessions
- **THEN** the CLI displays "No active live sessions"

### Requirement: Live deployment type-to-confirm
The CLI SHALL require explicit type-to-confirm input before deploying a strategy to live trading.

#### Scenario: Type-to-confirm for live deployment
- **WHEN** the `/deploy` command is invoked
- **THEN** the CLI displays strategy details, account info, capital at risk, and requires the user to type exactly "CONFIRM LIVE" before proceeding

#### Scenario: Cooldown before confirmation
- **WHEN** the confirmation dialog is displayed
- **THEN** the input field is disabled for 3 seconds with a visible countdown timer before the user can type

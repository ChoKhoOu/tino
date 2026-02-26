# Capability: Backtest Visualization

## Purpose

Provides rich terminal visualization of backtest execution and results, including real-time progress tracking, ASCII equity curves, formatted metrics tables, failure display, and cancellation support.

## Requirements

### Requirement: Real-time backtest progress bar
The CLI SHALL display a real-time progress bar during backtest execution, updated via WebSocket `backtest.progress` events.

#### Scenario: Progress updates during backtest
- **WHEN** the engine emits `backtest.progress` events
- **THEN** the CLI renders a progress bar showing percentage complete, trade count, current date, and running PnL (e.g., `████████████░░░░ 72% | 213 trades | +$840 | 2025-06-15`)

#### Scenario: Backtest starts
- **WHEN** a backtest is submitted and the WebSocket connection is established
- **THEN** the CLI displays "Running backtest..." with a spinner until the first progress event arrives

### Requirement: ASCII equity curve rendering
The CLI SHALL render an ASCII line chart of the equity curve after backtest completion using the `equity_curve` data from the backtest result.

#### Scenario: Equity curve after completion
- **WHEN** a `backtest.completed` event is received with `equity_curve` data
- **THEN** the CLI renders an ASCII chart showing the equity over time, auto-scaled to terminal width, with labeled Y-axis (dollar values) and start/end dates

#### Scenario: No equity curve data
- **WHEN** a backtest completes without equity_curve data
- **THEN** the CLI skips the chart and only shows the metrics table

### Requirement: Rich backtest metrics table
The CLI SHALL render backtest results as a formatted terminal table with key performance metrics.

#### Scenario: Metrics table after completion
- **WHEN** a `backtest.completed` event is received with metrics
- **THEN** the CLI renders a table showing: total PnL, Sharpe ratio, Sortino ratio, win rate, max drawdown, total trades, profit factor, and average trade PnL

#### Scenario: Color-coded metrics
- **WHEN** metrics are displayed
- **THEN** positive values (PnL, Sharpe > 1, win rate > 50%) are rendered in green and negative values in red

### Requirement: Backtest failure display
The CLI SHALL clearly display backtest failures with the error message from the engine.

#### Scenario: Backtest fails
- **WHEN** a `backtest.failed` event is received
- **THEN** the CLI displays the error message in red with context (backtest ID, strategy name)

### Requirement: Backtest cancellation
The CLI SHALL allow cancelling a running backtest via Ctrl+C or `/kill`.

#### Scenario: Cancel running backtest
- **WHEN** the user presses Ctrl+C during an active backtest
- **THEN** the CLI sends a `backtest.cancel` event via WebSocket and displays "Backtest cancelled"

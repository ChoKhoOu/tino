## ADDED Requirements

### Requirement: CLI registers itself on startup
The CLI process SHALL create a lock file at `~/Library/Application Support/tino/run/cli/cli-<PID>.lock` upon startup, before any other daemon operations. The lock file SHALL contain JSON with `pid`, `startedAt` (ISO 8601), and `tty` fields.

#### Scenario: First CLI starts with no existing lock files
- **WHEN** a user runs `tino` and no lock files exist in the cli/ directory
- **THEN** the system creates `cli-<PID>.lock` with the current process PID and timestamp

#### Scenario: Additional CLI starts while others are running
- **WHEN** a user runs `tino` in a second terminal while another CLI is already running
- **THEN** the system creates a new `cli-<PID>.lock` alongside the existing one, and both files coexist

### Requirement: CLI unregisters itself on exit
The CLI process SHALL remove its own lock file on exit, regardless of exit reason (normal quit, Ctrl+C, SIGTERM, uncaught exception).

#### Scenario: Normal exit via quit command
- **WHEN** the user types `quit` or `exit` in the CLI
- **THEN** the system removes `cli-<PID>.lock` before the process terminates

#### Scenario: Exit via SIGINT (Ctrl+C)
- **WHEN** the user presses Ctrl+C
- **THEN** the system removes `cli-<PID>.lock` before the process terminates

#### Scenario: Exit via uncaught exception
- **WHEN** the CLI encounters an uncaught exception
- **THEN** the system removes `cli-<PID>.lock` before the process terminates

### Requirement: Stale lock cleanup
The system SHALL detect and remove stale lock files from crashed CLI processes. A lock file is stale when `process.kill(pid, 0)` throws `ESRCH` (no such process).

#### Scenario: CLI crashed previously leaving stale lock
- **WHEN** a new CLI starts and finds `cli-9999.lock` but PID 9999 is not running
- **THEN** the system removes `cli-9999.lock` and does not count it as an active CLI

### Requirement: Engine auto-start on first CLI
The CLI SHALL start the engine automatically if no healthy engine is detected. The engine SHALL be spawned as a detached child process with `stdio` redirected to `~/Library/Application Support/tino/run/engine.log`.

#### Scenario: First CLI starts with no engine running
- **WHEN** a user runs `tino` and no engine is running (no PID file or PID is stale)
- **THEN** the system spawns the engine as a detached process, writes `engine.pid`, and waits up to 15 seconds for `GET /api/health` to return `{"status": "healthy"}`

#### Scenario: First CLI starts and engine fails to become healthy
- **WHEN** the engine is spawned but `/api/health` does not return healthy within 15 seconds
- **THEN** the system displays an error message including the path to `engine.log` and exits with code 1

### Requirement: Engine reuse for subsequent CLIs
The CLI SHALL connect to an already-running engine rather than spawning a new one.

#### Scenario: Second CLI starts while engine is running
- **WHEN** a user runs `tino` in a second terminal and the engine is already running and healthy
- **THEN** the system connects to the existing engine without spawning a new process

#### Scenario: Engine PID file exists but health check fails
- **WHEN** a new CLI finds `engine.pid` with a valid PID but `GET /api/health` fails
- **THEN** the system kills the stale engine process, cleans up `engine.pid`, spawns a fresh engine, and waits for health

### Requirement: Engine shutdown on last CLI exit
The system SHALL shut down the engine only when the last active CLI exits. Shutdown uses a three-stage escalation: `POST /api/shutdown` (5s timeout) → `SIGTERM` (3s timeout) → `SIGKILL`.

#### Scenario: Last CLI exits normally
- **WHEN** the last remaining CLI exits and `countActiveClis()` returns 0
- **THEN** the system sends `POST /api/shutdown` to the engine, waits up to 5 seconds for process exit, then removes `engine.pid`

#### Scenario: One of multiple CLIs exits
- **WHEN** a CLI exits but other CLIs are still running (lock files exist with alive PIDs)
- **THEN** the system does NOT shut down the engine; it only removes its own lock file

#### Scenario: HTTP shutdown fails, SIGTERM fallback
- **WHEN** the last CLI sends `POST /api/shutdown` but the engine does not exit within 5 seconds
- **THEN** the system sends `SIGTERM` to the engine PID and waits 3 seconds

#### Scenario: SIGTERM fails, SIGKILL fallback
- **WHEN** the engine does not exit within 3 seconds after SIGTERM
- **THEN** the system sends `SIGKILL` to the engine PID and removes `engine.pid`

### Requirement: Race-free shutdown coordination
The shutdown decision (remove lock → count → maybe shutdown) SHALL be serialized using an advisory file lock on `.shutdown-lock` to prevent race conditions when multiple CLIs exit simultaneously.

#### Scenario: Two CLIs exit at the same instant
- **WHEN** two CLIs exit simultaneously and both attempt the shutdown-decision sequence
- **THEN** only one acquires the advisory lock; the other blocks until the first completes; exactly zero or one shutdown is performed based on the final count

### Requirement: Engine watchdog during CLI operation
The CLI SHALL periodically check engine health during operation (every 10 seconds). If the engine is detected as crashed, the CLI SHALL attempt to restart it automatically.

#### Scenario: Engine crashes while CLI is running
- **WHEN** the engine process dies unexpectedly during a CLI session
- **THEN** the watchdog detects the failure within 10 seconds, respawns the engine, and waits for health; the CLI displays a brief "Engine reconnecting..." status

#### Scenario: Engine restart fails
- **WHEN** the watchdog attempts to restart the engine but it fails to become healthy within 15 seconds
- **THEN** the CLI displays an error message with the log file path; the CLI remains running but engine-dependent features are unavailable

### Requirement: Engine PID file format
The `engine.pid` file SHALL contain JSON with `pid` (number), `port` (number), `startedAt` (ISO 8601 string), `pythonPath` (string), and `token` (string) fields. The `token` is a crypto-random hex string used for Bearer authentication on mutation endpoints.

#### Scenario: Reading engine PID file
- **WHEN** a CLI reads `engine.pid`
- **THEN** it can parse the JSON to obtain the engine's PID, port, start time, and Python interpreter path

### Requirement: Monorepo root discovery
The CLI SHALL discover the monorepo root by walking up from its location, looking for `package.json` with `"name": "tino"`. Environment variables `TINO_ENGINE_DIR` and `TINO_DASHBOARD_DIST` SHALL override auto-discovery.

#### Scenario: CLI discovers monorepo root
- **WHEN** the CLI starts from `packages/cli/dist/index.js`
- **THEN** it walks up directories until finding `package.json` with `name: "tino"`, then resolves `engine/` and `packages/dashboard/dist/` relative to that root

#### Scenario: Environment variable override
- **WHEN** `TINO_ENGINE_DIR` is set to a custom path
- **THEN** the CLI uses that path instead of auto-discovered engine directory

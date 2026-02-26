## Why

Starting the tino platform currently requires three separate terminal sessions, two language runtimes, and manual venv activation — this is unacceptable for non-technical users. A single `tino` command should boot the entire platform (engine, dashboard, CLI) with zero manual setup, while supporting multiple concurrent CLI sessions sharing one engine instance.

## What Changes

- **New CLI bootstrap layer**: The `tino` command becomes the sole entry point. It discovers the bundled engine, spawns it as a detached daemon, waits for health confirmation, then launches the Ink TUI.
- **Daemon lifecycle management**: A lock-directory reference counting system tracks active CLI instances. The engine stays alive across CLI sessions; only the last CLI exit triggers engine shutdown.
- **Engine packaging**: Bundle a standalone Python runtime (python-build-standalone) with all dependencies pre-installed (NautilusTrader, FastAPI, uvicorn). Users never interact with Python directly.
- **Dashboard static serving**: The built Dashboard (Vite output) is served directly by the FastAPI engine at `/`, eliminating the need for a separate web server process.
- **Engine shutdown endpoint**: New `POST /api/shutdown` endpoint for graceful engine termination, called by the last CLI on exit.
- **Engine watchdog**: Periodic health checks during CLI operation with auto-restart on engine crash.

## Capabilities

### New Capabilities

- `daemon-lifecycle`: Process lifecycle management — lock-directory reference counting, detached engine spawning, health checking, graceful shutdown coordination, crash recovery watchdog
- `engine-packaging`: Bundling python-build-standalone with pre-installed dependencies into a self-contained engine distribution that requires no user-side Python installation
- `dashboard-static-serving`: FastAPI serving the built Dashboard as static files at the root path, consolidating engine + dashboard into a single process

### Modified Capabilities

_(No existing specs to modify — this is a greenfield project with no prior specs)_

## Impact

**Boundary**: Node.js UI + Python Engine + Cross-language API (all three)

**Affected code**:
- `packages/cli/src/index.tsx` — Complete rewrite of bootstrap sequence
- `packages/cli/src/daemon/` — New module (manager, lock-manager, engine-spawner, health-checker, watchdog, paths)
- `engine/src/main.py` — Add `/api/shutdown` endpoint + `StaticFiles` mount for dashboard
- `packages/dashboard/` — Build output consumed by engine (no code change, build pipeline change)

**New dependencies**:
- `proper-lockfile` (npm) — Cross-platform advisory file locks for race-free shutdown coordination
- `python-build-standalone` (build-time) — Standalone CPython distribution for macOS ARM64/x64

**Filesystem**:
- Runtime state at `~/Library/Application Support/tino/run/` (engine.pid, engine.log, cli/*.lock)
- Packaged engine at `engine/.packaged/` (bundled Python + site-packages + engine source)

**APIs**:
- New: `POST /api/shutdown` — Triggers graceful engine termination
- Modified: Engine root `/` now serves Dashboard static files when `TINO_DASHBOARD_DIST` env var is set

## Risk Assessment

**Live trading safety**: This change does NOT modify any trading logic, risk controls, or human confirmation gates. The kill-switch remains accessible. Engine shutdown via `/api/shutdown` only executes when all CLI sessions have exited (no active user). The lifespan handler in `main.py` ensures `close_db()` runs on shutdown, preserving data integrity.

**Rollback plan**: If the daemon manager introduces instability, users can fall back to manual startup (direct `uvicorn` + `npx tino`) — the engine and CLI themselves remain unchanged in functionality. The daemon layer is purely additive.

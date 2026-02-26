## 1. Project Setup & Dependencies

- [x] 1.1 Add `proper-lockfile` dependency to `packages/cli/package.json` (TypeScript)
- [x] 1.2 Add `engine/.packaged/` to `.gitignore` (Config)
- [x] 1.3 Add `~/Library/Application Support/tino/` runtime paths documentation to README or CLAUDE.md (Config)

## 2. Daemon Core Module (TypeScript — packages/cli/src/daemon/)

- [x] 2.1 Create `paths.ts` — define all path constants (`TINO_RUN_DIR`, `CLI_LOCK_DIR`, `ENGINE_PID_FILE`, `ENGINE_LOG_FILE`, `SHUTDOWN_LOCK_FILE`), using `~/Library/Application Support/tino/run/`
- [x] 2.2 Create `lock-manager.ts` — implement `registerCli()`, `unregisterCli()`, `countActiveClis()`, `isProcessAlive()` with stale lock cleanup via `kill(pid, 0)`
- [x] 2.3 Create `health-checker.ts` — implement `isEngineRunning()` (PID check + HTTP `/api/health` with 2s timeout) and `waitForEngine(maxWaitMs=15000)` with 500ms polling
- [x] 2.4 Create `engine-spawner.ts` — implement `spawnEngine()` (detached spawn with PID file write, stdio → log file) and `shutdownEngine()` (HTTP → SIGTERM → SIGKILL escalation)
- [x] 2.5 Create `engine-watchdog.ts` — implement `startEngineWatchdog(onCrash, intervalMs=10000)` that periodically checks engine health and auto-restarts on crash
- [x] 2.6 Create `manager.ts` — `DaemonManager` class that orchestrates lock-manager, health-checker, engine-spawner; implements `ensureEngine()`, `shutdownIfLastCli()` with advisory file lock via `proper-lockfile`
- [x] 2.7 Create `root-finder.ts` — implement monorepo root discovery (walk up for `package.json` with `name: "tino2"`) with `TINO_ENGINE_DIR` / `TINO_DASHBOARD_DIST` env var overrides

## 3. CLI Entry Point Rewrite (TypeScript — packages/cli/src/index.tsx)

- [x] 3.1 Rewrite `index.tsx` bootstrap: register CLI lock → ensure engine → register cleanup handlers (exit, SIGINT, SIGTERM, uncaughtException) → render Ink App → cleanup on exit
- [x] 3.2 Pass resolved `engineUrl` (from daemon manager's engine port) to `<App>` component instead of reading `ENGINE_URL` env var directly
- [x] 3.3 Integrate engine watchdog as a React `useEffect` hook in `app.tsx` that updates engine status in the header bar

## 4. Engine Modifications (Python — engine/src/main.py)

- [x] 4.1 Add `POST /api/shutdown` endpoint that responds `{"status": "shutting_down"}` then sends `SIGTERM` to `os.getpid()`
- [x] 4.2 Add `TINO_DASHBOARD_DIST` env var support: read the env var and mount `StaticFiles(directory=..., html=True)` at `/` AFTER all API/WebSocket routes, with existence check and warning log on missing directory
- [x] 4.3 Verify existing `/api/health` response includes fields needed for health-check validation (`status`, `engine_version`)

## 5. Engine Packaging Build Script

- [x] 5.1 Create `scripts/package-engine.sh` — download python-build-standalone for current architecture (`aarch64` or `x86_64` darwin), extract to `engine/.packaged/python/`
- [x] 5.2 Add venv creation step: `engine/.packaged/python/bin/python3 -m venv engine/.packaged/venv`
- [x] 5.3 Add dependency installation step: `engine/.packaged/venv/bin/pip install -e ./engine` (installs from pyproject.toml including nautilus_trader[binance])
- [x] 5.4 Add idempotency check: skip download if `engine/.packaged/python/bin/python3` exists with correct version
- [x] 5.5 Add architecture detection (`uname -m`) to select correct python-build-standalone variant

## 6. Build Pipeline Integration

- [x] 6.1 Add `package` script to root `package.json` that runs: `scripts/package-engine.sh` → `turbo run build` (builds shared → cli → dashboard)
- [x] 6.2 Verify `vite build` produces `packages/dashboard/dist/` with `index.html` suitable for SPA serving

## 7. Testing

- [x] 7.1 Write unit tests for `lock-manager.ts` — register, unregister, stale cleanup, count (TypeScript — packages/cli)
- [x] 7.2 Write unit tests for `health-checker.ts` — mock HTTP responses for healthy/unhealthy/timeout scenarios (TypeScript — packages/cli)
- [x] 7.3 Write unit tests for `root-finder.ts` — monorepo discovery from various `__dirname` positions, env var overrides (TypeScript — packages/cli)
- [x] 7.4 Write integration test: `POST /api/shutdown` triggers engine exit with lifespan cleanup (Python — engine)
- [x] 7.5 Write integration test: engine serves dashboard static files when `TINO_DASHBOARD_DIST` is set, returns `index.html` for SPA routes, API routes take priority (Python — engine)
- [x] 7.6 Write integration test: full lifecycle — spawn engine → health check OK → shutdown → process exits (TypeScript — packages/cli)

## 8. End-to-End Verification

- [x] 8.1 Run `scripts/package-engine.sh` on macOS ARM64 and verify engine starts with bundled Python
- [x] 8.2 Run `npm run build` then `tino` — verify engine auto-starts, CLI renders, dashboard accessible at `http://localhost:8000/`
- [x] 8.3 Open second terminal, run `tino` — verify it connects to existing engine (no second engine spawned)
- [x] 8.4 Exit first CLI — verify engine stays running
- [x] 8.5 Exit second (last) CLI — verify engine shuts down and `engine.pid` is cleaned up

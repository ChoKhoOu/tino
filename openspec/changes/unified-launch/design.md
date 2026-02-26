## Context

The tino platform is a monorepo with three components: a Python/FastAPI trading engine, a React/Vite web dashboard, and a Node.js/Ink CLI. Currently each component must be started manually in separate terminals with separate runtime environments. The CLI entry point (`packages/cli/src/index.tsx`) assumes the engine is already running at `ENGINE_URL` and has no process management logic. The engine uses NautilusTrader (Rust/Cython native extensions), making Python packaging non-trivial.

Key constraint: the CLI is the primary interface for non-technical users on macOS. They should never see Python, pip, venv, or multiple terminal windows.

## Goals / Non-Goals

**Goals:**

- Single `tino` command boots engine + dashboard + CLI with zero prerequisites beyond the installed binary
- Multiple concurrent CLI instances share one engine process
- Engine persists across CLI lifecycle; only the last CLI exit triggers shutdown
- Engine crash during operation is detected and auto-recovered
- Packaged engine includes a self-contained Python runtime with all native dependencies
- Dashboard served as static files by the engine (single process, single port)

**Non-Goals:**

- Distribution mechanism (Homebrew, npm global, .pkg installer) — deferred to a separate change
- Windows or Linux support — macOS-first, others later
- Auto-update mechanism
- Engine clustering or multi-instance support
- Dev mode changes (`npm run dev` workflow stays as-is)

## Decisions

### D1: Lock-directory reference counting for CLI instance tracking

**Choice**: One lock file per CLI process in `~/Library/Application Support/tino/run/cli/cli-<PID>.lock`

**Alternatives considered**:
- *PID file with atomic counter*: Single file contention; counter corrupts if CLI crashes mid-write; no crash recovery without process scanning
- *Unix domain socket*: Requires a persistent listener process; over-engineered for presence tracking
- *launchd plist*: macOS-native but requires plist installation, privilege management; too complex for the UX target

**Rationale**: Lock directory is the simplest approach with built-in crash recovery. Each file is independently atomic. Stale locks from crashed CLIs are detected via `process.kill(pid, 0)` on next startup. The directory is human-debuggable (`ls` shows active sessions).

**Race condition on simultaneous last-exit**: Two CLIs exiting at the same instant could both see count=1. Mitigated by an advisory file lock (via `proper-lockfile` npm package) on a `.shutdown-lock` sentinel during the shutdown-decision critical section. This serializes the "remove lock → count → maybe shutdown" sequence without native dependencies.

### D2: Detached child process for engine spawning

**Choice**: `child_process.spawn()` with `detached: true`, `stdio` redirected to log file, `child.unref()`

**Alternatives considered**:
- *Non-detached child*: Killed when parent CLI exits — breaks the multi-CLI sharing requirement
- *launchd managed service*: Auto-restart is nice but requires plist generation and `launchctl` commands; debugging is opaque; overkill for this stage
- *nohup*: Fragile; inherits environment unpredictably; no structured PID management

**Rationale**: Detached spawn is the minimum viable approach. The engine survives CLI exit, PID is tracked in `engine.pid`, and logs go to `engine.log`. No daemon framework needed. Auto-restart is handled by the watchdog in the CLI rather than the OS.

### D3: Dual-layer health checking (PID + HTTP)

**Choice**: Check PID file existence → validate PID is alive via `kill(pid, 0)` → HTTP `GET /api/health` with 2s timeout

**Rationale**: PID check is ~0ms and catches the 90% case (engine crashed, stale PID). HTTP check catches the remaining edge cases (zombie process, port conflict, engine in bad state). The engine already exposes `GET /api/health` returning `{"status": "healthy", ...}`, so no new endpoint is needed for health checking. A new CLI connecting to an existing engine verifies the health response shape matches tino's format to avoid connecting to a foreign service on port 8000.

### D4: Graceful shutdown via HTTP + SIGTERM fallback

**Choice**: `POST /api/shutdown` → wait 5s → `SIGTERM` → wait 3s → `SIGKILL`

**Rationale**: HTTP shutdown lets the engine acknowledge the request before terminating. The FastAPI lifespan handler runs `close_db()` on SIGTERM, ensuring data integrity regardless of which shutdown path executes. The escalation chain (HTTP → SIGTERM → SIGKILL) covers all failure modes.

The `/api/shutdown` endpoint schedules termination via `os.kill(os.getpid(), signal.SIGTERM)` after sending the response, ensuring the HTTP response reaches the caller before the process exits. This endpoint is authenticated via a crypto-random Bearer token. The CLI generates a 64-character hex token at engine spawn time, passes it via TINO_ENGINE_TOKEN environment variable, and includes it as an Authorization header in shutdown requests. The engine validates the token and returns 403 for invalid requests. This prevents any local process from shutting down the engine without the correct token.

### D5: FastAPI serves dashboard static files

**Choice**: Mount `StaticFiles(directory=dashboard_dist, html=True)` at `/` in `main.py`, controlled by `TINO_DASHBOARD_DIST` environment variable

**Alternatives considered**:
- *Separate Vite dev server process*: Adds another process to manage, another port to configure, CORS concerns; overkill for production
- *Nginx/Caddy reverse proxy*: Enterprise-grade but absurd for a local trading tool
- *Embed in CLI binary*: Would require the CLI to run its own HTTP server; violates boundary decoupling

**Rationale**: The dashboard's `vite.config.ts` already proxies `/api` and `/ws` to the engine in dev mode, confirming the dashboard is designed for same-origin serving. Mounting static files after all API routes means `/api/*` takes priority, and `/*` falls back to the SPA. The `TINO_DASHBOARD_DIST` env var is injected by the CLI at spawn time, so the engine itself remains decoupled from monorepo structure. When the env var is absent (e.g., direct `uvicorn` for development), the mount is skipped.

### D6: python-build-standalone for engine packaging

**Choice**: Bundle Astral's python-build-standalone (`aarch64-apple-darwin`) with pre-installed wheels in `engine/.packaged/`

**Alternatives considered**:
- *PyInstaller*: Cannot discover Rust/Cython `.so` internal dependencies; no documented success with NautilusTrader; extremely tedious hidden-import trial-and-error
- *Nuitka*: Same limitation as PyInstaller for pre-compiled extension modules; no NautilusTrader support in its package configuration database
- *PyApp*: Viable but requires internet on first run (~60s) to download dependencies; unacceptable for "instant start" UX
- *uv-managed runtime*: Requires internet; not a packaging solution

**Rationale**: python-build-standalone provides a fully self-contained, relocatable CPython distribution. NautilusTrader publishes precompiled macOS ARM64 wheels on PyPI, so `pip install` into the bundled venv works without compilation. The proven precedent is Datasette Desktop (Simon Willison) which ships Python inside an Electron app using this exact approach. Total bundle size ~300-500MB — acceptable for a professional trading platform.

**Build-time packaging flow**:
1. Download `cpython-3.12.x-aarch64-apple-darwin-install_only_stripped.tar.gz`
2. Extract to `engine/.packaged/python/`
3. Create venv: `engine/.packaged/python/bin/python3 -m venv engine/.packaged/venv`
4. Install dependencies: `engine/.packaged/venv/bin/pip install -e ./engine[dev]`
5. The CLI spawns: `engine/.packaged/venv/bin/python -m uvicorn src.main:app ...`

### D7: Runtime directory layout follows macOS conventions

**Choice**: `~/Library/Application Support/tino/run/` for all runtime state

```
~/Library/Application Support/tino/
  run/
    engine.pid          # JSON: {pid, port, startedAt, pythonPath}
    engine.log          # Engine stdout/stderr (append mode)
    .shutdown-lock      # Advisory lock sentinel for shutdown coordination
    cli/
      cli-<PID>.lock    # JSON: {pid, startedAt, tty}
```

**Rationale**: `~/Library/Application Support/` is the macOS-standard location for application state (not `~/.config/` which is XDG/Linux convention). Non-technical macOS users will never look here, which is correct. All paths are computed from `os.homedir()` — no hardcoded user paths.

### D8: Monorepo root discovery

**Choice**: Walk up from `__dirname` (or `process.cwd()`) looking for `package.json` with `"name": "tino2"`, then derive `engineDir` and `dashboardDist` as relative paths from root.

**Override**: Environment variables `TINO_ENGINE_DIR` and `TINO_DASHBOARD_DIST` take precedence, enabling non-standard layouts and CI testing.

**Rationale**: The monorepo structure is fixed (`engine/` at root, `packages/dashboard/dist/` at root). Root discovery is more robust than hardcoded relative paths from `__dirname` because `npm link`, `npx`, and direct `node dist/index.js` all produce different `__dirname` values. The fallback to env vars covers edge cases.

## Risks / Trade-offs

**[Port 8000 conflict]** → The health check validates the response body shape (`status === "healthy"` with `engine_version` field) to distinguish tino from a foreign service. If port 8000 is occupied by a non-tino service, the CLI reports a clear error with the log file path. Configurable port is a future enhancement.

**[Engine startup latency]** → NautilusTrader is a heavy library; Python import alone may take 2-5 seconds. The CLI displays a spinner/loading animation during `waitForEngine()` (up to 15s timeout). This is acceptable for a one-time cost per session.

**[Bundle size ~300-500MB]** → Comparable to Electron apps. Acceptable for a professional trading platform. The stripped python-build-standalone variant reduces Python itself to ~60MB; the bulk is NautilusTrader's compiled extensions.

**[Stale PID after OS crash]** → If the machine reboots or kernel panics, `engine.pid` persists but the process is gone. Handled: `kill(pid, 0)` returns `ESRCH`, PID file is cleaned up, engine is restarted fresh.

**[Log rotation]** → `engine.log` grows unbounded in this design. Acceptable for initial release; future enhancement to add size-based rotation or `os.log` integration.

**[No Windows support]** → `process.kill(pid, 0)`, detached spawn behavior, and `~/Library/` paths are macOS/Unix-specific. Windows support requires a separate design pass with named pipes or Windows services. Explicitly a non-goal for this change.

## Open Questions

- **Engine port configurability**: Should `tino` accept a `--port` flag, or is 8000 sufficient for now? (Leaning: hardcode 8000, add flag later)
- **First-run experience**: Should `tino` on first launch run a setup wizard for API keys (`ANTHROPIC_API_KEY`, `BINANCE_API_KEY`)? Or should that be a separate `tino setup` command? (Leaning: separate command, out of scope for this change)
- **Bun compatibility**: The CLI uses Ink 5 (React for terminal). If we later switch to Bun compile for single-binary distribution, Ink compatibility needs verification. (Deferred to distribution change)

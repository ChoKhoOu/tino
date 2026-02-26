# tino Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-26

## Active Technologies

- TypeScript 5.x (Node.js 20+) for CLI and Dashboard; (001-quant-trading-cli)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (Node.js 20+) for CLI and Dashboard;: Follow standard conventions

## Recent Changes

- 001-quant-trading-cli: Added TypeScript 5.x (Node.js 20+) for CLI and Dashboard;

<!-- MANUAL ADDITIONS START -->

## Runtime Paths

- **Runtime state**: `~/Library/Application Support/tino/run/`
  - `engine.pid` — Engine process info (pid, port, token)
  - `engine.log` — Engine stdout/stderr
  - `cli/cli-<PID>.lock` — One lock file per active CLI instance
  - `.shutdown-lock` — Advisory lock for shutdown coordination
- **Packaged engine**: `engine/.packaged/` (python-build-standalone + venv, gitignored)
- **Dashboard static**: `packages/dashboard/dist/` (served by engine via `TINO_DASHBOARD_DIST`)

## Unified Launch

- `npm run package` — Package engine (download Python + install deps) + build all
- `npm run build` — Build TypeScript packages + dashboard
- `tino` — Single command to start engine + dashboard + CLI

<!-- MANUAL ADDITIONS END -->

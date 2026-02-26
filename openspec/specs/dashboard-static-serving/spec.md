# Capability: Dashboard Static Serving

## Purpose

Enables the FastAPI engine to serve the built Dashboard (Vite SPA) as static files, allowing users to access both the API and the Dashboard from the same port.

## Requirements

### Requirement: Engine serves dashboard static files
The FastAPI engine SHALL serve the built Dashboard (Vite output) as static files at the root path `/` when the `TINO_DASHBOARD_DIST` environment variable is set and points to an existing directory.

#### Scenario: TINO_DASHBOARD_DIST is set to valid directory
- **WHEN** the engine starts with `TINO_DASHBOARD_DIST=/path/to/packages/dashboard/dist`
- **THEN** the engine mounts `StaticFiles(directory=..., html=True)` at `/` and serves the Dashboard SPA

#### Scenario: TINO_DASHBOARD_DIST is not set
- **WHEN** the engine starts without `TINO_DASHBOARD_DIST` in the environment (e.g., direct `uvicorn` for development)
- **THEN** the engine does NOT mount any static files at `/`; API routes work normally

#### Scenario: TINO_DASHBOARD_DIST points to non-existent directory
- **WHEN** the engine starts with `TINO_DASHBOARD_DIST` set to a path that does not exist
- **THEN** the engine logs a warning but starts normally without mounting static files; API routes are unaffected

### Requirement: API routes take priority over static files
The static file mount SHALL be registered AFTER all API and WebSocket routes so that `/api/*` and `/ws/*` paths are handled by their respective routers, not by the static file server.

#### Scenario: API request with dashboard mounted
- **WHEN** a client sends `GET /api/health` while dashboard static serving is active
- **THEN** the request is handled by the health check route, NOT by the static file server

#### Scenario: WebSocket connection with dashboard mounted
- **WHEN** a client opens a WebSocket connection to `/ws/backtest/123` while dashboard static serving is active
- **THEN** the connection is handled by the WebSocket router, NOT by the static file server

#### Scenario: Non-API path with dashboard mounted
- **WHEN** a client sends `GET /strategies` (a Dashboard SPA route, not an API route)
- **THEN** the static file server returns `index.html` (SPA fallback via `html=True`)

### Requirement: Dashboard accessible via engine port
When dashboard static serving is active, users SHALL access the Dashboard by opening `http://localhost:<engine_port>/` in a web browser, using the same port as the engine API.

#### Scenario: User opens browser to engine URL
- **WHEN** the engine is running on port 8000 with dashboard static serving active and a user opens `http://localhost:8000/` in a browser
- **THEN** the browser renders the Dashboard web application

### Requirement: CLI injects dashboard path at engine spawn
The CLI SHALL set `TINO_DASHBOARD_DIST` to the resolved dashboard build output path when spawning the engine process.

#### Scenario: CLI spawns engine with dashboard path
- **WHEN** the CLI spawns the engine and the dashboard build directory exists at `<monorepo_root>/packages/dashboard/dist/`
- **THEN** the CLI sets `TINO_DASHBOARD_DIST=<monorepo_root>/packages/dashboard/dist/` in the engine's spawn environment

#### Scenario: Dashboard not built
- **WHEN** the CLI spawns the engine but `<monorepo_root>/packages/dashboard/dist/` does not exist
- **THEN** the CLI spawns the engine without setting `TINO_DASHBOARD_DIST`; the engine starts without dashboard serving; the CLI logs a warning that dashboard is not available

### Requirement: Engine shutdown endpoint
The engine SHALL expose `POST /api/shutdown` on `127.0.0.1` only, which triggers a graceful shutdown by sending `SIGTERM` to its own process after responding.

#### Scenario: Shutdown request from last CLI
- **WHEN** the last CLI sends `POST /api/shutdown` to the engine
- **THEN** the engine responds with `{"status": "shutting_down"}` and then terminates gracefully, running the lifespan cleanup handler (`close_db()`)

#### Scenario: Shutdown request from non-localhost
- **WHEN** the engine is bound to `127.0.0.1` and a request arrives from a non-local source
- **THEN** the request is rejected by the OS-level bind (the endpoint is not reachable from outside localhost)

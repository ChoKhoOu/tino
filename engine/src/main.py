"""tino Quantitative Trading Engine - FastAPI Application."""

import hmac
import importlib.metadata
import logging
import os
import signal
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from fastapi.exceptions import RequestValidationError

from .core.database import init_db, close_db
from .api.error_handler import validation_exception_handler, generic_exception_handler

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize and cleanup resources."""
    await init_db()
    yield
    await close_db()


app = FastAPI(
    title="tino Engine",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000", "http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers (try/except for routers that don't exist yet)
try:
    from .api.routes.strategies import router as strategies_router
    app.include_router(strategies_router, prefix="/api")
except ImportError:
    pass

try:
    from .api.routes.backtest import router as backtest_router
    app.include_router(backtest_router, prefix="/api")
except ImportError:
    pass

try:
    from .api.routes.live import router as live_router, kill_switch_router
    app.include_router(live_router, prefix="/api")
    app.include_router(kill_switch_router, prefix="/api")
except ImportError:
    pass

try:
    from .api.routes.data import router as data_router
    app.include_router(data_router, prefix="/api")
except ImportError:
    pass

try:
    from .api.ws.backtest_stream import router as backtest_ws_router
    app.include_router(backtest_ws_router)
except ImportError:
    pass

try:
    from .api.ws.live_stream import router as live_ws_router
    app.include_router(live_ws_router)
except ImportError:
    pass

try:
    from .api.ws.dashboard_stream import router as dashboard_ws_router
    app.include_router(dashboard_ws_router)
except ImportError:
    pass


@app.get("/api/health")
async def health_check():
    """Engine health check endpoint."""
    try:
        nautilus_version = importlib.metadata.version("nautilus_trader")
    except importlib.metadata.PackageNotFoundError:
        nautilus_version = "not installed"

    return {
        "status": "healthy",
        "engine_version": "0.1.0",
        "nautilus_version": nautilus_version,
        "active_live_sessions": 0,
        "running_backtests": 0,
    }


ENGINE_TOKEN = os.environ.get("TINO_ENGINE_TOKEN", "")


@app.post("/api/shutdown")
async def shutdown(authorization: str = Header(default="")):
    """Graceful shutdown — called by CLI when last instance exits."""
    if not ENGINE_TOKEN:
        raise HTTPException(status_code=503, detail="Shutdown endpoint disabled: no engine token configured")
    expected = f"Bearer {ENGINE_TOKEN}"
    if not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=403, detail="Invalid engine token")
    os.kill(os.getpid(), signal.SIGTERM)
    return {"status": "shutting_down"}


# SPA-aware static file server: falls back to index.html for unknown paths
class SPAStaticFiles(StaticFiles):
    """StaticFiles subclass that serves index.html for SPA client-side routes."""

    async def get_response(self, path: str, scope):
        try:
            response = await super().get_response(path, scope)
            if response.status_code == 404:
                # Fall back to index.html for SPA routing
                response = await super().get_response(".", scope)
            return response
        except StarletteHTTPException:
            return await super().get_response(".", scope)


# Serve dashboard static files if TINO_DASHBOARD_DIST is set
dashboard_dist = os.environ.get("TINO_DASHBOARD_DIST")
if dashboard_dist:
    dashboard_path = Path(dashboard_dist)
    if dashboard_path.exists() and dashboard_path.is_dir():
        app.mount("/", SPAStaticFiles(directory=str(dashboard_path), html=True), name="dashboard")
    else:
        logger.warning(f"TINO_DASHBOARD_DIST set to '{dashboard_dist}' but directory does not exist. Dashboard will not be served.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="127.0.0.1", port=8000, reload=True)

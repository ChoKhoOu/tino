"""Tino2 Quantitative Trading Engine - FastAPI Application."""

import importlib.metadata
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi.exceptions import RequestValidationError

from .core.database import init_db, close_db
from .api.error_handler import validation_exception_handler, generic_exception_handler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize and cleanup resources."""
    await init_db()
    yield
    await close_db()


app = FastAPI(
    title="Tino2 Engine",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)

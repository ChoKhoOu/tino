"""DaemonService — system info and shutdown control.

This uses a hand-rolled gRPC generic handler instead of generated proto stubs,
so the daemon can start and respond to RPCs even before proto codegen (Task 3)
is complete. Once codegen is wired, this can be refactored to use the generated
servicer base class.
"""

from __future__ import annotations

import asyncio
import json
import logging
import platform
import sys
import time

import grpc
import psutil

logger = logging.getLogger(__name__)

# Track daemon start time for uptime calculation
_START_TIME = time.monotonic()


def _get_nautilus_version() -> str:
    """Get NautilusTrader version, or 'unavailable' if not installed."""
    try:
        import nautilus_trader

        return getattr(nautilus_trader, "__version__", "unknown")
    except ImportError:
        return "unavailable"


def _build_system_info() -> dict:
    """Collect system information."""
    mem = psutil.virtual_memory()
    proc = psutil.Process()
    return {
        "python_version": sys.version,
        "nautilus_trader_version": _get_nautilus_version(),
        "platform": platform.platform(),
        "architecture": platform.machine(),
        "memory_total_mb": round(mem.total / (1024 * 1024), 1),
        "memory_available_mb": round(mem.available / (1024 * 1024), 1),
        "memory_used_percent": mem.percent,
        "process_memory_mb": round(proc.memory_info().rss / (1024 * 1024), 1),
        "uptime_seconds": round(time.monotonic() - _START_TIME, 1),
        "pid": proc.pid,
    }


class DaemonServicer:
    """Hand-rolled gRPC servicer for DaemonService.

    Implements two RPCs:
      - GetSystemInfo: Returns JSON with system/runtime info.
      - Shutdown: Triggers graceful server shutdown.

    Uses generic_handler so no proto-generated code is required.
    """

    def __init__(self, shutdown_event: asyncio.Event) -> None:
        self._shutdown_event = shutdown_event

    def register(self, server: grpc.aio.Server) -> None:
        """Register this servicer with the gRPC server using a generic handler."""
        server.add_generic_rpc_handlers([_DaemonGenericHandler(self)])

    async def get_system_info(
        self,
        request: bytes,
        context: grpc.aio.ServicerContext,
    ) -> bytes:
        """Return system information as JSON-encoded bytes."""
        info = _build_system_info()
        logger.debug("GetSystemInfo: %s", info)
        return json.dumps(info).encode("utf-8")

    async def shutdown(
        self,
        request: bytes,
        context: grpc.aio.ServicerContext,
    ) -> bytes:
        """Trigger daemon shutdown. Returns success message."""
        logger.info("Shutdown RPC received — setting shutdown event")
        # Schedule shutdown slightly in the future so we can respond first
        asyncio.get_running_loop().call_later(0.5, self._shutdown_event.set)
        return json.dumps({"status": "shutting_down"}).encode("utf-8")


class _DaemonGenericHandler(grpc.GenericRpcHandler):
    """Generic RPC handler that routes DaemonService methods."""

    def __init__(self, servicer: DaemonServicer) -> None:
        self._servicer = servicer
        self._methods = {
            "/tino.daemon.v1.DaemonService/GetSystemInfo": grpc.unary_unary_rpc_method_handler(
                servicer.get_system_info,
                request_deserializer=None,
                response_serializer=None,
            ),
            "/tino.daemon.v1.DaemonService/Shutdown": grpc.unary_unary_rpc_method_handler(
                servicer.shutdown,
                request_deserializer=None,
                response_serializer=None,
            ),
        }

    def service(self, handler_call_details: grpc.HandlerCallDetails):
        method = handler_call_details.method
        return self._methods.get(method)

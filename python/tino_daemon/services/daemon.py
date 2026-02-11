"""DaemonService — system info and shutdown control."""

# pyright: reportAttributeAccessIssue=false

from __future__ import annotations

import asyncio
import logging
import sys
import time

import grpc
import psutil

from tino_daemon.proto.tino.daemon.v1 import daemon_pb2, daemon_pb2_grpc

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


class DaemonServicer(daemon_pb2_grpc.DaemonServiceServicer):
    """Implements DaemonService RPCs using proto-generated base class."""

    def __init__(self, shutdown_event: asyncio.Event) -> None:
        self._shutdown_event = shutdown_event

    async def GetSystemInfo(
        self,
        request: daemon_pb2.GetSystemInfoRequest,
        context: grpc.aio.ServicerContext,
    ) -> daemon_pb2.GetSystemInfoResponse:
        """Return system information as proto message."""
        del context
        proc = psutil.Process()
        uptime_seconds = round(time.monotonic() - _START_TIME, 1)

        response = daemon_pb2.GetSystemInfoResponse(
            python_version=sys.version,
            nautilus_version=_get_nautilus_version(),
            memory_usage_bytes=proc.memory_info().rss,
            uptime=str(uptime_seconds),
        )
        logger.debug("GetSystemInfo: %s", response)
        return response

    async def Shutdown(
        self,
        request: daemon_pb2.ShutdownRequest,
        context: grpc.aio.ServicerContext,
    ) -> daemon_pb2.ShutdownResponse:
        """Trigger daemon shutdown. Returns success message."""
        del context
        logger.info("Shutdown RPC received — setting shutdown event")
        # Schedule shutdown slightly in the future so we can respond first
        asyncio.get_running_loop().call_later(0.5, self._shutdown_event.set)
        return daemon_pb2.ShutdownResponse(success=True)

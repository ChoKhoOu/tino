"""BacktestService stub — returns UNIMPLEMENTED for all RPCs.

Will be wired to proto-generated servicer base class after codegen (Task 3).
"""

from __future__ import annotations

import grpc


class BacktestServiceStub:
    """Placeholder for BacktestService.

    Once proto codegen generates the BacktestServiceServicer base class,
    this will inherit from it and implement the actual backtest methods
    (e.g., RunBacktest, GetBacktestStatus, StreamProgress).
    """

    def register(self, server: grpc.aio.Server) -> None:
        """Register this stub with the gRPC server."""
        server.add_generic_rpc_handlers([_BacktestGenericHandler()])


class _BacktestGenericHandler(grpc.GenericRpcHandler):
    """Catches all BacktestService RPCs and returns UNIMPLEMENTED."""

    SERVICE_PREFIX = "/tino.backtest.v1.BacktestService/"

    def service(self, handler_call_details: grpc.HandlerCallDetails):
        if handler_call_details.method.startswith(self.SERVICE_PREFIX):
            return grpc.unary_unary_rpc_method_handler(
                _unimplemented_handler,
                request_deserializer=None,
                response_serializer=None,
            )
        return None


async def _unimplemented_handler(
    request: bytes, context: grpc.aio.ServicerContext
) -> bytes:
    await context.abort(grpc.StatusCode.UNIMPLEMENTED, "Not yet implemented")

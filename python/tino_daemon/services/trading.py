"""TradingService stub — returns UNIMPLEMENTED for all RPCs.

Will be wired to proto-generated servicer base class after codegen (Task 3).
"""

from __future__ import annotations

import grpc


class TradingServiceStub:
    """Placeholder for TradingService.

    Once proto codegen generates the TradingServiceServicer base class,
    this will inherit from it and implement the actual trading methods
    (e.g., StartTrading, StopTrading, SubmitOrder, StreamPositions).
    """

    def register(self, server: grpc.aio.Server) -> None:
        """Register this stub with the gRPC server."""
        server.add_generic_rpc_handlers([_TradingGenericHandler()])


class _TradingGenericHandler(grpc.GenericRpcHandler):
    """Catches all TradingService RPCs and returns UNIMPLEMENTED."""

    SERVICE_PREFIX = "/tino.trading.v1.TradingService/"

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

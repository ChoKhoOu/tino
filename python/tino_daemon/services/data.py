"""DataService stub — returns UNIMPLEMENTED for all RPCs.

Will be wired to proto-generated servicer base class after codegen (Task 3).
"""

from __future__ import annotations

import grpc


class DataServiceStub:
    """Placeholder for DataService.

    Once proto codegen generates the DataServiceServicer base class,
    this will inherit from it and implement the actual data methods
    (e.g., IngestData, QueryBars, StreamQuotes).
    """

    def register(self, server: grpc.aio.Server) -> None:
        """Register this stub with the gRPC server."""
        server.add_generic_rpc_handlers([_DataGenericHandler()])


class _DataGenericHandler(grpc.GenericRpcHandler):
    """Catches all DataService RPCs and returns UNIMPLEMENTED."""

    SERVICE_PREFIX = "/tino.data.v1.DataService/"

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

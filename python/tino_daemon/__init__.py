"""Tino Daemon - NautilusTrader gRPC wrapper for quantitative trading."""

import sys
from pathlib import Path

__version__ = "0.1.0"

# Proto-generated grpc code uses absolute imports like `from tino.data.v1 import data_pb2`.
# Ensure the proto output root is on sys.path so these resolve correctly.
_PROTO_ROOT = str(Path(__file__).resolve().parent / "proto")
if _PROTO_ROOT not in sys.path:
    sys.path.insert(0, _PROTO_ROOT)

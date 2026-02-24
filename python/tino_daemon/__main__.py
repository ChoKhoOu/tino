"""Entry point for `python -m tino_daemon`."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="tino_daemon",
        description="Tino quantitative trading daemon",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="gRPC listen port (default: 50051, or TINO_DAEMON_PORT env var)",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default=None,
        help="Log level (default: INFO, or TINO_DAEMON_LOG_LEVEL env var)",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    # Build config from CLI args + env vars
    from tino_daemon.config import DaemonConfig

    config = DaemonConfig.from_args(port=args.port, log_level=args.log_level)

    # Configure Python logging
    level_map = logging.getLevelNamesMapping()
    logging.basicConfig(
        level=level_map.get(config.log_level, logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stderr,
    )

    logger = logging.getLogger("tino_daemon")

    # Initialize NautilusTrader LogGuard ONCE at startup.
    # This is a global singleton — must happen before any NT usage.
    try:
        from nautilus_trader.core.nautilus_pyo3 import init_logging

        init_logging()
        logger.info("NautilusTrader LogGuard initialized")
    except ImportError:
        logger.warning(
            "NautilusTrader not available — LogGuard not initialized. "
            "NT-dependent features will not work."
        )
    except Exception as exc:
        # LogGuard may already be initialized in this process
        logger.debug("LogGuard init note: %s", exc)

    # Start the gRPC server
    from tino_daemon.server import serve

    logger.info("Starting Tino daemon on port %d", config.port)
    asyncio.run(serve(config))


if __name__ == "__main__":
    main()

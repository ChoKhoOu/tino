"""Daemon configuration with environment variable overrides."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class DaemonConfig:
    """Configuration for the Tino daemon.

    All settings can be overridden via environment variables:
      - TINO_DAEMON_PORT: gRPC listen port (default: 50051)
      - TINO_DAEMON_LOG_LEVEL: Logging level (default: INFO)
      - TINO_DAEMON_PID_FILE: Path to PID file (default: .tino/daemon.pid)
    """

    port: int = field(
        default_factory=lambda: int(os.environ.get("TINO_DAEMON_PORT", "50051"))
    )
    log_level: str = field(
        default_factory=lambda: os.environ.get("TINO_DAEMON_LOG_LEVEL", "INFO").upper()
    )
    pid_file: str = field(
        default_factory=lambda: os.environ.get(
            "TINO_DAEMON_PID_FILE", ".tino/daemon.pid"
        )
    )

    @classmethod
    def from_env(cls) -> DaemonConfig:
        """Create configuration from environment variables."""
        return cls()

    @classmethod
    def from_args(
        cls,
        port: int | None = None,
        log_level: str | None = None,
        pid_file: str | None = None,
    ) -> DaemonConfig:
        """Create configuration from explicit arguments, falling back to env vars."""
        config = cls.from_env()
        overrides: dict = {}
        if port is not None:
            overrides["port"] = port
        if log_level is not None:
            overrides["log_level"] = log_level.upper()
        if pid_file is not None:
            overrides["pid_file"] = pid_file
        if overrides:
            # frozen dataclass — rebuild with overrides
            return DaemonConfig(
                port=overrides.get("port", config.port),
                log_level=overrides.get("log_level", config.log_level),
                pid_file=overrides.get("pid_file", config.pid_file),
            )
        return config

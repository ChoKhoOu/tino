"""Tests for DaemonConfig."""

from __future__ import annotations

import os

from tino_daemon.config import DaemonConfig


def test_default_config():
    """Default config uses expected values."""
    config = DaemonConfig()
    assert config.port == int(os.environ.get("TINO_DAEMON_PORT", "50051"))
    assert config.log_level in (
        "INFO",
        os.environ.get("TINO_DAEMON_LOG_LEVEL", "INFO").upper(),
    )


def test_config_from_args():
    """CLI args override env defaults."""
    config = DaemonConfig.from_args(port=9999, log_level="debug")
    assert config.port == 9999
    assert config.log_level == "DEBUG"


def test_config_from_args_partial():
    """Partial args fall back to defaults for unset fields."""
    config = DaemonConfig.from_args(port=1234)
    assert config.port == 1234
    # log_level should be the default
    assert config.log_level == DaemonConfig().log_level


def test_config_from_env(monkeypatch):
    """Environment variables are picked up."""
    monkeypatch.setenv("TINO_DAEMON_PORT", "8080")
    monkeypatch.setenv("TINO_DAEMON_LOG_LEVEL", "warning")
    monkeypatch.setenv("TINO_DAEMON_PID_FILE", "/tmp/test.pid")
    config = DaemonConfig.from_env()
    assert config.port == 8080
    assert config.log_level == "WARNING"
    assert config.pid_file == "/tmp/test.pid"


def test_config_frozen():
    """Config is immutable (frozen dataclass)."""
    config = DaemonConfig()
    try:
        config.port = 9999  # type: ignore[misc]
        assert False, "Should have raised"
    except AttributeError:
        pass

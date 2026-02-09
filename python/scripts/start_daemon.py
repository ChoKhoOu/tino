#!/usr/bin/env python3
"""Convenience script to start the Tino daemon.

Usage:
    uv run python scripts/start_daemon.py [--port PORT] [--log-level LEVEL]
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure the project root is on the path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tino_daemon.__main__ import main

if __name__ == "__main__":
    main()

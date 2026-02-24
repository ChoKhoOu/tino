"""Simple async rate limiter for exchange API calls."""

from __future__ import annotations

import asyncio
import time


class RateLimiter:
    """Token-bucket rate limiter.

    Args:
        max_calls: Maximum number of calls allowed in the window.
        window_seconds: Time window in seconds.
    """

    def __init__(self, max_calls: int, window_seconds: float) -> None:
        self._max_calls = max_calls
        self._window = window_seconds
        self._timestamps: list[float] = []
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        """Wait until a request slot is available."""
        async with self._lock:
            now = time.monotonic()
            # Purge expired timestamps
            cutoff = now - self._window
            self._timestamps = [t for t in self._timestamps if t > cutoff]

            if len(self._timestamps) >= self._max_calls:
                # Wait until the oldest timestamp expires
                sleep_time = self._timestamps[0] - cutoff
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
                self._timestamps = [
                    t for t in self._timestamps if t > time.monotonic() - self._window
                ]

            self._timestamps.append(time.monotonic())

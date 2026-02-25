"""FundingScheduler — simulates 8-hour perpetual contract funding rate settlement."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Callable

logger = logging.getLogger(__name__)

# Standard funding settlement times (UTC hours): 00:00, 08:00, 16:00
FUNDING_HOURS = (0, 8, 16)
FUNDING_INTERVAL_SECONDS = 8 * 3600  # 8 hours


def next_funding_time(now: datetime | None = None) -> datetime:
    """Calculate the next funding settlement time (UTC)."""
    if now is None:
        now = datetime.now(timezone.utc)

    current_hour = now.hour
    current_date = now.date()

    for h in FUNDING_HOURS:
        candidate = datetime(
            current_date.year, current_date.month, current_date.day,
            h, 0, 0, tzinfo=timezone.utc,
        )
        if candidate > now:
            return candidate

    # Next day 00:00 UTC
    from datetime import timedelta
    next_day = current_date + timedelta(days=1)
    return datetime(
        next_day.year, next_day.month, next_day.day,
        0, 0, 0, tzinfo=timezone.utc,
    )


def seconds_until_funding(now: datetime | None = None) -> float:
    """Return seconds until next funding settlement."""
    if now is None:
        now = datetime.now(timezone.utc)
    return (next_funding_time(now) - now).total_seconds()


class FundingScheduler:
    """Tracks funding settlement schedule and applies funding to positions.

    Calls the provided apply_funding callback at each 8-hour settlement time
    with the real funding rate fetched from the exchange connector.
    """

    def __init__(
        self,
        *,
        on_funding_applied: Callable[[str, float, float], None] | None = None,
    ) -> None:
        """Initialize the scheduler.

        Args:
            on_funding_applied: Callback(instrument, rate, payment) after settlement.
        """
        self._on_funding_applied = on_funding_applied
        self._last_funding_time: datetime | None = None
        self._funding_history: list[dict[str, Any]] = []

    @property
    def last_funding_time(self) -> datetime | None:
        return self._last_funding_time

    @property
    def next_funding(self) -> datetime:
        return next_funding_time()

    @property
    def funding_history(self) -> list[dict[str, Any]]:
        return list(self._funding_history)

    def should_settle(self, now: datetime | None = None) -> bool:
        """Check if a funding settlement is due."""
        if now is None:
            now = datetime.now(timezone.utc)

        if self._last_funding_time is None:
            # On first check, only settle if we're within 60s of a funding time
            for h in FUNDING_HOURS:
                candidate = datetime(
                    now.year, now.month, now.day, h, 0, 0, tzinfo=timezone.utc,
                )
                diff = abs((now - candidate).total_seconds())
                if diff < 60:
                    return True
            return False

        # Check if a funding time has passed since the last settlement
        elapsed = (now - self._last_funding_time).total_seconds()
        return elapsed >= FUNDING_INTERVAL_SECONDS - 30  # 30s tolerance

    def record_settlement(
        self,
        instrument: str,
        funding_rate: float,
        payment: float,
        now: datetime | None = None,
    ) -> None:
        """Record a funding settlement event."""
        if now is None:
            now = datetime.now(timezone.utc)

        self._last_funding_time = now
        entry = {
            "instrument": instrument,
            "funding_rate": funding_rate,
            "payment": payment,
            "timestamp": now.isoformat(),
        }
        self._funding_history.append(entry)

        logger.info(
            "Funding settled: %s rate=%.6f payment=%.4f",
            instrument,
            funding_rate,
            payment,
        )

        if self._on_funding_applied:
            self._on_funding_applied(instrument, funding_rate, payment)

    def trim_history(self, max_entries: int = 1000) -> None:
        """Trim funding history to prevent unbounded memory growth."""
        if len(self._funding_history) > max_entries:
            self._funding_history = self._funding_history[-max_entries:]

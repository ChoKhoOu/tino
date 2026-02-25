"""Tests for FundingScheduler — 8-hour funding rate settlement."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from tino_daemon.paper.funding import (
    FUNDING_HOURS,
    FundingScheduler,
    next_funding_time,
    seconds_until_funding,
)


class TestNextFundingTime:
    def test_before_first_settlement(self) -> None:
        # 2024-01-15 at 06:00 UTC -> next is 08:00
        now = datetime(2024, 1, 15, 6, 0, 0, tzinfo=timezone.utc)
        result = next_funding_time(now)
        assert result.hour == 8
        assert result.day == 15

    def test_between_settlements(self) -> None:
        # 2024-01-15 at 10:00 UTC -> next is 16:00
        now = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        result = next_funding_time(now)
        assert result.hour == 16

    def test_after_last_settlement(self) -> None:
        # 2024-01-15 at 20:00 UTC -> next is 00:00 on 2024-01-16
        now = datetime(2024, 1, 15, 20, 0, 0, tzinfo=timezone.utc)
        result = next_funding_time(now)
        assert result.hour == 0
        assert result.day == 16

    def test_exactly_at_settlement_time(self) -> None:
        # At exactly 08:00, next should be 16:00
        now = datetime(2024, 1, 15, 8, 0, 0, tzinfo=timezone.utc)
        result = next_funding_time(now)
        assert result.hour == 16

    def test_just_before_midnight(self) -> None:
        now = datetime(2024, 1, 15, 23, 59, 59, tzinfo=timezone.utc)
        result = next_funding_time(now)
        assert result.hour == 0
        assert result.day == 16


class TestSecondsUntilFunding:
    def test_seconds_calculation(self) -> None:
        now = datetime(2024, 1, 15, 7, 0, 0, tzinfo=timezone.utc)
        secs = seconds_until_funding(now)
        assert secs == pytest.approx(3600.0)  # 1 hour to 08:00


class TestFundingScheduler:
    def test_initial_should_settle_at_funding_time(self) -> None:
        scheduler = FundingScheduler()
        # At exactly 08:00
        at_funding = datetime(2024, 1, 15, 8, 0, 0, tzinfo=timezone.utc)
        assert scheduler.should_settle(at_funding) is True

    def test_initial_should_not_settle_between_times(self) -> None:
        scheduler = FundingScheduler()
        between = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        assert scheduler.should_settle(between) is False

    def test_should_settle_after_interval(self) -> None:
        scheduler = FundingScheduler()
        # Record a settlement at 08:00
        t0 = datetime(2024, 1, 15, 8, 0, 0, tzinfo=timezone.utc)
        scheduler.record_settlement("BTCUSDT", 0.0001, -5.0, t0)

        # 8 hours later at 16:00 -> should settle
        t1 = datetime(2024, 1, 15, 16, 0, 0, tzinfo=timezone.utc)
        assert scheduler.should_settle(t1) is True

    def test_should_not_settle_too_early(self) -> None:
        scheduler = FundingScheduler()
        t0 = datetime(2024, 1, 15, 8, 0, 0, tzinfo=timezone.utc)
        scheduler.record_settlement("BTCUSDT", 0.0001, -5.0, t0)

        # 4 hours later -> too early
        t1 = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        assert scheduler.should_settle(t1) is False

    def test_record_settlement(self) -> None:
        events: list[tuple[str, float, float]] = []
        scheduler = FundingScheduler(
            on_funding_applied=lambda i, r, p: events.append((i, r, p)),
        )
        t0 = datetime(2024, 1, 15, 8, 0, 0, tzinfo=timezone.utc)
        scheduler.record_settlement("BTCUSDT", 0.0001, -5.0, t0)

        assert scheduler.last_funding_time == t0
        assert len(scheduler.funding_history) == 1
        assert scheduler.funding_history[0]["instrument"] == "BTCUSDT"
        assert events == [("BTCUSDT", 0.0001, -5.0)]

    def test_trim_history(self) -> None:
        scheduler = FundingScheduler()
        for i in range(50):
            t = datetime(2024, 1, 15, 8, 0, i, tzinfo=timezone.utc)
            scheduler.record_settlement("BTCUSDT", 0.0001, -5.0, t)

        assert len(scheduler.funding_history) == 50
        scheduler.trim_history(max_entries=10)
        assert len(scheduler.funding_history) == 10

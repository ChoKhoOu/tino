"""Tests for BacktestServiceServicer._extract_metrics()."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from tino_daemon.services.backtest import BacktestServiceServicer


@pytest.fixture
def wrapper(tmp_path, monkeypatch):
    # BacktestDB tries to open .tino/backtests.db; redirect to tmp_path.
    monkeypatch.setattr(
        "tino_daemon.persistence.backtest_db.BacktestDB.__init__",
        lambda self, db_path=None: None,
    )
    catalog = MagicMock()
    catalog.path = tmp_path / "catalog"
    (tmp_path / "strategies").mkdir()
    return BacktestServiceServicer(
        catalog=catalog,
        backtests_dir=str(tmp_path / "backtests"),
        strategies_dir=str(tmp_path / "strategies"),
    )


def _make_engine_mock(
    stats_returns: dict | None = None,
    stats_pnls: dict[str, dict[str, float]] | None = None,
    total_orders: int = 5,
):
    """Build a mock NautilusTrader engine with get_result() API."""
    result = SimpleNamespace(
        stats_returns=stats_returns if stats_returns is not None else {
            "Sharpe Ratio": 1.5,
            "Sortino Ratio": 2.1,
            "Profit Factor": 1.8,
            "Max Drawdown": -0.05,
            "Win Rate": 0.6,
        },
        stats_pnls=stats_pnls if stats_pnls is not None else {
            "AAPL.XNAS": {
                "PnL% (total)": 0.12,
            },
        },
        total_orders=total_orders,
    )

    engine = MagicMock()
    engine.get_result.return_value = result
    return engine


class TestExtractMetrics:
    def test_returns_sharpe_ratio(self, wrapper):
        engine = _make_engine_mock()
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert metrics["sharpe_ratio"] == 1.5

    def test_returns_sortino_ratio(self, wrapper):
        engine = _make_engine_mock()
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert metrics["sortino_ratio"] == 2.1

    def test_returns_profit_factor(self, wrapper):
        engine = _make_engine_mock()
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert metrics["profit_factor"] == 1.8

    def test_returns_total_return(self, wrapper):
        engine = _make_engine_mock()
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert metrics["total_return"] == pytest.approx(0.12)

    def test_returns_win_rate(self, wrapper):
        engine = _make_engine_mock()
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert metrics["win_rate"] == pytest.approx(0.6)

    def test_returns_max_drawdown(self, wrapper):
        engine = _make_engine_mock()
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert metrics["max_drawdown"] == -0.05

    def test_total_trades_from_total_orders(self, wrapper):
        engine = _make_engine_mock(total_orders=10)
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert metrics["total_trades"] == 10

    def test_winning_trades_always_zero(self, wrapper):
        """The simplified implementation always returns 0 for winning_trades."""
        engine = _make_engine_mock()
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert metrics["winning_trades"] == 0

    def test_equity_curve_empty(self, wrapper):
        """The simplified implementation returns empty equity_curve."""
        engine = _make_engine_mock()
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert metrics["equity_curve"] == []

    def test_trades_list_empty(self, wrapper):
        """The simplified implementation returns empty trades list."""
        engine = _make_engine_mock()
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert metrics["trades"] == []

    def test_pnl_aggregated_across_instruments(self, wrapper):
        """stats_pnls values are summed across all instruments."""
        engine = _make_engine_mock(
            stats_pnls={
                "AAPL.XNAS": {"PnL% (total)": 0.05},
                "MSFT.XNAS": {"PnL% (total)": 0.07},
            },
        )
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert metrics["total_return"] == pytest.approx(0.12)

    def test_missing_keys_default_to_zero(self, wrapper):
        engine = _make_engine_mock(
            stats_returns={},
            stats_pnls={},
            total_orders=0,
        )
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert metrics["sharpe_ratio"] == 0.0
        assert metrics["sortino_ratio"] == 0.0
        assert metrics["profit_factor"] == 0.0
        assert metrics["max_drawdown"] == 0.0
        assert metrics["win_rate"] == 0.0
        assert metrics["total_return"] == 0.0
        assert metrics["total_trades"] == 0

    def test_no_hardcoded_zeros_with_real_data(self, wrapper):
        """Core regression test: metrics must not all be zero when data exists."""
        engine = _make_engine_mock()
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        non_zero_fields = [
            "total_return",
            "sharpe_ratio",
            "total_trades",
            "win_rate",
            "profit_factor",
        ]
        for field in non_zero_fields:
            assert metrics[field] != 0, f"{field} should not be zero"



class TestSanitize:
    def test_normal_float(self):
        assert BacktestServiceServicer._sanitize(1.5) == 1.5

    def test_nan_to_zero(self):
        assert BacktestServiceServicer._sanitize(float("nan")) == 0.0

    def test_inf_to_zero(self):
        assert BacktestServiceServicer._sanitize(float("inf")) == 0.0

    def test_neg_inf_to_zero(self):
        assert BacktestServiceServicer._sanitize(float("-inf")) == 0.0

    def test_none_to_zero(self):
        assert BacktestServiceServicer._sanitize(None) == 0.0

    def test_string_to_zero(self):
        assert BacktestServiceServicer._sanitize("not a number") == 0.0

    def test_int_value(self):
        assert BacktestServiceServicer._sanitize(42) == 42.0

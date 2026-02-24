"""Tests for BacktestEngineWrapper._extract_metrics()."""

from __future__ import annotations

import math
from types import SimpleNamespace
from unittest.mock import MagicMock

import pandas as pd
import pytest

from tino_daemon.nautilus.engine import BacktestEngineWrapper


@pytest.fixture
def wrapper(tmp_path, monkeypatch):
    # BacktestDB tries to open .tino/backtests.db; redirect to tmp_path.
    monkeypatch.setattr(
        "tino_daemon.persistence.backtest_db.BacktestDB.__init__",
        lambda self, db_path=None: None,
    )
    (tmp_path / "strategies").mkdir()
    return BacktestEngineWrapper(
        catalog_path=str(tmp_path / "catalog"),
        backtests_dir=str(tmp_path / "backtests"),
        strategies_dir=str(tmp_path / "strategies"),
    )


def _make_position(instrument_id: str, pnl: float, ret: float, entry: str = "BUY"):
    pos = SimpleNamespace(
        instrument_id=instrument_id,
        realized_pnl=pnl,
        realized_return=ret,
        entry=entry,
    )
    return pos


def _make_engine_mock(
    stats_returns: dict | None = None,
    stats_pnls: dict | None = None,
    closed_positions: list | None = None,
    returns_values: list[float] | None = None,
):
    """Build a mock NautilusTrader engine with portfolio.analyzer and cache."""
    analyzer = MagicMock()
    analyzer.get_performance_stats_returns.return_value = stats_returns or {
        "Sharpe Ratio (252 days)": 1.5,
        "Sortino Ratio (252 days)": 2.1,
        "Profit Factor": 1.8,
    }
    analyzer.get_performance_stats_pnls.return_value = stats_pnls or {
        "PnL% (total)": 0.12,
        "Win Rate": 0.6,
    }

    if returns_values is not None:
        analyzer.returns.return_value = pd.Series(returns_values)
    else:
        analyzer.returns.return_value = pd.Series([0.01, -0.005, 0.02, -0.01, 0.015])

    portfolio = MagicMock()
    portfolio.analyzer = analyzer

    cache = MagicMock()
    if closed_positions is None:
        closed_positions = [
            _make_position("AAPL.XNAS", 100.0, 0.05),
            _make_position("AAPL.XNAS", -50.0, -0.025),
            _make_position("AAPL.XNAS", 75.0, 0.04),
        ]
    cache.positions_closed.return_value = closed_positions

    engine = MagicMock()
    engine.portfolio = portfolio
    engine.cache = cache
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

    def test_total_trades_from_closed_positions(self, wrapper):
        engine = _make_engine_mock()
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert metrics["total_trades"] == 3

    def test_winning_trades_counted_correctly(self, wrapper):
        engine = _make_engine_mock()
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        # 2 positions with positive PnL (100.0 and 75.0)
        assert metrics["winning_trades"] == 2

    def test_max_drawdown_computed(self, wrapper):
        engine = _make_engine_mock()
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert metrics["max_drawdown"] > 0.0

    def test_equity_curve_is_list(self, wrapper):
        engine = _make_engine_mock()
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert isinstance(metrics["equity_curve"], list)
        assert len(metrics["equity_curve"]) == 5

    def test_trades_list_populated(self, wrapper):
        engine = _make_engine_mock()
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert len(metrics["trades"]) == 3
        assert metrics["trades"][0]["pnl"] == 100.0
        assert metrics["trades"][0]["instrument"] == "AAPL.XNAS"

    def test_nan_values_sanitized_to_zero(self, wrapper):
        engine = _make_engine_mock(
            stats_returns={
                "Sharpe Ratio (252 days)": float("nan"),
                "Sortino Ratio (252 days)": float("inf"),
                "Profit Factor": float("-inf"),
            },
            stats_pnls={
                "PnL% (total)": float("nan"),
                "Win Rate": float("nan"),
            },
        )
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert metrics["sharpe_ratio"] == 0.0
        assert metrics["sortino_ratio"] == 0.0
        assert metrics["profit_factor"] == 0.0
        assert metrics["total_return"] == 0.0
        assert metrics["win_rate"] == 0.0

    def test_no_trades_returns_zeros(self, wrapper):
        engine = _make_engine_mock(
            stats_returns={
                "Sharpe Ratio (252 days)": float("nan"),
                "Sortino Ratio (252 days)": float("nan"),
                "Profit Factor": float("nan"),
            },
            stats_pnls={
                "PnL% (total)": 0.0,
                "Win Rate": float("nan"),
            },
            closed_positions=[],
            returns_values=[],
        )
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        assert metrics["total_trades"] == 0
        assert metrics["winning_trades"] == 0
        assert metrics["max_drawdown"] == 0.0
        assert metrics["equity_curve"] == []
        assert metrics["trades"] == []

    def test_no_hardcoded_zeros_with_real_data(self, wrapper):
        """Core regression test: metrics must not all be zero when data exists."""
        engine = _make_engine_mock()
        metrics = wrapper._extract_metrics(engine, "AAPL.XNAS")
        non_zero_fields = [
            "total_return",
            "sharpe_ratio",
            "total_trades",
            "winning_trades",
            "win_rate",
            "profit_factor",
        ]
        for field in non_zero_fields:
            assert metrics[field] != 0, f"{field} should not be zero"


class TestSanitize:
    def test_normal_float(self):
        assert BacktestEngineWrapper._sanitize(1.5) == 1.5

    def test_nan_to_zero(self):
        assert BacktestEngineWrapper._sanitize(float("nan")) == 0.0

    def test_inf_to_zero(self):
        assert BacktestEngineWrapper._sanitize(float("inf")) == 0.0

    def test_neg_inf_to_zero(self):
        assert BacktestEngineWrapper._sanitize(float("-inf")) == 0.0

    def test_none_to_zero(self):
        assert BacktestEngineWrapper._sanitize(None) == 0.0

    def test_string_to_zero(self):
        assert BacktestEngineWrapper._sanitize("not a number") == 0.0

    def test_int_value(self):
        assert BacktestEngineWrapper._sanitize(42) == 42.0

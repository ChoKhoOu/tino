"""Tests for GridSearchEngine and GridSearchResult."""

from __future__ import annotations

from typing import Any

import pytest

from tino_daemon.optimization.grid_search import GridSearchEngine, GridSearchResult


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_CONFIG_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
        "threshold": {
            "type": "number",
            "default": 0.15,
            "minimum": 0.01,
            "maximum": 1.0,
            "description": "Entry threshold.",
        },
        "period": {
            "type": "integer",
            "default": 8,
            "minimum": 2,
            "maximum": 20,
            "description": "Lookback period.",
        },
        "instrument_id": {
            "type": "string",
            "default": "BTC-PERP.BINANCE",
            "description": "Instrument (not tunable).",
        },
    },
}


class _MockStrategy:
    """Minimal mock strategy class for testing."""

    name = "mock_strategy"
    CONFIG_SCHEMA = SAMPLE_CONFIG_SCHEMA


# ---------------------------------------------------------------------------
# GridSearchResult dataclass
# ---------------------------------------------------------------------------


class TestGridSearchResult:
    def test_create_minimal(self) -> None:
        r = GridSearchResult(params={"a": 1})
        assert r.params == {"a": 1}
        assert r.sharpe_ratio == 0.0
        assert r.total_return == 0.0
        assert r.max_drawdown == 0.0
        assert r.win_rate == 0.0
        assert r.num_trades == 0

    def test_create_full(self) -> None:
        r = GridSearchResult(
            params={"threshold": 0.1},
            sharpe_ratio=1.5,
            total_return=0.25,
            max_drawdown=0.08,
            win_rate=0.55,
            num_trades=120,
        )
        assert r.sharpe_ratio == 1.5
        assert r.total_return == 0.25
        assert r.max_drawdown == 0.08
        assert r.win_rate == 0.55
        assert r.num_trades == 120

    def test_frozen(self) -> None:
        r = GridSearchResult(params={"a": 1})
        with pytest.raises(AttributeError):
            r.sharpe_ratio = 2.0  # type: ignore[misc]


# ---------------------------------------------------------------------------
# extract_param_ranges
# ---------------------------------------------------------------------------


class TestExtractParamRanges:
    def test_extracts_numeric_and_integer(self) -> None:
        ranges = GridSearchEngine.extract_param_ranges(SAMPLE_CONFIG_SCHEMA)
        assert "threshold" in ranges
        assert "period" in ranges
        # string params should be skipped
        assert "instrument_id" not in ranges

    def test_numeric_range_values(self) -> None:
        ranges = GridSearchEngine.extract_param_ranges(SAMPLE_CONFIG_SCHEMA)
        threshold_values = ranges["threshold"]
        assert len(threshold_values) == GridSearchEngine.DEFAULT_NUM_STEPS
        assert threshold_values[0] == pytest.approx(0.01)
        assert threshold_values[-1] == pytest.approx(1.0)
        # Values should be monotonically increasing
        assert threshold_values == sorted(threshold_values)

    def test_integer_range_values(self) -> None:
        ranges = GridSearchEngine.extract_param_ranges(SAMPLE_CONFIG_SCHEMA)
        period_values = ranges["period"]
        # All values should be ints
        assert all(isinstance(v, int) for v in period_values)
        assert period_values[0] >= 2
        assert period_values[-1] <= 20
        # Should be unique and sorted
        assert period_values == sorted(set(period_values))

    def test_empty_schema(self) -> None:
        ranges = GridSearchEngine.extract_param_ranges({})
        assert ranges == {}

    def test_no_range_constraints(self) -> None:
        schema = {
            "properties": {
                "x": {"type": "number", "default": 1.0},  # no min/max
            }
        }
        ranges = GridSearchEngine.extract_param_ranges(schema)
        assert "x" not in ranges

    def test_partial_constraints(self) -> None:
        schema = {
            "properties": {
                "x": {"type": "number", "minimum": 0.0},  # no maximum
            }
        }
        ranges = GridSearchEngine.extract_param_ranges(schema)
        assert "x" not in ranges

    def test_small_integer_range(self) -> None:
        """When max - min + 1 < DEFAULT_NUM_STEPS, all integers are included."""
        schema = {
            "properties": {
                "n": {"type": "integer", "minimum": 1, "maximum": 3},
            }
        }
        ranges = GridSearchEngine.extract_param_ranges(schema)
        assert ranges["n"] == [1, 2, 3]

    def test_real_funding_rate_schema(self) -> None:
        """Verify extraction works with the real FundingRateArbStrategy schema."""
        from tino_daemon.strategies.funding_rate_arb import FundingRateArbStrategy

        ranges = GridSearchEngine.extract_param_ranges(
            FundingRateArbStrategy.CONFIG_SCHEMA
        )
        # Should extract at least the numeric params with min/max
        assert "funding_rate_threshold" in ranges
        assert "stop_loss_pct" in ranges
        assert "fast_ema_period" in ranges
        # String param should be excluded
        assert "perp_instrument_id" not in ranges


# ---------------------------------------------------------------------------
# generate_grid
# ---------------------------------------------------------------------------


class TestGenerateGrid:
    def test_basic_cartesian_product(self) -> None:
        ranges = {"a": [1, 2], "b": [10, 20]}
        grid = GridSearchEngine.generate_grid(ranges)
        assert len(grid) == 4
        # Check all combinations present
        combos = {(d["a"], d["b"]) for d in grid}
        assert combos == {(1, 10), (1, 20), (2, 10), (2, 20)}

    def test_single_param(self) -> None:
        ranges = {"x": [0.1, 0.2, 0.3]}
        grid = GridSearchEngine.generate_grid(ranges)
        assert len(grid) == 3
        assert all("x" in d for d in grid)

    def test_empty_ranges(self) -> None:
        grid = GridSearchEngine.generate_grid({})
        assert grid == []

    def test_max_combinations_limit(self) -> None:
        ranges = {"a": list(range(100)), "b": list(range(100))}
        grid = GridSearchEngine.generate_grid(ranges, max_combinations=50)
        assert len(grid) == 50

    def test_max_combinations_exact(self) -> None:
        ranges = {"a": [1, 2], "b": [3, 4]}
        grid = GridSearchEngine.generate_grid(ranges, max_combinations=4)
        assert len(grid) == 4

    def test_max_combinations_under_limit(self) -> None:
        ranges = {"a": [1, 2]}
        grid = GridSearchEngine.generate_grid(ranges, max_combinations=1000)
        assert len(grid) == 2

    def test_invalid_max_combinations(self) -> None:
        with pytest.raises(ValueError, match="max_combinations must be >= 1"):
            GridSearchEngine.generate_grid({"a": [1]}, max_combinations=0)

    def test_grid_preserves_param_names(self) -> None:
        ranges = {"threshold": [0.1], "period": [8]}
        grid = GridSearchEngine.generate_grid(ranges)
        assert len(grid) == 1
        assert grid[0] == {"threshold": 0.1, "period": 8}


# ---------------------------------------------------------------------------
# run
# ---------------------------------------------------------------------------


class TestRun:
    def test_returns_results_for_all_combos(self) -> None:
        engine = GridSearchEngine()
        grid = [{"a": 1}, {"a": 2}, {"a": 3}]
        results = engine.run(_MockStrategy, grid)
        assert len(results) == 3
        assert all(isinstance(r, GridSearchResult) for r in results)

    def test_results_have_correct_params(self) -> None:
        engine = GridSearchEngine()
        grid = [{"threshold": 0.1}, {"threshold": 0.5}]
        results = engine.run(_MockStrategy, grid)
        assert results[0].params == {"threshold": 0.1}
        assert results[1].params == {"threshold": 0.5}

    def test_empty_grid(self) -> None:
        engine = GridSearchEngine()
        results = engine.run(_MockStrategy, [])
        assert results == []

    def test_results_are_deterministic(self) -> None:
        """Same params should produce same mock results."""
        engine = GridSearchEngine()
        grid = [{"a": 1, "b": 2}]
        r1 = engine.run(_MockStrategy, grid)
        r2 = engine.run(_MockStrategy, grid)
        assert r1[0].sharpe_ratio == r2[0].sharpe_ratio
        assert r1[0].total_return == r2[0].total_return

    def test_different_params_produce_different_results(self) -> None:
        engine = GridSearchEngine()
        grid = [{"a": 1}, {"a": 999}]
        results = engine.run(_MockStrategy, grid)
        # Very unlikely to be identical with different seeds
        assert results[0].params != results[1].params

    def test_with_backtest_config(self) -> None:
        engine = GridSearchEngine()
        grid = [{"a": 1}]
        config = {"instrument": "BTC-PERP.BINANCE", "start_date": "2024-01-01"}
        results = engine.run(_MockStrategy, grid, backtest_config=config)
        assert len(results) == 1


# ---------------------------------------------------------------------------
# rank_results
# ---------------------------------------------------------------------------


class TestRankResults:
    @pytest.fixture()
    def sample_results(self) -> list[GridSearchResult]:
        return [
            GridSearchResult(
                params={"a": 1}, sharpe_ratio=1.0, total_return=0.10, max_drawdown=0.20
            ),
            GridSearchResult(
                params={"a": 2}, sharpe_ratio=2.5, total_return=0.30, max_drawdown=0.05
            ),
            GridSearchResult(
                params={"a": 3}, sharpe_ratio=0.5, total_return=0.50, max_drawdown=0.35
            ),
            GridSearchResult(
                params={"a": 4}, sharpe_ratio=1.8, total_return=0.20, max_drawdown=0.10
            ),
        ]

    def test_rank_by_sharpe_ratio(self, sample_results: list[GridSearchResult]) -> None:
        ranked = GridSearchEngine.rank_results(
            sample_results, metric="sharpe_ratio", top_n=10
        )
        assert ranked[0].sharpe_ratio == 2.5
        assert ranked[1].sharpe_ratio == 1.8
        assert ranked[2].sharpe_ratio == 1.0
        assert ranked[3].sharpe_ratio == 0.5

    def test_rank_by_total_return(self, sample_results: list[GridSearchResult]) -> None:
        ranked = GridSearchEngine.rank_results(
            sample_results, metric="total_return", top_n=10
        )
        assert ranked[0].total_return == 0.50
        assert ranked[1].total_return == 0.30

    def test_rank_by_max_drawdown(self, sample_results: list[GridSearchResult]) -> None:
        """Lower drawdown should rank first."""
        ranked = GridSearchEngine.rank_results(
            sample_results, metric="max_drawdown", top_n=10
        )
        assert ranked[0].max_drawdown == 0.05
        assert ranked[1].max_drawdown == 0.10
        assert ranked[2].max_drawdown == 0.20
        assert ranked[3].max_drawdown == 0.35

    def test_top_n_limit(self, sample_results: list[GridSearchResult]) -> None:
        ranked = GridSearchEngine.rank_results(
            sample_results, metric="sharpe_ratio", top_n=2
        )
        assert len(ranked) == 2
        assert ranked[0].sharpe_ratio == 2.5
        assert ranked[1].sharpe_ratio == 1.8

    def test_top_n_exceeds_results(self, sample_results: list[GridSearchResult]) -> None:
        ranked = GridSearchEngine.rank_results(
            sample_results, metric="sharpe_ratio", top_n=100
        )
        assert len(ranked) == 4

    def test_unsupported_metric(self, sample_results: list[GridSearchResult]) -> None:
        with pytest.raises(ValueError, match="Unsupported metric"):
            GridSearchEngine.rank_results(sample_results, metric="invalid_metric")

    def test_empty_results(self) -> None:
        ranked = GridSearchEngine.rank_results([], metric="sharpe_ratio")
        assert ranked == []

    def test_default_metric_is_sharpe(
        self, sample_results: list[GridSearchResult]
    ) -> None:
        ranked = GridSearchEngine.rank_results(sample_results)
        assert ranked[0].sharpe_ratio == 2.5


# ---------------------------------------------------------------------------
# End-to-end: extract -> generate -> run -> rank
# ---------------------------------------------------------------------------


class TestEndToEnd:
    def test_full_pipeline(self) -> None:
        engine = GridSearchEngine()

        # 1. Extract ranges
        ranges = engine.extract_param_ranges(SAMPLE_CONFIG_SCHEMA)
        assert len(ranges) >= 2

        # 2. Generate grid
        grid = engine.generate_grid(ranges, max_combinations=50)
        assert len(grid) > 0
        assert len(grid) <= 50

        # 3. Run
        results = engine.run(_MockStrategy, grid)
        assert len(results) == len(grid)

        # 4. Rank
        top = engine.rank_results(results, metric="sharpe_ratio", top_n=5)
        assert len(top) <= 5
        # Verify descending order
        for i in range(len(top) - 1):
            assert top[i].sharpe_ratio >= top[i + 1].sharpe_ratio

    def test_full_pipeline_with_real_schema(self) -> None:
        """Pipeline using FundingRateArbStrategy's CONFIG_SCHEMA."""
        from tino_daemon.strategies.funding_rate_arb import FundingRateArbStrategy

        engine = GridSearchEngine()

        ranges = engine.extract_param_ranges(FundingRateArbStrategy.CONFIG_SCHEMA)
        # Limit to 2 params to keep grid small
        limited_ranges = dict(list(ranges.items())[:2])
        grid = engine.generate_grid(limited_ranges, max_combinations=25)
        results = engine.run(FundingRateArbStrategy, grid)
        top = engine.rank_results(results, metric="max_drawdown", top_n=3)

        assert len(top) <= 3
        # Lower drawdown first
        for i in range(len(top) - 1):
            assert top[i].max_drawdown <= top[i + 1].max_drawdown

"""Grid search engine for backtest parameter optimization.

Extracts tunable parameter ranges from a strategy's CONFIG_SCHEMA,
generates a Cartesian product grid of combinations, runs backtests
for each, and ranks results by the chosen metric.
"""

from __future__ import annotations

import hashlib
import itertools
import logging
import math
from dataclasses import dataclass, field
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class GridSearchResult:
    """Result of a single backtest run within a grid search."""

    params: dict[str, Any]
    sharpe_ratio: float = 0.0
    total_return: float = 0.0
    max_drawdown: float = 0.0
    win_rate: float = 0.0
    num_trades: int = 0


class GridSearchEngine:
    """Engine for exhaustive grid search over strategy parameter space.

    Workflow:
      1. extract_param_ranges(config_schema) -> param_ranges
      2. generate_grid(param_ranges, max_combinations) -> param_grid
      3. run(strategy_class, param_grid, backtest_config) -> results
      4. rank_results(results, metric, top_n) -> ranked
    """

    # Supported ranking metrics and their sort direction (True = higher is better)
    RANKING_METRICS: dict[str, bool] = {
        "sharpe_ratio": True,
        "total_return": True,
        "max_drawdown": False,  # lower drawdown is better
    }

    # Default number of steps when generating ranges for numeric parameters
    DEFAULT_NUM_STEPS = 5

    @staticmethod
    def extract_param_ranges(config_schema: dict[str, Any]) -> dict[str, list[Any]]:
        """Parse CONFIG_SCHEMA properties to find tunable parameters with ranges.

        For numeric/integer properties that have both ``minimum`` and ``maximum``,
        generates a linspace of values. Parameters without range constraints or
        non-numeric types are skipped.

        Args:
            config_schema: JSON Schema dict (must have "properties" key).

        Returns:
            Dict mapping parameter name -> list of candidate values.
        """
        properties = config_schema.get("properties", {})
        param_ranges: dict[str, list[Any]] = {}

        for name, prop in properties.items():
            prop_type = prop.get("type")
            minimum = prop.get("minimum")
            maximum = prop.get("maximum")

            if minimum is None or maximum is None:
                continue

            if prop_type == "number":
                values = np.linspace(
                    minimum, maximum, GridSearchEngine.DEFAULT_NUM_STEPS
                ).tolist()
                # Round to avoid floating point noise
                param_ranges[name] = [round(v, 6) for v in values]
            elif prop_type == "integer":
                # For integers, use unique integer steps
                step_count = min(
                    GridSearchEngine.DEFAULT_NUM_STEPS, maximum - minimum + 1
                )
                values = np.linspace(minimum, maximum, step_count).tolist()
                int_values = sorted(set(int(round(v)) for v in values))
                param_ranges[name] = int_values

        return param_ranges

    @staticmethod
    def generate_grid(
        param_ranges: dict[str, list[Any]],
        max_combinations: int = 1000,
    ) -> list[dict[str, Any]]:
        """Generate Cartesian product of parameter combinations.

        Args:
            param_ranges: Dict mapping parameter name -> list of values.
            max_combinations: Safety limit to prevent OOM. If the full grid
                exceeds this, it is truncated with a warning.

        Returns:
            List of parameter dicts, one per combination.

        Raises:
            ValueError: If param_ranges is empty or max_combinations < 1.
        """
        if not param_ranges:
            return []
        if max_combinations < 1:
            raise ValueError("max_combinations must be >= 1")

        names = list(param_ranges.keys())
        value_lists = [param_ranges[n] for n in names]

        # Compute total combinations for safety check
        total = 1
        for vl in value_lists:
            total *= len(vl)

        if total > max_combinations:
            logger.warning(
                "Grid has %d combinations, truncating to max_combinations=%d",
                total,
                max_combinations,
            )

        grid: list[dict[str, Any]] = []
        for combo in itertools.product(*value_lists):
            if len(grid) >= max_combinations:
                break
            grid.append(dict(zip(names, combo)))

        return grid

    def run(
        self,
        strategy_class: Any,
        param_grid: list[dict[str, Any]],
        backtest_config: dict[str, Any] | None = None,
    ) -> list[GridSearchResult]:
        """Run backtests for each parameter combination in the grid.

        Args:
            strategy_class: Strategy class with CONFIG_SCHEMA (used for identification).
            param_grid: List of parameter dicts from generate_grid().
            backtest_config: Additional backtest configuration (instrument, dates, etc.).

        Returns:
            List of GridSearchResult, one per parameter combination.
        """
        if backtest_config is None:
            backtest_config = {}

        results: list[GridSearchResult] = []
        total = len(param_grid)

        for i, params in enumerate(param_grid):
            logger.debug(
                "Grid search %d/%d: %s",
                i + 1,
                total,
                params,
            )
            result = self._run_single_backtest(
                strategy_class, params, backtest_config
            )
            results.append(result)

        logger.info("Grid search complete: %d combinations evaluated", len(results))
        return results

    @staticmethod
    def rank_results(
        results: list[GridSearchResult],
        metric: str = "sharpe_ratio",
        top_n: int = 10,
    ) -> list[GridSearchResult]:
        """Sort results by the given metric and return the top N.

        Args:
            results: List of GridSearchResult to rank.
            metric: One of "sharpe_ratio", "total_return", "max_drawdown".
            top_n: Number of top results to return.

        Returns:
            Sorted list of top_n GridSearchResult.

        Raises:
            ValueError: If metric is not supported.
        """
        if metric not in GridSearchEngine.RANKING_METRICS:
            raise ValueError(
                f"Unsupported metric '{metric}'. "
                f"Choose from: {list(GridSearchEngine.RANKING_METRICS.keys())}"
            )

        higher_is_better = GridSearchEngine.RANKING_METRICS[metric]
        sorted_results = sorted(
            results,
            key=lambda r: getattr(r, metric),
            reverse=higher_is_better,
        )

        return sorted_results[:top_n]

    @staticmethod
    def _run_single_backtest(
        strategy_class: Any,
        params: dict[str, Any],
        backtest_config: dict[str, Any],
    ) -> GridSearchResult:
        """Run a single backtest with given parameters.

        This is a stub that returns simulated results. Actual NautilusTrader
        integration is deferred to a follow-up PR.

        The mock results are deterministic based on parameter values to make
        tests reproducible.
        """
        # Create a deterministic seed from param values
        param_str = str(sorted(params.items()))
        seed = int(hashlib.md5(param_str.encode()).hexdigest()[:8], 16)
        rng = np.random.RandomState(seed)

        # Generate plausible mock metrics
        sharpe = rng.uniform(-0.5, 3.0)
        total_return = rng.uniform(-0.2, 0.8)
        max_drawdown = rng.uniform(0.01, 0.4)
        win_rate = rng.uniform(0.3, 0.7)
        num_trades = rng.randint(10, 500)

        return GridSearchResult(
            params=params,
            sharpe_ratio=round(sharpe, 4),
            total_return=round(total_return, 4),
            max_drawdown=round(max_drawdown, 4),
            win_rate=round(win_rate, 4),
            num_trades=int(num_trades),
        )

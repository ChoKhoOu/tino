"""Statistical anomaly detection engine.

Implements five detection methods using only numpy + scipy:
1. Price anomaly — Z-score with sliding window
2. Volume anomaly — log-normal distribution fitting
3. Funding rate anomaly — historical percentile detection
4. Open interest surge — rate-of-change detection
5. Liquidation cascade warning — clustering detection
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum

import numpy as np
from numpy.typing import NDArray
from scipy import stats

logger = logging.getLogger(__name__)


class AnomalyType(Enum):
    PRICE = "price"
    VOLUME = "volume"
    FUNDING_RATE = "funding_rate"
    OPEN_INTEREST = "open_interest"
    LIQUIDATION_CASCADE = "liquidation_cascade"


class Severity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class AnomalyResult:
    """A single detected anomaly."""

    anomaly_type: AnomalyType
    severity: Severity
    score: float
    threshold: float
    timestamp: float
    value: float
    description: str


@dataclass
class DetectionConfig:
    """Configuration for anomaly detection."""

    zscore_threshold: float = 3.0
    window_size: int = 20
    percentile_threshold: float = 95.0


def _severity_from_score(score: float, threshold: float) -> Severity:
    """Map detection score to severity level."""
    ratio = abs(score) / threshold if threshold > 0 else 0
    if ratio >= 2.0:
        return Severity.CRITICAL
    if ratio >= 1.5:
        return Severity.HIGH
    if ratio >= 1.0:
        return Severity.MEDIUM
    return Severity.LOW


def detect_price_anomaly(
    timestamps: NDArray[np.float64],
    values: NDArray[np.float64],
    config: DetectionConfig | None = None,
) -> list[AnomalyResult]:
    """Detect price anomalies using Z-score with a sliding window.

    For each point, compute the Z-score relative to the preceding window.
    Flag points where |Z-score| > threshold.
    """
    cfg = config or DetectionConfig()
    results: list[AnomalyResult] = []

    if len(values) < cfg.window_size + 1:
        return results

    for i in range(cfg.window_size, len(values)):
        window = values[i - cfg.window_size : i]
        mean = np.mean(window)
        std = np.std(window, ddof=1)

        if std < 1e-12:
            continue

        zscore = (values[i] - mean) / std

        if abs(zscore) > cfg.zscore_threshold:
            severity = _severity_from_score(zscore, cfg.zscore_threshold)
            direction = "spike" if zscore > 0 else "drop"
            results.append(
                AnomalyResult(
                    anomaly_type=AnomalyType.PRICE,
                    severity=severity,
                    score=float(zscore),
                    threshold=cfg.zscore_threshold,
                    timestamp=float(timestamps[i]),
                    value=float(values[i]),
                    description=(
                        f"Price {direction}: Z-score {zscore:.2f} "
                        f"(threshold {cfg.zscore_threshold}), "
                        f"window mean={mean:.4f} std={std:.4f}"
                    ),
                )
            )

    return results


def detect_volume_anomaly(
    timestamps: NDArray[np.float64],
    values: NDArray[np.float64],
    config: DetectionConfig | None = None,
) -> list[AnomalyResult]:
    """Detect volume anomalies using log-normal distribution fitting.

    Fit a log-normal distribution to historical volumes, then flag
    points above the percentile threshold.
    """
    cfg = config or DetectionConfig()
    results: list[AnomalyResult] = []

    positive = values[values > 0]
    if len(positive) < cfg.window_size:
        return results

    log_values = np.log(positive)
    mu = np.mean(log_values)
    sigma = np.std(log_values, ddof=1)

    if sigma < 1e-12:
        return results

    threshold_value = np.exp(
        stats.norm.ppf(cfg.percentile_threshold / 100.0, loc=mu, scale=sigma)
    )

    for i in range(len(values)):
        if values[i] <= 0:
            continue

        if values[i] > threshold_value:
            log_zscore = (np.log(values[i]) - mu) / sigma
            severity = _severity_from_score(log_zscore, cfg.zscore_threshold)
            results.append(
                AnomalyResult(
                    anomaly_type=AnomalyType.VOLUME,
                    severity=severity,
                    score=float(log_zscore),
                    threshold=float(threshold_value),
                    timestamp=float(timestamps[i]),
                    value=float(values[i]),
                    description=(
                        f"Volume spike: {values[i]:.2f} exceeds "
                        f"p{cfg.percentile_threshold:.0f} threshold "
                        f"{threshold_value:.2f} "
                        f"(log Z-score {log_zscore:.2f})"
                    ),
                )
            )

    return results


def detect_funding_rate_anomaly(
    timestamps: NDArray[np.float64],
    values: NDArray[np.float64],
    config: DetectionConfig | None = None,
) -> list[AnomalyResult]:
    """Detect funding rate anomalies using historical percentile.

    Flag funding rates that fall outside the [100-p, p] percentile range.
    """
    cfg = config or DetectionConfig()
    results: list[AnomalyResult] = []

    if len(values) < cfg.window_size:
        return results

    lower_pct = 100.0 - cfg.percentile_threshold
    upper_pct = cfg.percentile_threshold

    lower_bound = float(np.percentile(values, lower_pct))
    upper_bound = float(np.percentile(values, upper_pct))

    median = float(np.median(values))
    iqr = float(np.percentile(values, 75) - np.percentile(values, 25))
    scale = iqr if iqr > 1e-12 else 1.0

    for i in range(len(values)):
        val = float(values[i])
        if val > upper_bound or val < lower_bound:
            score = abs(val - median) / scale
            severity = _severity_from_score(score, cfg.zscore_threshold)
            direction = "extremely high" if val > upper_bound else "extremely low"
            results.append(
                AnomalyResult(
                    anomaly_type=AnomalyType.FUNDING_RATE,
                    severity=severity,
                    score=score,
                    threshold=float(upper_bound if val > upper_bound else lower_bound),
                    timestamp=float(timestamps[i]),
                    value=val,
                    description=(
                        f"Funding rate {direction}: {val:.6f} "
                        f"outside [{lower_bound:.6f}, {upper_bound:.6f}] "
                        f"(p{lower_pct:.0f}-p{upper_pct:.0f} range)"
                    ),
                )
            )

    return results


def detect_open_interest_surge(
    timestamps: NDArray[np.float64],
    values: NDArray[np.float64],
    config: DetectionConfig | None = None,
) -> list[AnomalyResult]:
    """Detect open interest surges using rate-of-change detection.

    Compute percentage change, then flag points where the rate of change
    exceeds the Z-score threshold relative to historical changes.
    """
    cfg = config or DetectionConfig()
    results: list[AnomalyResult] = []

    if len(values) < cfg.window_size + 2:
        return results

    # Compute percentage changes
    pct_changes = np.diff(values) / np.where(values[:-1] != 0, values[:-1], 1.0) * 100.0

    mean_change = np.mean(pct_changes)
    std_change = np.std(pct_changes, ddof=1)

    if std_change < 1e-12:
        return results

    for i in range(len(pct_changes)):
        zscore = (pct_changes[i] - mean_change) / std_change

        if abs(zscore) > cfg.zscore_threshold:
            severity = _severity_from_score(zscore, cfg.zscore_threshold)
            direction = "surge" if pct_changes[i] > 0 else "plunge"
            results.append(
                AnomalyResult(
                    anomaly_type=AnomalyType.OPEN_INTEREST,
                    severity=severity,
                    score=float(zscore),
                    threshold=cfg.zscore_threshold,
                    timestamp=float(timestamps[i + 1]),
                    value=float(values[i + 1]),
                    description=(
                        f"Open interest {direction}: "
                        f"{pct_changes[i]:.2f}% change, "
                        f"Z-score {zscore:.2f} "
                        f"(mean change {mean_change:.2f}%, "
                        f"std {std_change:.2f}%)"
                    ),
                )
            )

    return results


def detect_liquidation_cascade(
    timestamps: NDArray[np.float64],
    values: NDArray[np.float64],
    config: DetectionConfig | None = None,
) -> list[AnomalyResult]:
    """Detect liquidation cascade warnings using clustering.

    Identify abnormal clustering of liquidation events by analyzing
    the density of liquidation values in time windows.
    Uses median absolute deviation (MAD) for robustness against outlier clusters.
    """
    cfg = config or DetectionConfig()
    results: list[AnomalyResult] = []

    if len(values) < cfg.window_size:
        return results

    # Compute rolling sum of liquidation values
    window = cfg.window_size
    rolling_sums = np.convolve(values, np.ones(window), mode="valid")

    # Use MAD (Median Absolute Deviation) for robust outlier detection
    median_sum = float(np.median(rolling_sums))
    mad = float(np.median(np.abs(rolling_sums - median_sum)))

    if mad < 1e-12:
        return results

    # MAD-based z-score (scaled by 0.6745 to be comparable to std dev)
    mad_scale = mad / 0.6745

    for i in range(len(rolling_sums)):
        modified_zscore = (rolling_sums[i] - median_sum) / mad_scale

        if modified_zscore > cfg.zscore_threshold:
            severity = _severity_from_score(modified_zscore, cfg.zscore_threshold)
            # Use the timestamp at the end of the window
            ts_idx = i + window - 1
            results.append(
                AnomalyResult(
                    anomaly_type=AnomalyType.LIQUIDATION_CASCADE,
                    severity=severity,
                    score=float(modified_zscore),
                    threshold=cfg.zscore_threshold,
                    timestamp=float(timestamps[ts_idx]),
                    value=float(rolling_sums[i]),
                    description=(
                        f"Liquidation cascade warning: "
                        f"rolling {window}-period sum {rolling_sums[i]:.2f} "
                        f"(modified Z-score {modified_zscore:.2f}, "
                        f"median {median_sum:.2f}, MAD {mad:.2f})"
                    ),
                )
            )

    return results


@dataclass
class DetectionReport:
    """Aggregated detection results."""

    anomalies: list[AnomalyResult] = field(default_factory=list)
    total_points_analyzed: int = 0
    summary: str = ""


def run_detection(
    *,
    types: list[AnomalyType] | None = None,
    prices: tuple[NDArray[np.float64], NDArray[np.float64]] | None = None,
    volumes: tuple[NDArray[np.float64], NDArray[np.float64]] | None = None,
    funding_rates: tuple[NDArray[np.float64], NDArray[np.float64]] | None = None,
    open_interests: tuple[NDArray[np.float64], NDArray[np.float64]] | None = None,
    liquidations: tuple[NDArray[np.float64], NDArray[np.float64]] | None = None,
    config: DetectionConfig | None = None,
) -> DetectionReport:
    """Run anomaly detection across all requested types.

    Each data argument is a tuple of (timestamps, values) arrays.
    If types is None or empty, all available detectors are run.
    """
    cfg = config or DetectionConfig()
    run_all = not types

    all_anomalies: list[AnomalyResult] = []
    total_points = 0

    if prices is not None and (run_all or AnomalyType.PRICE in types):
        ts, vals = prices
        total_points += len(vals)
        all_anomalies.extend(detect_price_anomaly(ts, vals, cfg))

    if volumes is not None and (run_all or AnomalyType.VOLUME in types):
        ts, vals = volumes
        total_points += len(vals)
        all_anomalies.extend(detect_volume_anomaly(ts, vals, cfg))

    if funding_rates is not None and (
        run_all or AnomalyType.FUNDING_RATE in types
    ):
        ts, vals = funding_rates
        total_points += len(vals)
        all_anomalies.extend(detect_funding_rate_anomaly(ts, vals, cfg))

    if open_interests is not None and (
        run_all or AnomalyType.OPEN_INTEREST in types
    ):
        ts, vals = open_interests
        total_points += len(vals)
        all_anomalies.extend(detect_open_interest_surge(ts, vals, cfg))

    if liquidations is not None and (
        run_all or AnomalyType.LIQUIDATION_CASCADE in types
    ):
        ts, vals = liquidations
        total_points += len(vals)
        all_anomalies.extend(detect_liquidation_cascade(ts, vals, cfg))

    # Sort by timestamp
    all_anomalies.sort(key=lambda a: a.timestamp)

    # Build summary
    by_type: dict[AnomalyType, int] = {}
    for a in all_anomalies:
        by_type[a.anomaly_type] = by_type.get(a.anomaly_type, 0) + 1

    if all_anomalies:
        parts = [f"{t.value}: {c}" for t, c in sorted(by_type.items(), key=lambda x: x[0].value)]
        summary = (
            f"Detected {len(all_anomalies)} anomalies across "
            f"{total_points} data points. Breakdown: {', '.join(parts)}"
        )
    else:
        summary = f"No anomalies detected across {total_points} data points."

    return DetectionReport(
        anomalies=all_anomalies,
        total_points_analyzed=total_points,
        summary=summary,
    )

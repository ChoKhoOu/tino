"""Tests for the anomaly detection engine."""

from __future__ import annotations

import numpy as np
import pytest

from tino_daemon.analytics.anomaly import (
    AnomalyType,
    DetectionConfig,
    Severity,
    detect_funding_rate_anomaly,
    detect_liquidation_cascade,
    detect_open_interest_surge,
    detect_price_anomaly,
    detect_volume_anomaly,
    run_detection,
)


@pytest.fixture
def timestamps() -> np.ndarray:
    """Generate 100 sequential timestamps."""
    return np.arange(100, dtype=np.float64)


@pytest.fixture
def normal_prices(timestamps: np.ndarray) -> np.ndarray:
    """Normal price data with a single spike at index 50."""
    rng = np.random.default_rng(42)
    prices = 100.0 + rng.normal(0, 1, size=len(timestamps))
    # Inject a clear anomaly at index 50
    prices[50] = 100.0 + 10.0  # 10 std devs away
    return prices


@pytest.fixture
def normal_volumes(timestamps: np.ndarray) -> np.ndarray:
    """Normal volume data with a spike at index 60."""
    rng = np.random.default_rng(42)
    # Log-normal volumes centered around 1000
    volumes = rng.lognormal(mean=np.log(1000), sigma=0.3, size=len(timestamps))
    # Inject extreme volume at index 60
    volumes[60] = 50000.0  # way above normal
    return volumes


class TestPriceAnomaly:
    def test_detects_price_spike(
        self, timestamps: np.ndarray, normal_prices: np.ndarray
    ) -> None:
        results = detect_price_anomaly(timestamps, normal_prices)
        assert len(results) > 0
        # The spike at index 50 should be detected
        spike_results = [r for r in results if r.timestamp == 50.0]
        assert len(spike_results) == 1
        assert spike_results[0].anomaly_type == AnomalyType.PRICE
        assert spike_results[0].score > 3.0

    def test_no_anomaly_in_flat_data(self, timestamps: np.ndarray) -> None:
        flat = np.full(len(timestamps), 100.0)
        results = detect_price_anomaly(timestamps, flat)
        assert len(results) == 0

    def test_insufficient_data_returns_empty(self) -> None:
        ts = np.array([1.0, 2.0, 3.0])
        vals = np.array([100.0, 101.0, 102.0])
        results = detect_price_anomaly(ts, vals)
        assert len(results) == 0

    def test_custom_threshold(
        self, timestamps: np.ndarray, normal_prices: np.ndarray
    ) -> None:
        # With a very high threshold, fewer anomalies should be detected
        config = DetectionConfig(zscore_threshold=8.0)
        results = detect_price_anomaly(timestamps, normal_prices, config)
        strict_count = len(results)

        config_loose = DetectionConfig(zscore_threshold=2.0)
        results_loose = detect_price_anomaly(timestamps, normal_prices, config_loose)
        assert len(results_loose) >= strict_count

    def test_severity_mapping(
        self, timestamps: np.ndarray, normal_prices: np.ndarray
    ) -> None:
        results = detect_price_anomaly(timestamps, normal_prices)
        for r in results:
            assert r.severity in (
                Severity.LOW,
                Severity.MEDIUM,
                Severity.HIGH,
                Severity.CRITICAL,
            )


class TestVolumeAnomaly:
    def test_detects_volume_spike(
        self, timestamps: np.ndarray, normal_volumes: np.ndarray
    ) -> None:
        results = detect_volume_anomaly(timestamps, normal_volumes)
        assert len(results) > 0
        # The spike at index 60 should be detected
        spike_results = [r for r in results if r.timestamp == 60.0]
        assert len(spike_results) == 1
        assert spike_results[0].anomaly_type == AnomalyType.VOLUME

    def test_no_anomaly_in_uniform_data(self, timestamps: np.ndarray) -> None:
        uniform = np.full(len(timestamps), 1000.0)
        results = detect_volume_anomaly(timestamps, uniform)
        assert len(results) == 0

    def test_handles_zero_volumes(self, timestamps: np.ndarray) -> None:
        volumes = np.zeros(len(timestamps))
        results = detect_volume_anomaly(timestamps, volumes)
        assert len(results) == 0


class TestFundingRateAnomaly:
    def test_detects_extreme_funding(self, timestamps: np.ndarray) -> None:
        rng = np.random.default_rng(42)
        rates = rng.normal(0.0001, 0.00005, size=len(timestamps))
        # Inject extreme funding rate
        rates[70] = 0.005  # 100x normal
        results = detect_funding_rate_anomaly(timestamps, rates)
        assert len(results) > 0
        extreme = [r for r in results if r.timestamp == 70.0]
        assert len(extreme) == 1
        assert extreme[0].anomaly_type == AnomalyType.FUNDING_RATE

    def test_detects_negative_extreme(self, timestamps: np.ndarray) -> None:
        rng = np.random.default_rng(42)
        rates = rng.normal(0.0001, 0.00005, size=len(timestamps))
        rates[70] = -0.005  # extreme negative
        results = detect_funding_rate_anomaly(timestamps, rates)
        extreme = [r for r in results if r.timestamp == 70.0]
        assert len(extreme) == 1

    def test_insufficient_data(self) -> None:
        ts = np.array([1.0, 2.0])
        vals = np.array([0.0001, 0.0002])
        results = detect_funding_rate_anomaly(ts, vals)
        assert len(results) == 0


class TestOpenInterestSurge:
    def test_detects_surge(self, timestamps: np.ndarray) -> None:
        rng = np.random.default_rng(42)
        oi = 10000.0 + np.cumsum(rng.normal(0, 50, size=len(timestamps)))
        # Inject a sudden surge at index 60
        oi[60] = oi[59] + 5000  # massive jump
        results = detect_open_interest_surge(timestamps, oi)
        assert len(results) > 0
        surge = [r for r in results if r.timestamp == 60.0]
        assert len(surge) == 1
        assert surge[0].anomaly_type == AnomalyType.OPEN_INTEREST

    def test_stable_oi_no_anomaly(self, timestamps: np.ndarray) -> None:
        oi = np.linspace(10000, 10100, len(timestamps))
        results = detect_open_interest_surge(timestamps, oi)
        assert len(results) == 0


class TestLiquidationCascade:
    def test_detects_cascade(self, timestamps: np.ndarray) -> None:
        rng = np.random.default_rng(42)
        liqs = rng.exponential(scale=10.0, size=len(timestamps))
        # Inject cascade: massive liquidations over a full window to ensure rolling sum spikes
        liqs[50:70] = 5000.0  # abnormal cluster over 20 periods
        config = DetectionConfig(window_size=10)
        results = detect_liquidation_cascade(timestamps, liqs, config)
        assert len(results) > 0
        cascade = [r for r in results if r.anomaly_type == AnomalyType.LIQUIDATION_CASCADE]
        assert len(cascade) > 0

    def test_normal_liquidations_no_cascade(self, timestamps: np.ndarray) -> None:
        liqs = np.full(len(timestamps), 10.0)
        results = detect_liquidation_cascade(timestamps, liqs)
        assert len(results) == 0


class TestRunDetection:
    def test_run_all_detectors(
        self,
        timestamps: np.ndarray,
        normal_prices: np.ndarray,
        normal_volumes: np.ndarray,
    ) -> None:
        rng = np.random.default_rng(42)
        funding = rng.normal(0.0001, 0.00005, size=len(timestamps))
        funding[70] = 0.005
        oi = 10000.0 + np.cumsum(rng.normal(0, 50, size=len(timestamps)))
        oi[60] = oi[59] + 5000
        liqs = rng.exponential(scale=10.0, size=len(timestamps))
        liqs[50:55] = 500.0

        report = run_detection(
            prices=(timestamps, normal_prices),
            volumes=(timestamps, normal_volumes),
            funding_rates=(timestamps, funding),
            open_interests=(timestamps, oi),
            liquidations=(timestamps, liqs),
        )

        assert report.total_points_analyzed == 500  # 100 * 5
        assert len(report.anomalies) > 0
        assert report.summary != ""

        # Check all anomaly types present
        types_found = {a.anomaly_type for a in report.anomalies}
        assert AnomalyType.PRICE in types_found
        assert AnomalyType.VOLUME in types_found

    def test_run_specific_types(
        self,
        timestamps: np.ndarray,
        normal_prices: np.ndarray,
        normal_volumes: np.ndarray,
    ) -> None:
        report = run_detection(
            types=[AnomalyType.PRICE],
            prices=(timestamps, normal_prices),
            volumes=(timestamps, normal_volumes),
        )
        # Only price anomalies should be present
        for a in report.anomalies:
            assert a.anomaly_type == AnomalyType.PRICE

    def test_run_no_data(self) -> None:
        report = run_detection()
        assert report.total_points_analyzed == 0
        assert len(report.anomalies) == 0
        assert "No anomalies" in report.summary

    def test_anomalies_sorted_by_timestamp(
        self,
        timestamps: np.ndarray,
        normal_prices: np.ndarray,
        normal_volumes: np.ndarray,
    ) -> None:
        report = run_detection(
            prices=(timestamps, normal_prices),
            volumes=(timestamps, normal_volumes),
        )
        if len(report.anomalies) > 1:
            for i in range(len(report.anomalies) - 1):
                assert report.anomalies[i].timestamp <= report.anomalies[i + 1].timestamp

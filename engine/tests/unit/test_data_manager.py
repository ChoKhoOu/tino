"""Unit tests for market data manager."""

import json
from pathlib import Path

import pytest

from src.core.data_manager import MarketDataManager


class TestMarketDataManager:
    @pytest.fixture
    def data_dir(self, tmp_path):
        return tmp_path / "data"

    @pytest.fixture
    def manager(self, data_dir):
        return MarketDataManager(data_dir=data_dir)

    def test_check_cache_returns_none_for_empty(self, manager):
        result = manager.check_cache("BTCUSDT", "1-HOUR", "2025-01-01", "2025-12-31")
        assert result is None

    def test_detect_gaps_returns_full_range_when_empty(self, manager):
        gaps = manager.detect_gaps("BTCUSDT", "1-HOUR", "2025-01-01", "2025-12-31")
        assert len(gaps) == 1
        assert gaps[0]["start"] == "2025-01-01"
        assert gaps[0]["end"] == "2025-12-31"

    def test_cache_index_persistence(self, data_dir, manager):
        """Cache index should persist and reload."""
        # Manually add a cache entry
        manager._cache_index["BTCUSDT_1-HOUR"] = {
            "trading_pair": "BTCUSDT",
            "bar_type": "1-HOUR",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "record_count": 8760,
            "file_path": str(data_dir / "BTCUSDT_1-HOUR.json"),
            "content_hash": "abc123",
            "fetched_at": "2026-01-01T00:00:00Z",
        }
        manager._save_cache_index()

        # Create new manager, should load existing index
        manager2 = MarketDataManager(data_dir=data_dir)
        result = manager2.check_cache("BTCUSDT", "1-HOUR", "2025-01-01", "2025-12-31")
        assert result is not None
        assert result["record_count"] == 8760

    def test_cache_hit_when_range_covered(self, manager):
        """Cache hit when requested range is within cached range."""
        manager._cache_index["BTCUSDT_1-HOUR"] = {
            "trading_pair": "BTCUSDT",
            "bar_type": "1-HOUR",
            "start_date": "2024-01-01",
            "end_date": "2026-01-01",
            "record_count": 17520,
        }

        result = manager.check_cache("BTCUSDT", "1-HOUR", "2025-01-01", "2025-12-31")
        assert result is not None

    def test_cache_miss_when_range_not_covered(self, manager):
        """Cache miss when requested range extends beyond cached."""
        manager._cache_index["BTCUSDT_1-HOUR"] = {
            "trading_pair": "BTCUSDT",
            "bar_type": "1-HOUR",
            "start_date": "2025-06-01",
            "end_date": "2025-12-31",
            "record_count": 4380,
        }

        result = manager.check_cache("BTCUSDT", "1-HOUR", "2025-01-01", "2025-12-31")
        assert result is None

    def test_get_cache_status(self, manager):
        manager._cache_index["BTCUSDT_1-HOUR"] = {
            "trading_pair": "BTCUSDT",
            "bar_type": "1-HOUR",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "record_count": 8760,
        }

        status = manager.get_cache_status()
        assert len(status) == 1
        assert status[0]["trading_pair"] == "BTCUSDT"
        assert status[0]["record_count"] == 8760

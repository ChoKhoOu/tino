"""Unit tests for strategy file manager."""

import tempfile
from pathlib import Path

import pytest

from src.core.strategy_loader import StrategyLoader, compute_version_hash
from src.schemas.strategy import StrategyCreate


class TestComputeVersionHash:
    """Tests for SHA-256 content hashing."""

    def test_returns_sha256_prefixed_hash(self):
        result = compute_version_hash("some source code")
        assert result.startswith("sha256:")
        assert len(result) == 71  # "sha256:" (7) + 64 hex chars

    def test_same_content_same_hash(self):
        code = "class MyStrategy: pass"
        assert compute_version_hash(code) == compute_version_hash(code)

    def test_different_content_different_hash(self):
        assert compute_version_hash("code_a") != compute_version_hash("code_b")

    def test_whitespace_sensitive(self):
        assert compute_version_hash("code ") != compute_version_hash("code")


class TestStrategyLoader:
    """Tests for strategy persistence."""

    @pytest.fixture
    def loader(self, tmp_path):
        return StrategyLoader(strategies_dir=tmp_path / "strategies")

    @pytest.fixture
    def sample_strategy(self):
        return StrategyCreate(
            name="Test Strategy",
            description="A test strategy",
            source_code="class TestStrategy:\n    pass\n",
            parameters={"period": 20},
        )

    def test_save_strategy_returns_response(self, loader, sample_strategy):
        result = loader.save_strategy(sample_strategy)
        assert result.name == "Test Strategy"
        assert result.version_hash.startswith("sha256:")
        assert result.source_code == sample_strategy.source_code

    def test_save_creates_file_on_disk(self, loader, sample_strategy):
        result = loader.save_strategy(sample_strategy)
        assert loader.strategy_exists(result.version_hash)

    def test_load_by_hash_returns_saved_strategy(self, loader, sample_strategy):
        saved = loader.save_strategy(sample_strategy)
        loaded = loader.load_by_hash(saved.version_hash)
        assert loaded is not None
        assert loaded.source_code == sample_strategy.source_code
        assert loaded.name == sample_strategy.name
        assert loaded.parameters == sample_strategy.parameters

    def test_load_nonexistent_returns_none(self, loader):
        result = loader.load_by_hash("sha256:" + "0" * 64)
        assert result is None

    def test_list_strategies_returns_saved(self, loader, sample_strategy):
        loader.save_strategy(sample_strategy)
        strategies = loader.list_strategies()
        assert len(strategies) >= 1
        assert strategies[0]["name"] == "Test Strategy"

    def test_idempotent_save(self, loader, sample_strategy):
        """Saving same content twice should not fail."""
        result1 = loader.save_strategy(sample_strategy)
        result2 = loader.save_strategy(sample_strategy)
        assert result1.version_hash == result2.version_hash

    def test_save_with_session_id(self, loader, sample_strategy):
        result = loader.save_strategy(sample_strategy, session_id="test-session")
        assert result.created_by_session == "test-session"

    def test_save_with_parent_hash(self, loader, sample_strategy):
        parent = loader.save_strategy(sample_strategy)
        child_data = StrategyCreate(
            name="Modified Strategy",
            source_code="class Modified:\n    pass\n",
        )
        child = loader.save_strategy(
            child_data, parent_hash=parent.version_hash
        )
        assert child.parent_version_hash == parent.version_hash

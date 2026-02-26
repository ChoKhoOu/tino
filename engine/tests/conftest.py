"""Shared test fixtures for engine tests."""

import os
import tempfile

import pytest

from src.core.database import init_db, close_db


@pytest.fixture(autouse=True)
async def setup_test_db(tmp_path):
    """Initialize a temporary test database for each test."""
    db_path = str(tmp_path / "test.db")
    await init_db(db_path)
    yield
    await close_db()

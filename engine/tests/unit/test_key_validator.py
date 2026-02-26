"""Unit tests for API key permission validator."""

import pytest
from src.risk.key_validator import validate_key_or_skip


@pytest.mark.asyncio
async def test_skip_when_no_key():
    result = await validate_key_or_skip(None, None)
    assert result is None

@pytest.mark.asyncio
async def test_skip_when_empty_key():
    result = await validate_key_or_skip("", "")
    assert result is None

"""Integration test: Backtest API endpoints."""

import asyncio
import json

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def test_strategy(client):
    """Create a test strategy and return its version_hash."""
    response = await client.post(
        "/api/strategies",
        json={
            "name": "Backtest Test Strategy",
            "source_code": "class BacktestTestStrategy: pass",
            "parameters": {"period": 20},
        },
    )
    assert response.status_code == 201
    return response.json()["version_hash"]


@pytest.mark.asyncio
async def test_submit_backtest(client, test_strategy):
    """POST /api/backtest returns 202 with job ID."""
    response = await client.post(
        "/api/backtest",
        json={
            "strategy_version_hash": test_strategy,
            "trading_pair": "BTCUSDT",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "bar_type": "1-HOUR",
        },
    )
    assert response.status_code == 202
    data = response.json()
    assert "id" in data
    assert data["status"] == "PENDING"
    assert data["ws_url"].startswith("/ws/backtest/")


@pytest.mark.asyncio
async def test_submit_backtest_unknown_strategy(client):
    """POST /api/backtest with unknown strategy returns 404."""
    response = await client.post(
        "/api/backtest",
        json={
            "strategy_version_hash": "sha256:" + "0" * 64,
            "trading_pair": "BTCUSDT",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
        },
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_backtest(client, test_strategy):
    """GET /api/backtest/{id} returns backtest details."""
    # Submit
    submit_resp = await client.post(
        "/api/backtest",
        json={
            "strategy_version_hash": test_strategy,
            "trading_pair": "BTCUSDT",
            "start_date": "2025-01-01",
            "end_date": "2025-06-30",
        },
    )
    backtest_id = submit_resp.json()["id"]

    # Wait briefly for background task
    await asyncio.sleep(0.5)

    # Retrieve
    get_resp = await client.get(f"/api/backtest/{backtest_id}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["id"] == backtest_id
    assert data["strategy_version_hash"] == test_strategy
    assert data["trading_pair"] == "BTCUSDT"


@pytest.mark.asyncio
async def test_list_backtests(client, test_strategy):
    """GET /api/backtest returns list."""
    # Submit a backtest
    await client.post(
        "/api/backtest",
        json={
            "strategy_version_hash": test_strategy,
            "trading_pair": "BTCUSDT",
            "start_date": "2025-01-01",
            "end_date": "2025-03-31",
        },
    )

    response = await client.get("/api/backtest")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1

"""Integration test: multi-session concurrent backtests."""

import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_concurrent_backtests(client):
    """Two concurrent backtest submissions should both complete."""
    # Create strategy
    strat = await client.post("/api/strategies", json={
        "name": "Multi Session Strategy",
        "source_code": "class MultiSession: pass",
        "parameters": {},
    })
    version_hash = strat.json()["version_hash"]

    # Submit two backtests concurrently
    resp1 = await client.post("/api/backtest", json={
        "strategy_version_hash": version_hash,
        "trading_pair": "BTCUSDT",
        "start_date": "2025-01-01",
        "end_date": "2025-06-30",
    })
    resp2 = await client.post("/api/backtest", json={
        "strategy_version_hash": version_hash,
        "trading_pair": "ETHUSDT",
        "start_date": "2025-01-01",
        "end_date": "2025-06-30",
    })

    assert resp1.status_code == 202
    assert resp2.status_code == 202

    # Both should have different IDs
    id1 = resp1.json()["id"]
    id2 = resp2.json()["id"]
    assert id1 != id2

    # Both should appear in list
    await asyncio.sleep(0.5)
    list_resp = await client.get("/api/backtest")
    data = list_resp.json()
    assert data["total"] >= 2

    ids = [item["id"] for item in data["items"]]
    assert id1 in ids
    assert id2 in ids

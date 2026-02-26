"""Integration test: Live session lifecycle."""

import pytest
from httpx import ASGITransport, AsyncClient
from src.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def strategy_with_backtest(client):
    """Create a strategy and run a backtest (required for live deployment)."""
    import asyncio
    strat = await client.post("/api/strategies", json={
        "name": "Live Test Strategy",
        "source_code": "class LiveTest: pass",
        "parameters": {},
    })
    version_hash = strat.json()["version_hash"]

    bt = await client.post("/api/backtest", json={
        "strategy_version_hash": version_hash,
        "trading_pair": "BTCUSDT",
        "start_date": "2025-01-01",
        "end_date": "2025-06-30",
    })
    backtest_id = bt.json()["id"]
    await asyncio.sleep(1)  # Wait for backtest to complete

    return version_hash


@pytest.mark.asyncio
async def test_deploy_requires_backtest(client):
    """Deploy without backtest should fail."""
    strat = await client.post("/api/strategies", json={
        "name": "No Backtest Strategy",
        "source_code": "class NoBacktest: pass",
        "parameters": {},
    })
    version_hash = strat.json()["version_hash"]

    # Get default risk profile
    import aiosqlite
    db = await aiosqlite.connect("data/tino.db")
    db.row_factory = aiosqlite.Row
    cursor = await db.execute("SELECT id FROM risk_profiles LIMIT 1")
    row = await cursor.fetchone()
    risk_id = row["id"] if row else "00000000-0000-0000-0000-000000000000"
    await db.close()

    resp = await client.post("/api/live/deploy", json={
        "strategy_version_hash": version_hash,
        "trading_pair": "BTCUSDT",
        "risk_profile_id": risk_id,
        "confirmed_by_session": "test-session",
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_kill_switch(client):
    """Kill switch should return success even with no sessions."""
    resp = await client.post("/api/kill-switch")
    assert resp.status_code == 200
    data = resp.json()
    assert "killed_sessions" in data
    assert "executed_at" in data


@pytest.mark.asyncio
async def test_list_live_sessions(client):
    resp = await client.get("/api/live")
    assert resp.status_code == 200

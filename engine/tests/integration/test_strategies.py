"""Integration test: Strategy CRUD via REST API."""

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
async def client():
    """Create async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


SAMPLE_STRATEGY = {
    "name": "Test EMA Strategy",
    "description": "Simple EMA crossover for testing",
    "source_code": (
        "from nautilus_trader.trading.strategy import Strategy\n"
        "class TestStrategy(Strategy):\n"
        "    pass\n"
    ),
    "parameters": {"fast_period": 10, "slow_period": 20},
}


@pytest.mark.asyncio
async def test_create_strategy(client):
    """POST /api/strategies creates a new strategy."""
    response = await client.post("/api/strategies", json=SAMPLE_STRATEGY)
    assert response.status_code == 201

    data = response.json()
    assert "id" in data
    assert data["version_hash"].startswith("sha256:")
    assert data["name"] == "Test EMA Strategy"
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_strategy_idempotent(client):
    """POST same strategy twice returns same hash."""
    resp1 = await client.post("/api/strategies", json=SAMPLE_STRATEGY)
    resp2 = await client.post("/api/strategies", json=SAMPLE_STRATEGY)
    assert resp1.json()["version_hash"] == resp2.json()["version_hash"]


@pytest.mark.asyncio
async def test_list_strategies(client):
    """GET /api/strategies returns list."""
    # Create a strategy first
    await client.post("/api/strategies", json=SAMPLE_STRATEGY)

    response = await client.get("/api/strategies")
    assert response.status_code == 200

    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1
    assert len(data["items"]) >= 1

    item = data["items"][0]
    assert "version_hash" in item
    assert "name" in item
    assert "backtest_count" in item


@pytest.mark.asyncio
async def test_get_strategy_by_hash(client):
    """GET /api/strategies/{hash} returns full strategy."""
    create_resp = await client.post("/api/strategies", json=SAMPLE_STRATEGY)
    version_hash = create_resp.json()["version_hash"]

    response = await client.get(f"/api/strategies/{version_hash}")
    assert response.status_code == 200

    data = response.json()
    assert data["version_hash"] == version_hash
    assert data["name"] == "Test EMA Strategy"
    assert "source_code" in data
    assert "parameters" in data


@pytest.mark.asyncio
async def test_get_nonexistent_strategy(client):
    """GET /api/strategies/{hash} returns 404 for missing."""
    response = await client.get("/api/strategies/sha256:" + "0" * 64)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_strategy_round_trip(client):
    """POST + GET roundtrip preserves all data."""
    create_resp = await client.post("/api/strategies", json=SAMPLE_STRATEGY)
    version_hash = create_resp.json()["version_hash"]

    get_resp = await client.get(f"/api/strategies/{version_hash}")
    data = get_resp.json()

    assert data["name"] == SAMPLE_STRATEGY["name"]
    assert data["description"] == SAMPLE_STRATEGY["description"]
    assert data["parameters"] == SAMPLE_STRATEGY["parameters"]

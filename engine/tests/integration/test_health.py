"""Integration test: FastAPI health endpoint."""

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
async def client():
    """Create async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health_endpoint_returns_200(client):
    """GET /api/health returns 200 with valid structure."""
    response = await client.get("/api/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert "engine_version" in data
    assert "nautilus_version" in data
    assert isinstance(data["active_live_sessions"], int)
    assert isinstance(data["running_backtests"], int)


@pytest.mark.asyncio
async def test_health_endpoint_has_cors_headers(client):
    """Health endpoint includes CORS headers."""
    response = await client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    # CORS preflight should succeed
    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers

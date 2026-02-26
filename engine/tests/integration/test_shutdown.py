"""Integration tests for the /api/shutdown endpoint."""

import os
import signal

import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import patch

from src.main import app


@pytest.fixture
async def client():
    """Create async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_shutdown_returns_shutting_down(client):
    """POST /api/shutdown returns {"status": "shutting_down"} and calls os.kill."""
    with patch("src.main.ENGINE_TOKEN", "testtoken123"), \
         patch("src.main.os.kill") as mock_kill:
        response = await client.post(
            "/api/shutdown",
            headers={"Authorization": "Bearer testtoken123"},
        )
        assert response.status_code == 200
        assert response.json() == {"status": "shutting_down"}
        mock_kill.assert_called_once()
        # Verify it sends SIGTERM to own PID
        mock_kill.assert_called_with(os.getpid(), signal.SIGTERM)


@pytest.mark.asyncio
async def test_shutdown_with_valid_token(client):
    """POST /api/shutdown with correct token succeeds."""
    with patch("src.main.ENGINE_TOKEN", "testtoken123"), \
         patch("src.main.os.kill"):
        response = await client.post(
            "/api/shutdown",
            headers={"Authorization": "Bearer testtoken123"},
        )
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_shutdown_with_invalid_token(client):
    """POST /api/shutdown with wrong token returns 403."""
    with patch("src.main.ENGINE_TOKEN", "testtoken123"):
        response = await client.post(
            "/api/shutdown",
            headers={"Authorization": "Bearer wrongtoken"},
        )
        assert response.status_code == 403


@pytest.mark.asyncio
async def test_shutdown_without_token_when_required(client):
    """POST /api/shutdown without token when ENGINE_TOKEN is set returns 403."""
    with patch("src.main.ENGINE_TOKEN", "testtoken123"):
        response = await client.post("/api/shutdown")
        assert response.status_code == 403


@pytest.mark.asyncio
async def test_shutdown_disabled_when_no_engine_token(client):
    """POST /api/shutdown returns 503 when ENGINE_TOKEN is not configured."""
    with patch("src.main.ENGINE_TOKEN", ""):
        response = await client.post("/api/shutdown")
        assert response.status_code == 503
        assert response.json()["detail"] == "Shutdown endpoint disabled: no engine token configured"

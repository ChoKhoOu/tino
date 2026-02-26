"""Integration tests for TINO_DASHBOARD_DIST static file serving."""

import importlib
import os
import tempfile

import pytest
from httpx import ASGITransport, AsyncClient
from pathlib import Path
from unittest.mock import patch


@pytest.fixture
def dashboard_dir():
    """Create a temporary dashboard dist directory with index.html."""
    with tempfile.TemporaryDirectory() as tmpdir:
        index = Path(tmpdir) / "index.html"
        index.write_text("<!DOCTYPE html><html><body>Dashboard</body></html>")
        assets = Path(tmpdir) / "assets"
        assets.mkdir()
        (assets / "app.js").write_text("console.log('app');")
        yield tmpdir


@pytest.mark.asyncio
async def test_dashboard_served_when_env_set(dashboard_dir):
    """Engine serves dashboard static files when TINO_DASHBOARD_DIST is set."""
    with patch.dict(os.environ, {"TINO_DASHBOARD_DIST": dashboard_dir}):
        import src.main as main_module
        importlib.reload(main_module)

        transport = ASGITransport(app=main_module.app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/")
            assert response.status_code == 200
            assert "Dashboard" in response.text


@pytest.mark.asyncio
async def test_api_routes_take_priority(dashboard_dir):
    """API routes should take priority over static files."""
    with patch.dict(os.environ, {"TINO_DASHBOARD_DIST": dashboard_dir}):
        import src.main as main_module
        importlib.reload(main_module)

        transport = ASGITransport(app=main_module.app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert "engine_version" in data

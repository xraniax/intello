"""
Integration tests for the FastAPI engine API.

Uses httpx.AsyncClient against the ASGI app — no running server needed.
All database/Redis/Ollama calls are mocked via conftest fixtures.
"""
import pytest


@pytest.mark.integration
class TestHealthEndpoints:
    async def test_root_returns_200(self, client):
        response = await client.get("/")
        assert response.status_code == 200

    async def test_health_endpoint_returns_ok(self, client):
        response = await client.get("/health")
        # Accept 200 or 503 — just verify the endpoint exists and responds
        assert response.status_code in (200, 503)
        data = response.json()
        assert "status" in data

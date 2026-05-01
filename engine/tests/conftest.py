"""
Shared pytest fixtures for the engine test suite.

Design principles:
- All external I/O (DB, Redis, Ollama, OpenAI) is mocked by default.
- Tests that need a real service must opt-in explicitly with marks.
- The FastAPI app is testable via httpx.AsyncClient at ASGI level — no server required.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport


# ─── FastAPI test client ───────────────────────────────────────────────────────

@pytest.fixture
def app():
    """Return the FastAPI app with all heavy startup side-effects mocked."""
    with (
        patch("services.redis_client._get_client", new_callable=MagicMock),
    ):
        from main import app as _app
        yield _app


@pytest.fixture
async def client(app):
    """Async ASGI test client — no running server needed."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


# ─── Database mock ────────────────────────────────────────────────────────────

@pytest.fixture
def mock_db():
    """Patch the database session factory used inside endpoints/services."""
    mock_session = MagicMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)
    mock_session.execute = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    mock_session.add = MagicMock()
    with patch("services._route_utils.get_db", return_value=mock_session):
        yield mock_session


# ─── Redis mock ───────────────────────────────────────────────────────────────

@pytest.fixture
def mock_redis():
    """Patch the Redis client used for caching."""
    mock = MagicMock()
    mock.get = MagicMock(return_value=None)
    mock.set = MagicMock(return_value=True)
    mock.delete = MagicMock(return_value=1)
    mock.exists = MagicMock(return_value=0)
    mock.hgetall = MagicMock(return_value={})
    mock.hset = MagicMock(return_value=1)
    mock.expire = MagicMock(return_value=True)
    with patch("services.redis_client._get_client", return_value=mock):
        yield mock


# ─── Ollama embedding mock ────────────────────────────────────────────────────

@pytest.fixture
def mock_embeddings():
    """Return a fixed 4-dim embedding vector so tests are deterministic."""
    fake_vector = [0.1, 0.2, 0.3, 0.4]
    with patch(
        "services.embeddings.generate_embedding",
        new_callable=AsyncMock,
        return_value=fake_vector,
    ) as mock:
        yield mock


# ─── OpenAI / generation mock ─────────────────────────────────────────────────

@pytest.fixture
def mock_openai():
    """Stub OpenAI chat completions to return deterministic JSON."""
    fake_completion = MagicMock()
    fake_completion.choices = [MagicMock(message=MagicMock(content='[{"id":1,"type":"mcq","question":"Q?","options":["A","B","C","D"],"answer":"A"}]'))]

    mock_client = MagicMock()
    mock_client.chat = MagicMock()
    mock_client.chat.completions = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=fake_completion)

    with patch("services.generation.async_openai_client", mock_client):
        yield mock_client

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch, MagicMock

@pytest.mark.asyncio
async def test_chat_endpoint_success(client: AsyncClient, mock_db):
    """Test standard successful chat interaction."""
    # Mock retrieval to return some chunks
    mock_chunks = [
        MagicMock(content="Lexical analysis is phase 1.", metadata={"title": "Lecture 1", "page": 1}),
        MagicMock(content="Parsing is phase 2.", metadata={"title": "Lecture 1", "page": 2})
    ]
    
    with patch("services.routes.chat.retrieve_chunks_by_topic", new_callable=MagicMock, return_value=mock_chunks):
        fake_ans = {"answer": "Lexical analysis comes before parsing.", "cited_ids": [1], "confidence": 0.98}
        with patch("services.routes.chat.generate_structured_chat", new_callable=AsyncMock, return_value=fake_ans):
            payload = {
                "subject_id": "99de6ff4-9444-4a3d-ad4a-ef14c93b7d8d",
                "question": "What comes first, lexical analysis or parsing?",
                "conversation_history": []
            }
            
            response = await client.post("/chat", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert "answer" in data
            assert data["confidence"] > 0.9

@pytest.mark.asyncio
async def test_chat_endpoint_ollama_failure(client: AsyncClient, mock_db):
    """Test failure mode when Ollama is unavailable."""
    with patch("services.routes.chat.condense_question", side_effect=ConnectionError("Ollama connection refused")):
        payload = {
            "subject_id": "99de6ff4-9444-4a3d-ad4a-ef14c93b7d8d",
            "question": "Hello",
            "conversation_history": []
        }
        response = await client.post("/chat", json=payload)
        assert response.status_code == 503
        assert "unavailable" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_chat_endpoint_validation_error(client: AsyncClient):
    """Test missing required fields."""
    payload = {
        "question": "Incomplete request"
    }
    response = await client.post("/chat", json=payload)
    assert response.status_code == 422 # Pydantic validation error

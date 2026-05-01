import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from services.generation import condense_question, generate_structured_chat
from services.schemas import ChatMessage

@pytest.mark.asyncio
async def test_condense_question_no_history():
    """Verify that with no history, the question remains unchanged."""
    question = "What is lexical analysis?"
    condensed = await condense_question(question, [])
    assert condensed == question

@pytest.mark.asyncio
async def test_condense_question_with_history():
    """Verify that the AI is called to condense the question when history exists."""
    history = [
        {"role": "user", "content": "What is lexical analysis?"},
        {"role": "assistant", "content": "It's the first phase of a compiler."}
    ]
    follow_up = "How does it relate to parsing?"
    
    # Mock Ollama response
    mock_response = MagicMock()
    mock_response.json = MagicMock(return_value={"response": "Explain the relationship between lexical analysis and parsing."})
    mock_response.status_code = 200
    mock_response.raise_for_status = MagicMock()
    
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        condensed = await condense_question(follow_up, history)
        assert "lexical analysis" in condensed.lower() or "Explain" in condensed
        assert "parsing" in condensed.lower() or "relationship" in condensed

@pytest.mark.asyncio
async def test_generate_structured_chat_success():
    """Test successful structured response generation."""
    fake_raw = '{"answer": "Test answer", "cited_ids": [], "confidence": 0.95}'
    
    with patch("services.generation._async_stream_ollama_generate", new_callable=AsyncMock, return_value=fake_raw):
        result = await generate_structured_chat([], "Test question", [])
        assert result["answer"] == "Test answer"
        assert result["confidence"] == 0.95

@pytest.mark.asyncio
async def test_generate_structured_chat_malformed_json_fallback():
    """Test that malformed JSON from LLM falls back to plain text parsing."""
    fake_raw = "This is a plain text answer that failed JSON format."
    
    with patch("services.generation._async_stream_ollama_generate", new_callable=AsyncMock, return_value=fake_raw):
        result = await generate_structured_chat([], "Test question", [])
        assert result["fallback"] is True
        assert "plain text" in result["answer"] or fake_raw in result["answer"]

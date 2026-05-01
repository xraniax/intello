import asyncio
import json
from unittest.mock import MagicMock, patch
from services.generation import generate_structured_chat

async def test_grounding():
    print("Testing Grounding and Refusal logic...")
    
    # Mock chunks
    chunks = [
        {"id": 1, "content": "The capital of France is Paris.", "document_id": 101},
        {"id": 2, "content": "The population of Paris is 2 million.", "document_id": 101}
    ]

    # 1. Test case: Answer found in context
    print("\nCase 1: Answer is in context")
    # We mock _async_stream_ollama_generate to return a valid structured JSON
    with patch('services.generation._async_stream_ollama_generate') as mock_gen:
        mock_gen.return_value = json.dumps({
            "answer": "The capital of France is Paris.",
            "supported": True,
            "evidence": [1]
        })
        
        result = await generate_structured_chat(chunks, "What is the capital of France?")
        print(f"Result: {result}")
        assert result['answer'] == "The capital of France is Paris."
        assert result['cited_ids'] == [1]

    # 2. Test case: Answer NOT in context (LLM identifies it)
    print("\nCase 2: Answer NOT in context (LLM identifies it)")
    with patch('services.generation._async_stream_ollama_generate') as mock_gen:
        mock_gen.return_value = json.dumps({
            "answer": "I don't know.",
            "supported": False,
            "evidence": []
        })
        
        result = await generate_structured_chat(chunks, "Who is the president of France?")
        print(f"Result: {result}")
        assert "I couldn't find that information" in result['answer']

    # 3. Test case: LLM claims answer is there but provides no evidence
    print("\nCase 3: LLM claims answer is there but provides no evidence")
    with patch('services.generation._async_stream_ollama_generate') as mock_gen:
        mock_gen.return_value = json.dumps({
            "answer": "Emmanuel Macron is the president.",
            "supported": True,
            "evidence": []
        })
        
        result = await generate_structured_chat(chunks, "Who is the president of France?")
        print(f"Result: {result}")
        assert "I couldn't find that information" in result['answer']

    print("\nAll grounding tests passed (Mocked LLM)!")

if __name__ == "__main__":
    asyncio.run(test_grounding())

#!/usr/bin/env python3
"""
Standalone test script for the Cognify Engine embeddings pipeline.
Tests preprocessing, chunking, and embeddings generation.
Can run independently of the FastAPI server.
"""

import os
import sys
import logging
import requests
from typing import List, Optional

# Add engine to path
sys.path.insert(0, os.path.dirname(__file__))

from services.preprocessing import preprocess_document, _chunk_text
from services.embeddings import generate_embeddings, generate_embedding

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("test-engine")

def test_preprocessing_and_chunking():
    """Test text preprocessing and chunking with sample text."""
    logger.info("Testing preprocessing and chunking...")

    # Sample text
    sample_text = """
    Artificial Intelligence (AI) is a field of computer science that aims to create machines capable of intelligent behavior.
    Machine learning is a subset of AI that enables computers to learn from data without being explicitly programmed.
    Deep learning uses neural networks with multiple layers to model complex patterns in data.
    Natural Language Processing (NLP) allows computers to understand and generate human language.
    Computer vision enables machines to interpret and understand visual information from the world.
    """

    # Test chunking
    chunks = _chunk_text(sample_text, max_chars=200, overlap=50)
    logger.info(f"Generated {len(chunks)} chunks")
    for i, chunk in enumerate(chunks):
        logger.info(f"Chunk {i}: {len(chunk)} chars - {chunk[:50]}...")

    return chunks

def test_embeddings_generation():
    """Test embeddings generation with Ollama."""
    logger.info("Testing embeddings generation...")

    # Test single embedding
    test_text = "This is a test sentence for embeddings."
    try:
        embedding = generate_embedding(test_text, timeout=15, retries=2)
        logger.info(f"Generated embedding with {len(embedding)} dimensions")
        logger.info(f"First 5 values: {embedding[:5]}")
    except Exception as e:
        logger.error(f"Single embedding failed: {e}")
        return False

    # Test batch embeddings
    texts = [
        "Machine learning is powerful.",
        "AI can solve complex problems.",
        "Natural language processing is key for chatbots."
    ]

    try:
        embeddings = generate_embeddings(texts, timeout=15, retries=2)
        logger.info(f"Generated {len(embeddings)} embeddings")
        for i, emb in enumerate(embeddings):
            if emb:
                logger.info(f"Embedding {i}: {len(emb)} dims")
            else:
                logger.warning(f"Embedding {i} failed")
    except Exception as e:
        logger.error(f"Batch embeddings failed: {e}")
        return False

    return True

def test_api_endpoints(base_url: str = "http://localhost:8000"):
    """Test the FastAPI endpoints."""
    logger.info(f"Testing API endpoints at {base_url}...")

    # Test health
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            logger.info(f"Health check: {response.json()}")
        else:
            logger.warning(f"Health check failed: {response.status_code}")
    except Exception as e:
        logger.error(f"Health check error: {e}")

    # Test root
    try:
        response = requests.get(f"{base_url}/", timeout=5)
        if response.status_code == 200:
            logger.info(f"Root endpoint: {response.json()}")
        else:
            logger.warning(f"Root endpoint failed: {response.status_code}")
    except Exception as e:
        logger.error(f"Root endpoint error: {e}")

def test_full_pipeline():
    """Test the complete pipeline: preprocess -> chunk -> embed."""
    logger.info("Testing full pipeline...")

    # Create a temporary text file for testing
    import tempfile
    sample_content = """
    This is a sample document for testing the embeddings pipeline.
    It contains multiple sentences and paragraphs to test chunking.
    The system should extract text, clean it, split into chunks,
    and generate embeddings for each chunk using Ollama.
    """

    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write(sample_content)
        temp_path = f.name

    try:
        # Since preprocess_document expects PDF/image, we'll simulate
        from services.preprocessing import _clean_text, _chunk_text

        cleaned = _clean_text(sample_content)
        chunks = _chunk_text(cleaned, max_chars=200, overlap=50)

        logger.info(f"Cleaned text: {len(cleaned)} chars")
        logger.info(f"Generated {len(chunks)} chunks")

        # Generate embeddings
        embeddings = generate_embeddings(chunks, timeout=15, retries=2)
        successful = sum(1 for e in embeddings if e is not None)
        logger.info(f"Generated {successful}/{len(chunks)} embeddings successfully")

        return successful > 0

    except Exception as e:
        logger.error(f"Full pipeline test failed: {e}")
        return False
    finally:
        os.unlink(temp_path)

def main():
    """Run all tests."""
    logger.info("Starting Cognify Engine tests...")

    # Test preprocessing
    chunks = test_preprocessing_and_chunking()

    # Test embeddings
    embeddings_ok = test_embeddings_generation()

    # Test API (if running)
    test_api_endpoints()

    # Test full pipeline
    pipeline_ok = test_full_pipeline()

    # Summary
    logger.info("Test Summary:")
    logger.info(f"- Preprocessing: {'✓' if chunks else '✗'}")
    logger.info(f"- Embeddings: {'✓' if embeddings_ok else '✗'}")
    logger.info(f"- Full Pipeline: {'✓' if pipeline_ok else '✗'}")

    if embeddings_ok and pipeline_ok:
        logger.info("All critical tests passed!")
        return 0
    else:
        logger.error("Some tests failed. Check Ollama connectivity and configuration.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
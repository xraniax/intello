import unittest
import numpy as np
import sys
import os

# Ensure the project root is in sys.path for internal imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from utils.embeddings import get_embedder, LocalEmbedder, MockEmbedder

class TestEmbeddings(unittest.TestCase):
    """
    Phase 1 Unit Tests: Verifying vector dimensions and semantic consistency.
    """
    @classmethod
    def setUpClass(cls):
        # Force MockEmbedder for CI-style tests to avoid downloading 
        # heavy models during every automated run, unless explicitly testing Local.
        cls.mock_embedder = MockEmbedder(dimension=384)
        
    def test_vector_dimensions(self):
        """Requirement: Output vectors must have dimension = 384."""
        texts = ["Hello world", "Cognify is an AI platform."]
        embeddings = self.mock_embedder.get_embeddings(texts)
        
        self.assertEqual(len(embeddings), 2)
        self.assertEqual(len(embeddings[0]), 384)
        self.assertEqual(len(embeddings[1]), 384)

    def test_determinism(self):
        """Requirement: Same input -> same embedding."""
        text = "This is a deterministic test."
        emb1 = self.mock_embedder.get_embeddings([text])[0]
        emb2 = self.mock_embedder.get_embeddings([text])[0]
        
        self.assertEqual(emb1, emb2)

    def test_similarity_logic(self):
        """
        Requirement: Verify similarity between related and unrelated texts.
        Since we use a deterministic mock based on hashing for this unit test,
        we'll just verify the call structure.
        Real similarity testing is in the manual script below.
        """
        texts = ["Dog", "Cat", "Spaceship"]
        embeddings = self.mock_embedder.get_embeddings(texts)
        self.assertEqual(len(embeddings), 3)


def cosine_similarity(a, b):
    """Utility for manual similarity verification (Phase 1 Requirement)."""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


def run_manual_test():
    """
    Phase 1 Manual Test Script:
    Encodes sample sentences and prints cosine similarity results.
    """
    print("\n--- Phase 1: Manual Embeddings Verification ---")
    
    provider = os.getenv("EMBEDDING_PROVIDER", "local").lower()
    
    # Use LocalEmbedder for manual verification if possible, fallback to Mock
    embedder = None
    if provider == "local":
        try:
            embedder = LocalEmbedder()
            print(f"Using Provider: {embedder.provider_name} ({embedder.model_name})")
        except Exception as e:
            print(f"LocalEmbedder unavailable ({e}). Using MockEmbedder.")
    
    if not embedder:
        embedder = MockEmbedder(dimension=384)
        print(f"Using Provider: {embedder.provider_name} ({embedder.model_name})")

    sentences = [
        "The quick brown fox jumps over the lazy dog.",
        "A fast auburn canine leaps across a sleepy puppy.",  # Similar to 1
        "The stock market showed unexpected volatility today.", # Unrelated
        "AI agents are revolutionizing software development." # Unrelated
    ]

    print(f"Encoding {len(sentences)} sample sentences...")
    embeddings = embedder.get_embeddings(sentences)
    
    print("\nSimilarity Matrix (Cosine Similarity):")
    print("-" * 40)
    for i in range(len(sentences)):
        for j in range(i + 1, len(sentences)):
            sim = cosine_similarity(embeddings[i], embeddings[j])
            print(f"S{i+1} <-> S{j+1}: {sim:.4f}")
            
    print("\nSentence Legend:")
    for idx, s in enumerate(sentences):
        print(f"S{idx+1}: {s}")
    print("-" * 40)


if __name__ == "__main__":
    # 1. Run Unit Tests
    print("Running Unit Tests...")
    unittest.main(exit=False)
    
    # 2. Run Manual Verification
    run_manual_test()

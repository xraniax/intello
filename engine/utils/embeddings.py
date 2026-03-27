import os
import logging
import abc
from typing import List, Optional, Dict, Any
import numpy as np

# Configure logging for the embeddings module
logger = logging.getLogger("engine-embeddings")

class Embedder(abc.ABC):
    """
    Abstract base class for all embedding providers.
    Ensures a consistent interface across different backend models.
    """
    @abc.abstractmethod
    def get_embeddings(self, texts: List[str], metadata: Optional[List[Dict[str, Any]]] = None) -> List[List[float]]:
        """
        Generate high-dimensional vectors for a list of strings.
        Supports optional metadata for chunk tracking (Phase 1 requirement).
        """
        pass

    @property
    @abc.abstractmethod
    def model_name(self) -> str:
        """The identifier of the specific model being used."""
        pass

    @property
    @abc.abstractmethod
    def provider_name(self) -> str:
        """The identifier of the provider (e.g., 'local', 'openai', 'mock')."""
        pass

    @property
    @abc.abstractmethod
    def dimension(self) -> int:
        """The size of the output vector (e.g., 384 for MiniLM)."""
        pass


class LocalEmbedder(Embedder):
    """
    Professional implementation using sentence-transformers/all-MiniLM-L6-v2.
    Ideal for local development, privacy, and lowndel-latency processing.
    """
    def __init__(self, model_name: str = "all-MiniLM-L6-v2", batch_size: int = 32):
        try:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(model_name)
            self._model_name = model_name
            self.batch_size = batch_size
            logger.info(f"Initialized LocalEmbedder with model: {model_name}")
        except ImportError:
            logger.error("sentence-transformers not installed. Run 'pip install sentence-transformers'.")
            raise ImportError("Missing sentence-transformers dependency.")

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def provider_name(self) -> str:
        return "local"

    @property
    def dimension(self) -> int:
        return 384  # Fixed for all-MiniLM-L6-v2

    def get_embeddings(self, texts: List[str], metadata: Optional[List[Dict[str, Any]]] = None) -> List[List[float]]:
        if not texts:
            return []

        # Robust Error Handling (Phase 1 Requirement)
        cleaned_texts = []
        for i, text in enumerate(texts):
            if not isinstance(text, str) or not text.strip():
                logger.warning(f"Empty or non-string input at index {i}. Replacing with placeholder.")
                cleaned_texts.append("[EMPTY_CHUNK]")
            else:
                # Handle potential unicode/large input issues by normalization if necessary
                cleaned_texts.append(text.strip())

        try:
            # Batch processing for efficiency (Phase 1 Requirement)
            # convert_to_numpy=True ensures we get a predictable format
            embeddings = self.model.encode(
                cleaned_texts,
                batch_size=self.batch_size,
                show_progress_bar=False,
                convert_to_numpy=True
            )
            # Return as list of lists for JSON compatibility
            return embeddings.tolist()
        except Exception as e:
            logger.error(f"Local embedding generation failed: {e}")
            raise


class MockEmbedder(Embedder):
    """
    Deterministic Mock provider for testing and development.
    Generates predictable vectors without requiring specialized hardware or API keys.
    """
    def __init__(self, dimension: int = 384):
        self._dimension = dimension

    @property
    def model_name(self) -> str:
        return f"mock-all-MiniLM-L6-v2-dim-{self._dimension}"

    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def dimension(self) -> int:
        return self._dimension

    def get_embeddings(self, texts: List[str], metadata: Optional[List[Dict[str, Any]]] = None) -> List[List[float]]:
        """
        Generates deterministic 'embeddings' based on text hashing.
        Ensures same input always yields same dummy vector.
        """
        logger.info(f"Generating mock embeddings for {len(texts)} inputs.")
        results = []
        for text in texts:
            # Use seed to ensure determinism (Phase 1 requirement)
            seed = sum(ord(c) for c in text) % 1000
            rng = np.random.default_rng(seed)
            vector = rng.standard_normal(self._dimension).tolist()
            results.append(vector)
        return results


def get_embedder() -> Embedder:
    """
    Factory function for easy switching between providers (Phase 1 Requirement).
    Defaults to 'local' for production-ready local-first strategy.
    """
    provider = os.getenv("EMBEDDING_PROVIDER", "local").lower()
    
    if provider == "local":
        try:
            return LocalEmbedder()
        except Exception as e:
            logger.warning(f"Failed to load LocalEmbedder: {e}. Falling back to MockEmbedder.")
            return MockEmbedder()
    
    elif provider == "mock":
        return MockEmbedder()

    # Fallback/Safety
    logger.warning(f"Unsupported provider '{provider}'. Using MockEmbedder.")
    return MockEmbedder()

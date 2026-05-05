"""
Semantic similarity module using Sentence-BERT.

Uses all-MiniLM-L6-v2 model for consistent embeddings across all
semantic operations in the scoring pipeline.
"""

import logging
import re
from typing import List, Optional, Tuple
import numpy as np

logger = logging.getLogger("engine.scoring.similarity")

# Lazy-loaded model singleton
_embedding_model = None


def get_embedding_model():
    """
    Lazy-load the Sentence-BERT model.
    Uses singleton pattern to avoid reloading.
    """
    global _embedding_model
    if _embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading Sentence-BERT model: all-MiniLM-L6-v2")
            _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Sentence-BERT model loaded successfully")
        except ImportError as e:
            logger.error(
                "sentence-transformers not installed. "
                "Run: pip install sentence-transformers"
            )
            raise RuntimeError(
                "sentence-transformers package required"
            ) from e
    return _embedding_model


def preprocess_text(text: str) -> str:
    """
    Preprocess text for embedding generation.
    
    Steps:
        - Normalize whitespace
        - Remove excessive punctuation
        - Lowercase (optional, handled by model)
    """
    if not text or not text.strip():
        return ""
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text.strip())
    
    # Remove excessive punctuation (keep sentence structure)
    text = re.sub(r'[!?]{2,}', '!', text)
    text = re.sub(r'\.{3,}', '...', text)
    
    return text


def compute_embedding(text: str) -> Optional[np.ndarray]:
    """
    Compute embedding for a single text using Sentence-BERT.
    
    Args:
        text: Input text to embed
        
    Returns:
        Embedding vector as numpy array, or None if failed
    """
    text = preprocess_text(text)
    if not text:
        return None
    
    try:
        model = get_embedding_model()
        embedding = model.encode(text, convert_to_numpy=True, show_progress_bar=False)
        return embedding
    except Exception as e:
        logger.error(f"Failed to compute embedding: {e}")
        return None


def compute_embeddings_batch(texts: List[str]) -> List[Optional[np.ndarray]]:
    """
    Compute embeddings for multiple texts efficiently.
    
    Args:
        texts: List of input texts
        
    Returns:
        List of embedding vectors (None for failed items)
    """
    if not texts:
        return []
    
    # Preprocess all texts
    processed = [preprocess_text(t) for t in texts]
    
    # Filter out empty texts but remember positions
    valid_indices = [i for i, t in enumerate(processed) if t]
    valid_texts = [processed[i] for i in valid_indices]
    
    if not valid_texts:
        return [None] * len(texts)
    
    try:
        model = get_embedding_model()
        embeddings = model.encode(
            valid_texts,
            convert_to_numpy=True,
            show_progress_bar=False,
            batch_size=32
        )
        
        # Reconstruct result with Nones for empty texts
        results: List[Optional[np.ndarray]] = [None] * len(texts)
        for idx, emb in zip(valid_indices, embeddings):
            results[idx] = emb
        
        return results
    except Exception as e:
        logger.error(f"Failed to compute batch embeddings: {e}")
        return [None] * len(texts)


def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """
    Compute cosine similarity between two vectors.
    
    Returns:
        Similarity score in range [0.0, 1.0]
    """
    if vec1 is None or vec2 is None:
        return 0.0
    
    # Normalize vectors
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    # Compute cosine similarity
    similarity = np.dot(vec1, vec2) / (norm1 * norm2)
    
    # Clip to [0, 1] range for our use case
    # (negative similarity means opposite meaning, treat as 0 for exam scoring)
    return float(np.clip(similarity, 0.0, 1.0))


def semantic_similarity_score(
    student_answer: str,
    reference_answer: str
) -> Tuple[float, Optional[np.ndarray], Optional[np.ndarray]]:
    """
    Compute semantic similarity score between student and reference answers.
    
    Args:
        student_answer: Student's submitted answer
        reference_answer: Reference/model answer
        
    Returns:
        Tuple of (similarity_score, student_embedding, reference_embedding)
        similarity_score is in range [0.0, 1.0]
    """
    # Compute embeddings
    student_emb = compute_embedding(student_answer)
    reference_emb = compute_embedding(reference_answer)
    
    if student_emb is None or reference_emb is None:
        logger.warning("Failed to compute embeddings for similarity")
        return 0.0, student_emb, reference_emb
    
    similarity = cosine_similarity(student_emb, reference_emb)
    
    logger.debug(
        f"Semantic similarity: {similarity:.3f} "
        f"(student_len={len(student_answer)}, ref_len={len(reference_answer)})"
    )
    
    return similarity, student_emb, reference_emb


def similarity_with_chunks(
    student_answer: str,
    reference_chunks: List[str]
) -> Tuple[float, List[float]]:
    """
    Compute similarity against multiple reference chunks.
    Returns maximum similarity (best match) and all scores.
    
    Useful when reference answer has multiple valid formulations.
    """
    if not reference_chunks:
        return 0.0, []
    
    student_emb = compute_embedding(student_answer)
    if student_emb is None:
        return 0.0, [0.0] * len(reference_chunks)
    
    chunk_embeddings = compute_embeddings_batch(reference_chunks)
    similarities = []
    
    for chunk_emb in chunk_embeddings:
        if chunk_emb is not None:
            sim = cosine_similarity(student_emb, chunk_emb)
            similarities.append(sim)
        else:
            similarities.append(0.0)
    
    if not similarities:
        return 0.0, []
    
    return max(similarities), similarities


def detect_concept_with_embedding(
    answer_text: str,
    concept_description: str,
    threshold: float = 0.65
) -> Tuple[bool, float]:
    """
    Detect if a concept is present using semantic similarity.
    
    Compares the answer against the concept description to determine
    if the concept is semantically present.
    
    Args:
        answer_text: Student's answer
        concept_description: Description of the concept
        threshold: Minimum similarity to consider concept present
        
    Returns:
        Tuple of (is_present, similarity_score)
    """
    similarity, _, _ = semantic_similarity_score(answer_text, concept_description)
    is_present = similarity >= threshold
    
    logger.debug(
        f"Concept detection: similarity={similarity:.3f}, "
        f"threshold={threshold}, present={is_present}"
    )
    
    return is_present, similarity

"""
Core scoring components.
"""

from .similarity import (
    compute_embedding,
    compute_embeddings_batch,
    cosine_similarity,
    semantic_similarity_score,
    similarity_with_chunks,
    detect_concept_with_embedding,
    get_embedding_model,
)
from .concepts import (
    ConceptDetectionResult,
    detect_concept_by_keywords,
    detect_concept_semantic,
    evaluate_concept_coverage,
    extract_concept_snippets,
)
from .keywords import (
    KeywordMatchResult,
    KeywordScoreResult,
    find_keyword_matches,
    calculate_keyword_score,
    detect_keyword_stuffing,
    extract_terminology_usage,
    tokenize,
)

__all__ = [
    # Similarity
    "compute_embedding",
    "compute_embeddings_batch",
    "cosine_similarity",
    "semantic_similarity_score",
    "similarity_with_chunks",
    "detect_concept_with_embedding",
    "get_embedding_model",
    # Concepts
    "ConceptDetectionResult",
    "detect_concept_by_keywords",
    "detect_concept_semantic",
    "evaluate_concept_coverage",
    "extract_concept_snippets",
    # Keywords
    "KeywordMatchResult",
    "KeywordScoreResult",
    "find_keyword_matches",
    "calculate_keyword_score",
    "detect_keyword_stuffing",
    "extract_terminology_usage",
    "tokenize",
]

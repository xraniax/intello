"""
Semantic similarity scoring using embeddings.
"""
import logging
import time
from typing import List, Optional, Tuple
import numpy as np

from ..embeddings import embed_step_async
from .models import SimilarityResult, ScoringConfig

logger = logging.getLogger("scoring-similarity")


class SemanticSimilarityScorer:
    """Handles semantic similarity scoring using embeddings."""
    
    def __init__(self, config: ScoringConfig):
        self.config = config
        self._model_name = config.similarity_model
        
    async def score_similarity(
        self, 
        student_answer: str, 
        reference_answer: str,
        *,
        request_id: Optional[str] = None
    ) -> SimilarityResult:
        """
        Calculate semantic similarity between student and reference answers.
        
        Args:
            student_answer: The student's response
            reference_answer: The reference/expected answer
            request_id: Optional request ID for logging
            
        Returns:
            SimilarityResult with similarity score and metadata
        """
        start_time = time.time()
        
        try:
            # Generate embeddings for both answers
            embeddings = await embed_step_async(
                [student_answer, reference_answer],
                request_id=request_id
            )
            
            if len(embeddings) != 2 or None in embeddings:
                logger.warning(f"Failed to generate embeddings for similarity scoring")
                return SimilarityResult(
                    similarity_score=0.0,
                    model_used=self._model_name
                )
            
            student_emb = np.array(embeddings[0])
            reference_emb = np.array(embeddings[1])
            
            # Calculate cosine similarity
            similarity = self._cosine_similarity(student_emb, reference_emb)
            distance = self._euclidean_distance(student_emb, reference_emb)
            
            processing_time = (time.time() - start_time) * 1000
            
            logger.debug(
                f"Similarity scoring completed: {similarity:.3f} "
                f"(distance: {distance:.3f}, time: {processing_time:.1f}ms)"
            )
            
            return SimilarityResult(
                similarity_score=float(similarity),
                embedding_distance=float(distance),
                model_used=self._model_name
            )
            
        except Exception as e:
            logger.error(f"Error in similarity scoring: {e}")
            return SimilarityResult(
                similarity_score=0.0,
                model_used=self._model_name
            )
    
    def _cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors."""
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
            
        return np.dot(vec1, vec2) / (norm1 * norm2)
    
    def _euclidean_distance(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Calculate euclidean distance between two vectors."""
        return float(np.linalg.norm(vec1 - vec2))
    
    def normalize_similarity_score(self, similarity: float) -> float:
        """
        Normalize similarity score based on threshold.
        
        Args:
            similarity: Raw similarity score (0-1)
            
        Returns:
            Normalized score adjusted for threshold
        """
        threshold = self.config.semantic_threshold
        
        if similarity >= threshold:
            # Linear scaling above threshold
            return min(1.0, (similarity - threshold) / (1.0 - threshold))
        else:
            # Quadratic scaling below threshold (more punitive)
            return (similarity / threshold) ** 2
    
    def batch_score(
        self,
        student_answers: List[str],
        reference_answers: List[str],
        *,
        request_id: Optional[str] = None
    ) -> List[SimilarityResult]:
        """
        Score multiple answer pairs in batch for efficiency.
        
        Args:
            student_answers: List of student responses
            reference_answers: List of reference responses
            request_id: Optional request ID for logging
            
        Returns:
            List of similarity results
        """
        if len(student_answers) != len(reference_answers):
            raise ValueError("Student and reference answer lists must have same length")
        
        results = []
        for student, reference in zip(student_answers, reference_answers):
            # In a real implementation, this would be optimized for batch processing
            # For now, using individual calls
            result = await self.score_similarity(student, reference, request_id=request_id)
            results.append(result)
            
        return results

"""
Main Level 2 scorer that orchestrates all scoring components.
"""
import logging
import time
from typing import Dict, List, Optional

from .models import ScoringResult, ScoringConfig, ComponentScore, ScoringMethod
from .similarity import SemanticSimilarityScorer
from .concepts import ConceptCoverageScorer
from .keywords import KeywordScorer
from .feedback import FeedbackGenerator
from .utils import validate_weights, normalize_score, calculate_weighted_score, create_component_score

logger = logging.getLogger("scoring-level2")


class Level2Scorer:
    """
    Level 2 scoring system for educational short-answer grading.
    
    Combines semantic similarity, concept coverage, and keyword matching
    to provide comprehensive scoring and feedback.
    """
    
    def __init__(self, config: Optional[ScoringConfig] = None):
        """
        Initialize the Level 2 scorer.
        
        Args:
            config: Optional scoring configuration
        """
        self.config = config or ScoringConfig()
        
        # Validate configuration
        validate_weights(self.config)
        
        # Initialize component scorers
        self.semantic_scorer = SemanticSimilarityScorer(self.config)
        self.concept_scorer = ConceptCoverageScorer(self.config)
        self.keyword_scorer = KeywordScorer(self.config)
        self.feedback_generator = FeedbackGenerator()
        
        logger.info("Level 2 scorer initialized with config: %s", self.config.dict())
    
    async def score_answer(
        self,
        student_answer: str,
        reference_answer: str,
        domain_concepts: Optional[List[str]] = None,
        custom_keywords: Optional[List[str]] = None,
        *,
        request_id: Optional[str] = None
    ) -> ScoringResult:
        """
        Score a student's answer against a reference answer.
        
        Args:
            student_answer: Student's response
            reference_answer: Reference/expected answer
            domain_concepts: Optional predefined domain concepts
            custom_keywords: Optional predefined keywords
            request_id: Optional request ID for logging
            
        Returns:
            Complete scoring result with feedback
        """
        start_time = time.time()
        
        logger.info(
            f"Starting Level 2 scoring: student_answer_length={len(student_answer)}, "
            f"reference_answer_length={len(reference_answer)}"
        )
        
        try:
            # Run all scoring components
            component_scores = await self._run_scoring_components(
                student_answer, reference_answer, domain_concepts, custom_keywords, request_id
            )
            
            # Calculate final score
            final_score = calculate_weighted_score(component_scores)
            
            # Generate feedback
            feedback = self.feedback_generator.generate_feedback(
                self._create_mock_result(final_score, student_answer, reference_answer),
                component_scores,
                request_id=request_id
            )
            
            # Extract additional information for the result
            concepts_covered, missing_concepts = self._extract_concept_info(
                student_answer, reference_answer, domain_concepts
            )
            keywords_matched = self._extract_keyword_info(
                student_answer, reference_answer, custom_keywords
            )
            
            # Create final result
            result = ScoringResult(
                student_answer=student_answer,
                reference_answer=reference_answer,
                final_score=normalize_score(final_score),
                grade=self.feedback_generator.generate_grade(final_score),
                components=component_scores,
                feedback=feedback,
                concepts_covered=concepts_covered,
                keywords_matched=keywords_matched,
                missing_concepts=missing_concepts,
                processing_time_ms=(time.time() - start_time) * 1000
            )
            
            logger.info(
                f"Scoring completed: final_score={final_score:.3f}, "
                f"grade={result.grade}, time={result.processing_time_ms:.1f}ms"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error in Level 2 scoring: {e}", exc_info=True)
            raise
    
    async def _run_scoring_components(
        self,
        student_answer: str,
        reference_answer: str,
        domain_concepts: Optional[List[str]],
        custom_keywords: Optional[List[str]],
        request_id: Optional[str]
    ) -> List[ComponentScore]:
        """Run all scoring components and return component scores."""
        component_scores = []
        
        # Semantic similarity scoring
        similarity_result = await self.semantic_scorer.score_similarity(
            student_answer, reference_answer, request_id=request_id
        )
        normalized_similarity = self.semantic_scorer.normalize_similarity_score(
            similarity_result.similarity_score
        )
        
        component_scores.append(create_component_score(
            method=ScoringMethod.SEMANTIC_SIMILARITY,
            score=normalized_similarity,
            weight=self.config.semantic_weight,
            details={
                "raw_similarity": similarity_result.similarity_score,
                "embedding_distance": similarity_result.embedding_distance,
                "model_used": similarity_result.model_used
            }
        ))
        
        # Concept coverage scoring
        concept_result = self.concept_scorer.score_concept_coverage(
            student_answer, reference_answer, domain_concepts, request_id=request_id
        )
        
        component_scores.append(create_component_score(
            method=ScoringMethod.CONCEPT_COVERAGE,
            score=concept_result["coverage_score"],
            weight=self.config.concept_weight,
            details={
                "reference_concepts": concept_result["reference_concepts"],
                "covered_concepts": concept_result["covered_concepts"],
                "missing_concepts": concept_result["missing_concepts"]
            }
        ))
        
        # Keyword matching scoring
        keyword_result = self.keyword_scorer.score_answer_keywords(
            student_answer, reference_answer, custom_keywords, request_id=request_id
        )
        
        component_scores.append(create_component_score(
            method=ScoringMethod.KEYWORD_MATCHING,
            score=keyword_result["match_score"],
            weight=self.config.keyword_weight,
            details={
                "reference_keywords": keyword_result["reference_keywords"],
                "matched_keywords": keyword_result["matched_keywords"],
                "unmatched_keywords": keyword_result["unmatched_keywords"]
            }
        ))
        
        return component_scores
    
    def _extract_concept_info(
        self,
        student_answer: str,
        reference_answer: str,
        domain_concepts: Optional[List[str]]
    ) -> tuple[List[str], List[str]]:
        """Extract covered and missing concepts from answers."""
        concept_result = self.concept_scorer.score_concept_coverage(
            student_answer, reference_answer, domain_concepts
        )
        
        return (
            concept_result["covered_concepts"],
            concept_result["missing_concepts"]
        )
    
    def _extract_keyword_info(
        self,
        student_answer: str,
        reference_answer: str,
        custom_keywords: Optional[List[str]]
    ) -> List[str]:
        """Extract matched keywords from answers."""
        keyword_result = self.keyword_scorer.score_answer_keywords(
            student_answer, reference_answer, custom_keywords
        )
        
        return keyword_result["matched_keywords"]
    
    def _create_mock_result(
        self, 
        final_score: float, 
        student_answer: str, 
        reference_answer: str
    ) -> ScoringResult:
        """Create a mock result for feedback generation."""
        return ScoringResult(
            student_answer=student_answer,
            reference_answer=reference_answer,
            final_score=final_score,
            grade=self.feedback_generator.generate_grade(final_score),
            components=[],
            feedback="",
            concepts_covered=[],
            keywords_matched=[],
            missing_concepts=[],
            processing_time_ms=0.0
        )
    
    async def batch_score_answers(
        self,
        student_answers: List[str],
        reference_answers: List[str],
        domain_concepts: Optional[List[str]] = None,
        custom_keywords: Optional[List[str]] = None,
        *,
        request_id: Optional[str] = None
    ) -> List[ScoringResult]:
        """
        Score multiple answer pairs in batch.
        
        Args:
            student_answers: List of student responses
            reference_answers: List of reference responses
            domain_concepts: Optional predefined domain concepts
            custom_keywords: Optional predefined keywords
            request_id: Optional request ID for logging
            
        Returns:
            List of scoring results
        """
        if len(student_answers) != len(reference_answers):
            raise ValueError("Student and reference answer lists must have same length")
        
        results = []
        for i, (student, reference) in enumerate(zip(student_answers, reference_answers)):
            result = await self.score_answer(
                student, reference, domain_concepts, custom_keywords,
                request_id=f"{request_id}_{i}" if request_id else f"batch_{i}"
            )
            results.append(result)
        
        return results
    
    def update_config(self, new_config: ScoringConfig) -> None:
        """
        Update the scoring configuration.
        
        Args:
            new_config: New scoring configuration
        """
        validate_weights(new_config)
        self.config = new_config
        
        # Reinitialize component scorers with new config
        self.semantic_scorer = SemanticSimilarityScorer(self.config)
        self.concept_scorer = ConceptCoverageScorer(self.config)
        self.keyword_scorer = KeywordScorer(self.config)
        
        logger.info("Scoring configuration updated: %s", self.config.dict())
    
    def get_config_summary(self) -> Dict:
        """Get a summary of current scoring configuration."""
        return {
            "weights": {
                "semantic": self.config.semantic_weight,
                "concept": self.config.concept_weight,
                "keyword": self.config.keyword_weight
            },
            "thresholds": {
                "semantic": self.config.semantic_threshold,
                "concept": self.config.concept_threshold,
                "keyword": self.config.keyword_threshold
            },
            "models": {
                "similarity_model": self.config.similarity_model,
                "max_keywords": self.config.max_keywords
            }
        }

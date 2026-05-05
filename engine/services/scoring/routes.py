"""
FastAPI routes for the scoring system.
"""
import logging
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field

from ..database import get_db
from sqlalchemy.orm import Session

from .scorer import Level2Scorer
from .models import ScoringConfig, ScoringResult
from .evaluation import GradingEvaluator

logger = logging.getLogger("scoring-routes")

router = APIRouter(prefix="/scoring", tags=["scoring"])

# Global scorer instance (could be moved to dependency injection)
_scorer_instance = None

def get_scorer() -> Level2Scorer:
    """Get or create the global scorer instance."""
    global _scorer_instance
    if _scorer_instance is None:
        _scorer_instance = Level2Scorer()
    return _scorer_instance


# Request/Response models
class ScoreRequest(BaseModel):
    student_answer: str = Field(..., description="Student's answer")
    reference_answer: str = Field(..., description="Reference/expected answer")
    domain_concepts: Optional[List[str]] = Field(None, description="Domain-specific concepts")
    custom_keywords: Optional[List[str]] = Field(None, description="Custom keywords to prioritize")
    request_id: Optional[str] = Field(None, description="Optional request ID for tracking")


class BatchScoreRequest(BaseModel):
    student_answers: List[str] = Field(..., description="List of student answers")
    reference_answers: List[str] = Field(..., description="List of reference answers")
    domain_concepts: Optional[List[str]] = Field(None, description="Domain-specific concepts")
    custom_keywords: Optional[List[str]] = Field(None, description="Custom keywords to prioritize")
    request_id: Optional[str] = Field(None, description="Optional request ID for tracking")


class EvaluationRequest(BaseModel):
    automated_scores: List[float] = Field(..., description="Automated system scores")
    human_scores: List[float] = Field(..., description="Human grader scores")
    student_demographics: Optional[List[Dict[str, Any]]] = Field(None, description="Demographic data for fairness analysis")
    question_metadata: Optional[List[Dict[str, Any]]] = Field(None, description="Question metadata")


class ConfigUpdateRequest(BaseModel):
    semantic_weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    concept_weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    keyword_weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    semantic_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    concept_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    keyword_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)


@router.post("/score", response_model=ScoringResult)
async def score_answer(
    request: ScoreRequest,
    db: Session = Depends(get_db)
):
    """
    Score a single student answer using Level 2 scoring system.
    
    Combines semantic similarity, concept coverage, and keyword matching
    to provide comprehensive scoring and feedback.
    """
    try:
        scorer = get_scorer()
        
        result = await scorer.score_answer(
            student_answer=request.student_answer,
            reference_answer=request.reference_answer,
            domain_concepts=request.domain_concepts,
            custom_keywords=request.custom_keywords,
            request_id=request.request_id
        )
        
        logger.info(
            f"Scored answer: final_score={result.final_score:.3f}, "
            f"grade={result.grade}, request_id={request.request_id}"
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error scoring answer: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-score", response_model=List[ScoringResult])
async def batch_score_answers(
    request: BatchScoreRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Score multiple student answers in batch.
    
    Optimized for processing multiple responses efficiently.
    """
    try:
        if len(request.student_answers) != len(request.reference_answers):
            raise HTTPException(
                status_code=400, 
                detail="Student and reference answer lists must have same length"
            )
        
        if len(request.student_answers) > 100:
            raise HTTPException(
                status_code=400,
                detail="Batch size limited to 100 answers per request"
            )
        
        scorer = get_scorer()
        
        results = await scorer.batch_score_answers(
            student_answers=request.student_answers,
            reference_answers=request.reference_answers,
            domain_concepts=request.domain_concepts,
            custom_keywords=request.custom_keywords,
            request_id=request.request_id
        )
        
        logger.info(
            f"Batch scored {len(results)} answers, request_id={request.request_id}"
        )
        
        return results
        
    except Exception as e:
        logger.error(f"Error in batch scoring: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evaluate")
async def evaluate_grading_system(
    request: EvaluationRequest
):
    """
    Evaluate automated grading system against human graders.
    
    Provides comprehensive metrics for accuracy, fairness, and reliability.
    """
    try:
        evaluator = GradingEvaluator()
        
        metrics = evaluator.evaluate_grading_system(
            automated_scores=request.automated_scores,
            human_scores=request.human_scores,
            student_demographics=request.student_demographics,
            question_metadata=request.question_metadata
        )
        
        # Generate report
        report = evaluator.generate_evaluation_report(
            metrics, len(request.automated_scores)
        )
        
        return {
            "metrics": metrics,
            "report": report,
            "sample_size": len(request.automated_scores)
        }
        
    except Exception as e:
        logger.error(f"Error in evaluation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config")
async def get_scoring_config():
    """Get current scoring configuration."""
    try:
        scorer = get_scorer()
        return scorer.get_config_summary()
        
    except Exception as e:
        logger.error(f"Error getting config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config")
async def update_scoring_config(request: ConfigUpdateRequest):
    """Update scoring configuration."""
    try:
        scorer = get_scorer()
        
        # Get current config
        current_config = scorer.config
        
        # Update with provided values
        config_dict = current_config.dict()
        updates = request.dict(exclude_unset=True)
        config_dict.update(updates)
        
        # Create new config
        new_config = ScoringConfig(**config_dict)
        
        # Update scorer
        scorer.update_config(new_config)
        
        logger.info(f"Updated scoring config: {updates}")
        
        return {"message": "Configuration updated successfully", "config": scorer.get_config_summary()}
        
    except Exception as e:
        logger.error(f"Error updating config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check for the scoring system."""
    try:
        scorer = get_scorer()
        
        # Test basic functionality
        test_result = await scorer.score_answer(
            student_answer="Test answer",
            reference_answer="Test reference",
            request_id="health_check"
        )
        
        return {
            "status": "healthy",
            "scorer_initialized": True,
            "test_score": test_result.final_score,
            "config": scorer.get_config_summary()
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}", exc_info=True)
        return {
            "status": "unhealthy",
            "error": str(e)
        }


@router.post("/benchmark")
async def benchmark_system(
    automated_results: List[ScoringResult],
    human_scores: List[float],
    human_grades: Optional[List[str]] = None
):
    """
    Benchmark automated system against human graders with detailed analysis.
    
    Provides comprehensive comparison and improvement recommendations.
    """
    try:
        evaluator = GradingEvaluator()
        
        benchmark_results = evaluator.benchmark_against_human(
            automated_results=automated_results,
            human_scores=human_scores,
            human_grades=human_grades
        )
        
        return benchmark_results
        
    except Exception as e:
        logger.error(f"Error in benchmarking: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/available")
async def get_available_models():
    """Get information about available scoring models."""
    try:
        return {
            "semantic_similarity": {
                "current": "nomic-embed-text",
                "alternatives": ["all-MiniLM-L6-v2", "MPNet-base"],
                "description": "Models for semantic similarity calculation"
            },
            "concept_extraction": {
                "current": "spaCy en_core_web_sm",
                "alternatives": ["NLTK", "Custom patterns"],
                "description": "Models for concept extraction"
            },
            "keyword_matching": {
                "current": "NLTK + TF-IDF",
                "alternatives": ["RAKE", "YAKE", "TextRank"],
                "description": "Methods for keyword extraction and matching"
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting model info: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/weights/optimize")
async def optimize_weights(
    examples: List[Dict[str, float]],
    target_scores: List[float]
):
    """
    Optimize scoring weights using example data.
    
    Uses linear regression to find optimal weights for your specific use case.
    """
    try:
        from .formula import WeightOptimizer
        
        if len(examples) != len(target_scores):
            raise HTTPException(
                status_code=400,
                detail="Examples and target scores must have same length"
            )
        
        if len(examples) < 3:
            raise HTTPException(
                status_code=400,
                detail="Need at least 3 examples for optimization"
            )
        
        # Validate example format
        required_keys = {"semantic", "concept", "keyword"}
        for i, example in enumerate(examples):
            if not set(example.keys()) == required_keys:
                raise HTTPException(
                    status_code=400,
                    detail=f"Example {i} must contain exactly: {required_keys}"
                )
        
        optimizer = WeightOptimizer()
        optimized_weights = optimizer.optimize_weights_from_examples(
            examples, target_scores
        )
        
        return {
            "optimized_weights": optimized_weights,
            "sample_size": len(examples),
            "improvement_suggestions": [
                "Test these weights on a validation set",
                "Consider domain-specific adjustments",
                "Monitor for bias with these new weights"
            ]
        }
        
    except Exception as e:
        logger.error(f"Error optimizing weights: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

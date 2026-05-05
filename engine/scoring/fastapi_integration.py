"""
FastAPI Integration Example for Exam Scoring Module

This file shows how to integrate the scoring module into FastAPI routes.
Copy relevant parts into your actual API routes.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

# Import the scoring module
from scoring import ExamScorer, ExamRubric, StudentAnswer, ExamScoreResult
from scoring.schemas import ConceptDefinition, ScoreScale


# =============================================================================
# API Request/Response Schemas (for FastAPI documentation)
# =============================================================================

class ConceptDefinitionRequest(BaseModel):
    """Request model for concept definition."""
    name: str = Field(..., description="Concept identifier")
    description: str = Field(..., description="What this concept means")
    keywords: List[str] = Field(default_factory=list, description="Keywords indicating presence")
    weight: float = Field(default=1.0, ge=0.0, le=2.0)
    required: bool = Field(default=True)


class ExamRubricRequest(BaseModel):
    """Request model for creating/updating a rubric."""
    question_id: str
    question_text: str
    reference_answer: str
    concepts: List[ConceptDefinitionRequest] = Field(default_factory=list)
    important_keywords: List[str] = Field(default_factory=list)
    max_length: int = Field(default=200, ge=10, le=1000)
    min_length: int = Field(default=10, ge=1, le=500)
    weights: dict = Field(default_factory=lambda: {
        "semantic": 0.40,
        "concept": 0.40,
        "keyword": 0.20
    })
    score_scale: str = Field(default="0-5")


class StudentAnswerRequest(BaseModel):
    """Request model for student answer submission."""
    student_id: str
    question_id: str
    answer_text: str = Field(..., min_length=1)
    submitted_at: Optional[str] = None
    metadata: Optional[dict] = None


class ScoreExamRequest(BaseModel):
    """Combined request for scoring a single answer."""
    rubric: ExamRubricRequest
    answer: StudentAnswerRequest


class BatchScoreRequest(BaseModel):
    """Request for batch scoring multiple answers."""
    rubric: ExamRubricRequest
    answers: List[StudentAnswerRequest]


class ExamScoreResponse(BaseModel):
    """Response model for exam scoring."""
    semantic_score: float
    concept_score: float
    keyword_score: float
    final_score: float
    normalized_score: float
    missing_concepts: List[str]
    present_concepts: List[str]
    found_keywords: List[str]
    missing_keywords: List[str]
    feedback: str
    grading_explanation: str
    warnings: List[str]
    component_breakdown: dict


class BatchScoreResponse(BaseModel):
    """Response for batch scoring."""
    results: List[ExamScoreResponse]
    summary: dict


# =============================================================================
# FastAPI Router
# =============================================================================

router = APIRouter(prefix="/scoring", tags=["Exam Scoring"])

# Global scorer instance (singleton pattern)
_scorer: Optional[ExamScorer] = None


def get_scorer() -> ExamScorer:
    """Dependency to get or create the ExamScorer singleton."""
    global _scorer
    if _scorer is None:
        _scorer = ExamScorer()
    return _scorer


def convert_request_to_rubric(request: ExamRubricRequest) -> ExamRubric:
    """Convert API request to internal ExamRubric model."""
    concepts = [
        ConceptDefinition(
            name=c.name,
            description=c.description,
            keywords=c.keywords,
            weight=c.weight,
            required=c.required
        )
        for c in request.concepts
    ]
    
    scale = ScoreScale.ZERO_TO_FIVE
    if request.score_scale == "0-100":
        scale = ScoreScale.ZERO_TO_HUNDRED
    elif request.score_scale == "0-1":
        scale = ScoreScale.ZERO_TO_ONE
    
    return ExamRubric(
        question_id=request.question_id,
        question_text=request.question_text,
        reference_answer=request.reference_answer,
        concepts=concepts,
        important_keywords=request.important_keywords,
        max_length=request.max_length,
        min_length=request.min_length,
        weights=request.weights,
        score_scale=scale
    )


def convert_request_to_answer(request: StudentAnswerRequest) -> StudentAnswer:
    """Convert API request to internal StudentAnswer model."""
    return StudentAnswer(
        student_id=request.student_id,
        question_id=request.question_id,
        answer_text=request.answer_text,
        submitted_at=request.submitted_at,
        metadata=request.metadata or {}
    )


def convert_result_to_response(result: ExamScoreResult) -> ExamScoreResponse:
    """Convert internal result to API response model."""
    return ExamScoreResponse(
        semantic_score=result.semantic_score,
        concept_score=result.concept_score,
        keyword_score=result.keyword_score,
        final_score=result.final_score,
        normalized_score=result.normalized_score,
        missing_concepts=result.missing_concepts,
        present_concepts=result.present_concepts,
        found_keywords=result.found_keywords,
        missing_keywords=result.missing_keywords,
        feedback=result.feedback,
        grading_explanation=result.grading_explanation,
        warnings=result.warnings,
        component_breakdown=result.component_breakdown
    )


# =============================================================================
# API Endpoints
# =============================================================================

@router.post("/score", response_model=ExamScoreResponse)
async def score_exam_answer(
    request: ScoreExamRequest,
    scorer: ExamScorer = Depends(get_scorer)
) -> ExamScoreResponse:
    """
    Score a single exam answer against a rubric.
    
    Returns comprehensive scoring results including:
    - Component scores (semantic, concept, keyword)
    - Final score on requested scale
    - Student feedback
    - Teacher grading explanation
    - Anti-cheating warnings
    """
    try:
        rubric = convert_request_to_rubric(request.rubric)
        answer = convert_request_to_answer(request.answer)
        
        result = scorer.score(answer, rubric)
        
        return convert_result_to_response(result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {str(e)}")


@router.post("/score/batch", response_model=BatchScoreResponse)
async def score_batch(
    request: BatchScoreRequest,
    scorer: ExamScorer = Depends(get_scorer)
) -> BatchScoreResponse:
    """
    Score multiple answers against the same rubric.
    
    Useful for grading entire exam submissions efficiently.
    """
    try:
        rubric = convert_request_to_rubric(request.rubric)
        answers = [convert_request_to_answer(a) for a in request.answers]
        
        # Score all answers
        results = scorer.batch_score(answers, [rubric] * len(answers))
        
        # Convert to responses
        responses = [convert_result_to_response(r) for r in results]
        
        # Calculate summary statistics
        scores = [r.final_score for r in results]
        summary = {
            "total_scored": len(results),
            "average_score": sum(scores) / len(scores) if scores else 0,
            "min_score": min(scores) if scores else 0,
            "max_score": max(scores) if scores else 0,
            "warning_count": sum(len(r.warnings) for r in results)
        }
        
        return BatchScoreResponse(results=responses, summary=summary)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch scoring failed: {str(e)}")


@router.post("/explain")
async def explain_score_detailed(
    request: ScoreExamRequest,
    detail_level: str = "detailed",
    scorer: ExamScorer = Depends(get_scorer)
) -> dict:
    """
    Get detailed human-readable explanation of a score.
    
    detail_level: "brief", "standard", or "detailed"
    """
    try:
        rubric = convert_request_to_rubric(request.rubric)
        answer = convert_request_to_answer(request.answer)
        
        result = scorer.score(answer, rubric)
        explanation = scorer.explain_score(result, detail_level)
        
        return {
            "explanation": explanation,
            "detail_level": detail_level,
            "question_id": rubric.question_id,
            "student_id": answer.student_id
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explanation failed: {str(e)}")


# =============================================================================
# Example Integration into Main FastAPI App
# =============================================================================

"""
In your main FastAPI application file (e.g., main.py or api.py):

```python
from fastapi import FastAPI
from scoring.fastapi_integration import router as scoring_router

app = FastAPI(title="Cognify Engine", version="1.0")

# Include the scoring router
app.include_router(scoring_router)

# ... other routers and configuration
```

Example curl request:

curl -X POST "http://localhost:8000/scoring/score" \
  -H "Content-Type: application/json" \
  -d '{
    "rubric": {
      "question_id": "q1",
      "question_text": "Explain normalization",
      "reference_answer": "Normalization reduces redundancy",
      "concepts": [
        {
          "name": "redundancy",
          "description": "Reducing data duplication",
          "keywords": ["redundancy", "duplication"],
          "weight": 1.0,
          "required": true
        }
      ],
      "important_keywords": ["normalization", "redundancy"],
      "score_scale": "0-5"
    },
    "answer": {
      "student_id": "s1",
      "question_id": "q1",
      "answer_text": "Normalization helps reduce data redundancy in databases."
    }
  }'
"""

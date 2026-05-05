"""
FastAPI routes for scoring and rubric management.

Consolidated endpoints for exam scoring and rubric generation.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from scoring import ExamScorer, StudentAnswer, ExamRubric, ConceptDefinition
from scoring.rubric import RubricGenerator, RubricStore
from scoring.adaptive import extract_learning_gaps


router = APIRouter(prefix="/scoring", tags=["Exam Scoring"])

# Singletons
_scorer: Optional[ExamScorer] = None
_generator: Optional[RubricGenerator] = None
_store: Optional[RubricStore] = None


def get_scorer() -> ExamScorer:
    global _scorer
    if _scorer is None:
        _scorer = ExamScorer()
    return _scorer


def get_generator() -> RubricGenerator:
    global _generator
    if _generator is None:
        _generator = RubricGenerator()
    return _generator


def get_store() -> RubricStore:
    global _store
    if _store is None:
        _store = RubricStore()
    return _store


# =============================================================================
# Schemas
# =============================================================================

class ScoreAnswerRequest(BaseModel):
    """Score a student answer."""
    student_id: str
    question_id: str
    answer_text: str
    rubric: Optional[Dict[str, Any]] = None  # If not provided, will fetch from store


class ScoreResultResponse(BaseModel):
    """Scoring result."""
    student_id: str
    question_id: str
    final_score: float
    semantic_score: float
    concept_score: float
    keyword_score: float
    present_concepts: List[str]
    missing_concepts: List[str]
    feedback: str
    grading_explanation: str


class GenerateRubricRequest(BaseModel):
    """Generate a rubric for a question."""
    question_id: str
    question_text: str
    context_chunks: Optional[List[Dict[str, Any]]] = None
    subject_id: Optional[str] = None
    subject_matter: Optional[str] = None


class RubricResponse(BaseModel):
    """Generated rubric."""
    question_id: str
    reference_answer: str
    concepts: List[Dict[str, Any]]
    important_keywords: List[str]
    keyword_synonyms: Dict[str, List[str]]
    generation_confidence: float


class LearningGapsResponse(BaseModel):
    """Learning gaps analysis."""
    missing_concepts: List[str]
    present_concepts: List[str]
    weak_areas: List[Dict[str, Any]]
    strengths: List[Dict[str, Any]]
    recommendation: str
    requires_review: bool


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/score", response_model=ScoreResultResponse)
async def score_answer(
    request: ScoreAnswerRequest,
    scorer: ExamScorer = Depends(get_scorer),
    store: RubricStore = Depends(get_store)
) -> ScoreResultResponse:
    """Score a student answer using stored rubric or provided rubric."""
    
    try:
        # Get rubric
        if request.rubric:
            rubric_data = request.rubric
            rubric = ExamRubric(
                question_id=rubric_data["question_id"],
                question_text=rubric_data["question_text"],
                reference_answer=rubric_data["reference_answer"],
                concepts=[ConceptDefinition(**c) for c in rubric_data.get("concepts", [])],
                important_keywords=rubric_data.get("important_keywords", []),
                score_scale=rubric_data.get("score_scale", "0-5")
            )
        else:
            # Fetch from store
            record = store.get(request.question_id)
            if not record:
                raise HTTPException(status_code=404, detail="Rubric not found for this question")
            
            rubric = ExamRubric(
                question_id=record.question_id,
                question_text=record.question_text,
                reference_answer=record.reference_answer,
                concepts=[ConceptDefinition(**c) for c in record.concepts],
                important_keywords=record.important_keywords,
                score_scale=record.score_scale
            )
            
            # Increment usage
            store.increment_usage(request.question_id)
        
        # Score
        answer = StudentAnswer(
            student_id=request.student_id,
            question_id=request.question_id,
            answer_text=request.answer_text
        )
        
        result = scorer.score(answer, rubric)
        
        return ScoreResultResponse(
            student_id=request.student_id,
            question_id=request.question_id,
            final_score=result.final_score,
            semantic_score=result.semantic_score,
            concept_score=result.concept_score,
            keyword_score=result.keyword_score,
            present_concepts=result.present_concepts,
            missing_concepts=result.missing_concepts,
            feedback=result.feedback,
            grading_explanation=result.grading_explanation
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {str(e)}")


@router.post("/rubrics/generate", response_model=RubricResponse)
async def generate_rubric(
    request: GenerateRubricRequest,
    generator: RubricGenerator = Depends(get_generator),
    store: RubricStore = Depends(get_store)
) -> RubricResponse:
    """
    Generate and save a rubric for a question.
    
    Returns the generated rubric and stores it for later use.
    """
    
    try:
        # Generate
        rubric = await generator.generate(
            question_text=request.question_text,
            question_id=request.question_id,
            context_chunks=request.context_chunks,
            subject_matter=request.subject_matter
        )
        
        # Simple validation: just check we got data
        validation_errors = []
        quality_score = 0.7
        
        if not rubric.reference_answer:
            validation_errors.append("Missing reference answer")
            quality_score = 0.3
        if len(rubric.concepts) < 2:
            validation_errors.append("Too few concepts")
            quality_score = 0.4
        
        # Save
        record = store.save(
            rubric=rubric,
            subject_id=request.subject_id,
            quality_score=quality_score,
            validation_errors=validation_errors
        )
        
        return RubricResponse(
            question_id=rubric.question_id,
            reference_answer=rubric.reference_answer,
            concepts=[
                {
                    "name": c.name,
                    "description": c.description,
                    "keywords": c.keywords,
                    "weight": c.weight,
                    "required": c.required
                }
                for c in rubric.concepts
            ],
            important_keywords=rubric.important_keywords,
            keyword_synonyms=rubric.keyword_synonyms,
            generation_confidence=rubric.confidence_score
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rubric generation failed: {str(e)}")


@router.get("/rubrics/{question_id}")
async def get_rubric(
    question_id: str,
    store: RubricStore = Depends(get_store)
) -> Dict[str, Any]:
    """Get a stored rubric by question ID."""
    
    record = store.get(question_id)
    if not record:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    return record.to_dict()


@router.post("/analyze-gaps")
async def analyze_learning_gaps(
    score_result: Dict[str, Any],
    rubric_concepts: List[Dict[str, Any]]
) -> LearningGapsResponse:
    """
    Analyze learning gaps from a scoring result.
    
    Simple gap extraction for adaptive learning integration.
    """
    
    try:
        # Convert dict to ExamScoreResult
        from scoring.schemas import ExamScoreResult, ScoreScale
        
        result = ExamScoreResult(
            semantic_score=score_result.get("semantic_score", 0.0),
            concept_score=score_result.get("concept_score", 0.0),
            keyword_score=score_result.get("keyword_score", 0.0),
            final_score=score_result.get("final_score", 0.0),
            present_concepts=score_result.get("present_concepts", []),
            missing_concepts=score_result.get("missing_concepts", []),
            feedback=score_result.get("feedback", ""),
            grading_explanation=score_result.get("grading_explanation", ""),
            anti_cheating_penalty=score_result.get("anti_cheating_penalty", 0.0),
            detected_issues=score_result.get("detected_issues", [])
        )
        
        gaps = extract_learning_gaps(result, rubric_concepts)
        
        return LearningGapsResponse(
            missing_concepts=gaps["missing_concepts"],
            present_concepts=gaps["present_concepts"],
            weak_areas=gaps["weak_areas"],
            strengths=gaps["strengths"],
            recommendation=gaps["recommendation"],
            requires_review=gaps["requires_review"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/batch")
async def batch_score(
    requests: List[ScoreAnswerRequest],
    scorer: ExamScorer = Depends(get_scorer),
    store: RubricStore = Depends(get_store)
) -> List[ScoreResultResponse]:
    """Score multiple answers in batch."""
    
    results = []
    
    for req in requests:
        try:
            # Get rubric
            record = store.get(req.question_id)
            if not record:
                continue  # Skip missing rubrics
            
            rubric = ExamRubric(
                question_id=record.question_id,
                question_text=record.question_text,
                reference_answer=record.reference_answer,
                concepts=[ConceptDefinition(**c) for c in record.concepts],
                important_keywords=record.important_keywords,
                score_scale=record.score_scale
            )
            
            answer = StudentAnswer(
                student_id=req.student_id,
                question_id=req.question_id,
                answer_text=req.answer_text
            )
            
            result = scorer.score(answer, rubric)
            
            results.append(ScoreResultResponse(
                student_id=req.student_id,
                question_id=req.question_id,
                final_score=result.final_score,
                semantic_score=result.semantic_score,
                concept_score=result.concept_score,
                keyword_score=result.keyword_score,
                present_concepts=result.present_concepts,
                missing_concepts=result.missing_concepts,
                feedback=result.feedback,
                grading_explanation=result.grading_explanation
            ))
            
            store.increment_usage(req.question_id)
            
        except Exception as e:
            logger.error(f"Batch scoring error for {req.question_id}: {e}")
            continue
    
    return results

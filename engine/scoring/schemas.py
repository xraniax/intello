"""
Pydantic schemas for exam scoring rubrics and results.
"""

from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field, field_validator, model_validator


class ScoreScale(str, Enum):
    """Supported score scales for exam grading."""
    ZERO_TO_FIVE = "0-5"
    ZERO_TO_HUNDRED = "0-100"
    ZERO_TO_ONE = "0-1"


class ConceptDefinition(BaseModel):
    """
    Definition of a required concept for rubric-based grading.

    Attributes:
        name: Unique identifier for the concept
        description: Human-readable description of what constitutes this concept
        keywords: List of keywords/phrases that indicate presence of this concept
        weight: Importance weight (0.0-1.0), defaults to 1.0
        required: Whether this concept is mandatory for full credit
    """
    name: str = Field(..., min_length=1, description="Concept identifier")
    description: str = Field(..., min_length=1, description="Concept description")
    keywords: List[str] = Field(
        default_factory=list,
        description="Keywords/phrases indicating concept presence"
    )
    weight: float = Field(
        default=1.0,
        ge=0.0,
        le=2.0,
        description="Importance weight (0.0-2.0, higher = more important)"
    )
    required: bool = Field(
        default=True,
        description="Whether this concept is mandatory for full credit"
    )

    @field_validator("keywords")
    @classmethod
    def validate_keywords(cls, v: List[str]) -> List[str]:
        """Normalize keywords to lowercase for consistent matching."""
        return [k.lower().strip() for k in v if k.strip()]


class ExamRubric(BaseModel):
    """
    Complete rubric for evaluating a short-answer exam question.

    Attributes:
        question_id: Unique identifier for the question
        question_text: The exam question text
        reference_answer: Ideal/model answer for comparison
        concepts: List of required concepts with weights
        important_keywords: Technical terms that should be present
        keyword_weights: Optional per-keyword weights (defaults to equal weighting)
        max_length: Expected answer length in words (for anti-cheating)
        min_length: Minimum expected answer length in words
        weights: Component weights for final score calculation
        score_scale: Output score scale (0-5, 0-100, or 0-1)
    """
    question_id: str = Field(..., description="Unique question identifier")
    question_text: str = Field(..., min_length=1, description="Exam question")
    reference_answer: str = Field(
        ...,
        min_length=1,
        description="Reference/model answer for semantic comparison"
    )
    concepts: List[ConceptDefinition] = Field(
        default_factory=list,
        description="Required concepts for concept coverage scoring"
    )
    important_keywords: List[str] = Field(
        default_factory=list,
        description="Important technical terms/keywords"
    )
    keyword_weights: Optional[Dict[str, float]] = Field(
        default=None,
        description="Optional per-keyword weights"
    )
    max_length: int = Field(
        default=200,
        ge=10,
        le=1000,
        description="Expected max answer length in words"
    )
    min_length: int = Field(
        default=10,
        ge=1,
        le=500,
        description="Expected min answer length in words"
    )
    weights: Dict[str, float] = Field(
        default_factory=lambda: {
            "semantic": 0.40,
            "concept": 0.40,
            "keyword": 0.20
        },
        description="Component weights (must sum to ~1.0)"
    )
    score_scale: ScoreScale = Field(
        default=ScoreScale.ZERO_TO_FIVE,
        description="Output score scale"
    )

    @model_validator(mode="after")
    def validate_weights(self) -> "ExamRubric":
        """Ensure component weights are valid and roughly sum to 1.0."""
        weights = self.weights
        required_keys = {"semantic", "concept", "keyword"}
        if not required_keys.issubset(weights.keys()):
            raise ValueError(f"Weights must contain keys: {required_keys}")
        
        total = sum(weights.values())
        if not 0.99 <= total <= 1.01:
            raise ValueError(f"Component weights must sum to 1.0, got {total}")
        
        for key, value in weights.items():
            if not 0.0 <= value <= 1.0:
                raise ValueError(f"Weight '{key}' must be between 0.0 and 1.0")
        
        return self

    @field_validator("important_keywords")
    @classmethod
    def normalize_keywords(cls, v: List[str]) -> List[str]:
        """Normalize keywords to lowercase."""
        return [k.lower().strip() for k in v if k.strip()]


class StudentAnswer(BaseModel):
    """
    Student's submitted answer for evaluation.

    Attributes:
        student_id: Unique student identifier
        question_id: Question being answered
        answer_text: The submitted answer text
        submitted_at: ISO timestamp of submission
        metadata: Optional additional data (time spent, attempts, etc.)
    """
    student_id: str = Field(..., description="Student identifier")
    question_id: str = Field(..., description="Question identifier")
    answer_text: str = Field(..., min_length=1, description="Student's answer")
    submitted_at: Optional[str] = Field(
        default=None,
        description="ISO timestamp of submission"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Additional submission metadata"
    )

    @field_validator("answer_text")
    @classmethod
    def clean_answer(cls, v: str) -> str:
        """Basic cleaning of answer text."""
        return v.strip()


class ExamScoreResult(BaseModel):
    """
    Structured grading result for a short-answer exam question.

    Attributes:
        semantic_score: Similarity score (0.0-1.0)
        concept_score: Concept coverage score (0.0-1.0)
        keyword_score: Keyword match score (0.0-1.0)
        final_score: Weighted final score (on rubric's score_scale)
        normalized_score: Final score normalized to 0.0-1.0
        missing_concepts: List of concept names not adequately covered
        present_concepts: List of concept names that were detected
        found_keywords: List of keywords that were found
        missing_keywords: List of important keywords not found
        feedback: Student-facing feedback message
        grading_explanation: Detailed explanation for teachers/auditors
        warnings: Any anti-cheating or quality warnings
        component_breakdown: Detailed scoring breakdown
    """
    semantic_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Semantic similarity score"
    )
    concept_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Concept coverage score"
    )
    keyword_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Keyword/terminology score"
    )
    final_score: float = Field(
        ...,
        ge=0.0,
        description="Final weighted score on rubric scale"
    )
    normalized_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Final score normalized to 0.0-1.0"
    )
    missing_concepts: List[str] = Field(
        default_factory=list,
        description="Concepts not adequately covered"
    )
    present_concepts: List[str] = Field(
        default_factory=list,
        description="Concepts that were detected"
    )
    found_keywords: List[str] = Field(
        default_factory=list,
        description="Keywords found in answer"
    )
    missing_keywords: List[str] = Field(
        default_factory=list,
        description="Important keywords not found"
    )
    feedback: str = Field(
        ...,
        min_length=1,
        description="Student-facing feedback"
    )
    grading_explanation: str = Field(
        ...,
        min_length=1,
        description="Detailed explanation for teachers/auditors"
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Anti-cheating or quality warnings"
    )
    component_breakdown: Dict[str, Any] = Field(
        default_factory=dict,
        description="Detailed scoring breakdown"
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return self.model_dump()

    def to_json(self, indent: Optional[int] = None) -> str:
        """Convert to JSON string."""
        return self.model_dump_json(indent=indent)

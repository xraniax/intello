"""
Exam Scoring Module for Cognify Engine

Production-ready AI-assisted grading for short textual exam answers.

Components:
    - schemas: Pydantic models
    - core: Similarity, concepts, keywords
    - scorer: Main scoring engine
    - rubric: LLM-based rubric generation
    - adaptive: Simple gap extraction
    - routes: FastAPI endpoints

Usage:
    from scoring import ExamScorer, ExamRubric, StudentAnswer
    from scoring.rubric import RubricGenerator, RubricStore
    from scoring.adaptive import extract_learning_gaps
"""

from .schemas import (
    ExamRubric,
    ConceptDefinition,
    StudentAnswer,
    ExamScoreResult,
    ScoreScale,
)
from .scorer import ExamScorer

__all__ = [
    "ExamScorer",
    "ExamRubric",
    "ConceptDefinition",
    "StudentAnswer",
    "ExamScoreResult",
    "ScoreScale",
]

__version__ = "1.0.0"

"""
Data models for the scoring system.
"""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, validator
from enum import Enum


class ScoringMethod(str, Enum):
    """Scoring methods available in the system."""
    SEMANTIC_SIMILARITY = "semantic_similarity"
    CONCEPT_COVERAGE = "concept_coverage"
    KEYWORD_MATCHING = "keyword_matching"


class ComponentScore(BaseModel):
    """Individual scoring component result."""
    method: ScoringMethod
    score: float = Field(ge=0.0, le=1.0, description="Normalized score between 0 and 1")
    weight: float = Field(ge=0.0, le=1.0, description="Weight in final calculation")
    weighted_score: float = Field(description="Weighted contribution to final score")
    details: Dict[str, Any] = Field(default_factory=dict, description="Component-specific details")
    
    @validator('weighted_score')
    def validate_weighted_score(cls, v, values):
        if 'score' in values and 'weight' in values:
            expected = values['score'] * values['weight']
            if abs(v - expected) > 1e-6:
                raise ValueError(f"Weighted score {v} doesn't match score*weight {expected}")
        return v


class ScoringConfig(BaseModel):
    """Configuration for scoring weights and thresholds."""
    semantic_weight: float = Field(default=0.5, ge=0.0, le=1.0)
    concept_weight: float = Field(default=0.3, ge=0.0, le=1.0)
    keyword_weight: float = Field(default=0.2, ge=0.0, le=1.0)
    
    # Similarity thresholds
    semantic_threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    concept_threshold: float = Field(default=0.6, ge=0.0, le=1.0)
    keyword_threshold: float = Field(default=0.5, ge=0.0, le=1.0)
    
    # Model configurations
    similarity_model: str = Field(default="nomic-embed-text")
    max_keywords: int = Field(default=10, ge=1)
    min_concept_coverage: float = Field(default=0.3, ge=0.0, le=1.0)
    
    @validator('semantic_weight', 'concept_weight', 'keyword_weight')
    def validate_weights_sum(cls, v, values):
        # Check if all weights are present, then validate sum
        all_weights = []
        if 'semantic_weight' in values:
            all_weights.append(values['semantic_weight'])
        if 'concept_weight' in values:
            all_weights.append(values['concept_weight'])
        if 'keyword_weight' in values:
            all_weights.append(values['keyword_weight'])
        all_weights.append(v)
        
        if len(all_weights) == 3 and abs(sum(all_weights) - 1.0) > 1e-6:
            raise ValueError("Weights must sum to 1.0")
        return v


class ScoringResult(BaseModel):
    """Complete scoring result with feedback."""
    student_answer: str
    reference_answer: str
    final_score: float = Field(ge=0.0, le=1.0, description="Final weighted score")
    grade: str = Field(description="Letter grade or pass/fail designation")
    components: List[ComponentScore] = Field(description="Individual component scores")
    feedback: str = Field(description="Generated feedback for the student")
    concepts_covered: List[str] = Field(default_factory=list, description="Concepts detected in answer")
    keywords_matched: List[str] = Field(default_factory=list, description="Keywords found in answer")
    missing_concepts: List[str] = Field(default_factory=list, description="Important concepts not covered")
    processing_time_ms: float = Field(description="Total processing time in milliseconds")
    
    @validator('final_score')
    def validate_final_score(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError("Final score must be between 0 and 1")
        return v


class ConceptExtraction(BaseModel):
    """Extracted concepts with relevance scores."""
    concept: str
    relevance: float = Field(ge=0.0, le=1.0)
    category: Optional[str] = None


class KeywordMatch(BaseModel):
    """Keyword matching result."""
    keyword: str
    found: bool
    position: Optional[int] = None
    context: Optional[str] = None


class SimilarityResult(BaseModel):
    """Semantic similarity result."""
    similarity_score: float = Field(ge=0.0, le=1.0)
    embedding_distance: Optional[float] = None
    model_used: str

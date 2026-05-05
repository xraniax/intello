"""
Database model for rubric storage.

Single table for generated rubrics. Keeps it simple.
"""

import uuid
from datetime import datetime
from typing import Dict, Any, List

from sqlalchemy import Column, String, Text, Float, Integer, DateTime, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB

from database import Base


class RubricRecord(Base):
    """Stores generated rubrics for exam questions."""
    
    __tablename__ = "rubrics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Question identification
    question_id = Column(String(255), nullable=False, index=True, unique=True)
    subject_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Question content
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), default="short_answer")
    
    # Rubric content
    reference_answer = Column(Text, nullable=False)
    concepts = Column(JSONB, default=list)  # [{name, description, keywords, weight, required}]
    important_keywords = Column(JSONB, default=list)
    keyword_synonyms = Column(JSONB, default=dict)
    
    # Scoring weights (can be customized per rubric)
    scoring_weights = Column(JSONB, default=lambda: {
        "semantic": 0.40, "concept": 0.40, "keyword": 0.20
    })
    score_scale = Column(String(10), default="0-5")
    
    # Generation metadata
    generation_strategy = Column(String(50), default="llm")
    source_context_ids = Column(JSONB, default=list)
    difficulty_estimate = Column(String(20), default="medium")
    
    # Quality metrics
    generation_confidence = Column(Float, default=0.5)
    quality_score = Column(Float, nullable=True)
    validation_errors = Column(JSONB, default=list)  # Simple list of error strings
    
    # Status
    status = Column(String(20), default="active")  # active, pending, deprecated
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Usage tracking
    times_used = Column(Integer, default=0)
    last_used_at = Column(DateTime, nullable=True)
    
    # Indexes
    __table_args__ = (
        Index("ix_rubrics_subject_status", "subject_id", "status"),
    )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": str(self.id),
            "question_id": self.question_id,
            "subject_id": str(self.subject_id) if self.subject_id else None,
            "question_text": self.question_text,
            "question_type": self.question_type,
            "reference_answer": self.reference_answer,
            "concepts": self.concepts,
            "important_keywords": self.important_keywords,
            "keyword_synonyms": self.keyword_synonyms,
            "scoring_weights": self.scoring_weights,
            "score_scale": self.score_scale,
            "generation_strategy": self.generation_strategy,
            "difficulty_estimate": self.difficulty_estimate,
            "generation_confidence": self.generation_confidence,
            "quality_score": self.quality_score,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "times_used": self.times_used,
        }

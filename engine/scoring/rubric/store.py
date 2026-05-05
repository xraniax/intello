"""
Simplified rubric storage.

Single table with in-memory cache (LRU). No Redis, no versioning.
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime
from functools import lru_cache

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import SessionLocal
from .models import RubricRecord
from .generator import GeneratedRubric

logger = logging.getLogger("engine.scoring.rubric")


class RubricStore:
    """Simple rubric storage with memory cache."""
    
    def __init__(self):
        self._cache: Dict[str, RubricRecord] = {}
        logger.info("RubricStore initialized")
    
    def get(self, question_id: str) -> Optional[RubricRecord]:
        """Get rubric by question ID (from cache or DB)."""
        
        # Check memory cache
        if question_id in self._cache:
            return self._cache[question_id]
        
        # Fetch from DB
        db = SessionLocal()
        try:
            record = db.query(RubricRecord).filter(
                RubricRecord.question_id == question_id,
                RubricRecord.status == "active"
            ).first()
            
            if record:
                self._cache[question_id] = record
            
            return record
        finally:
            db.close()
    
    def save(
        self,
        rubric: GeneratedRubric,
        subject_id: Optional[str] = None,
        quality_score: Optional[float] = None,
        validation_errors: Optional[list] = None
    ) -> RubricRecord:
        """
        Save or update a rubric.
        
        Upserts: if question_id exists, updates it (no versioning).
        """
        
        db = SessionLocal()
        try:
            # Check if exists
            existing = db.query(RubricRecord).filter(
                RubricRecord.question_id == rubric.question_id
            ).first()
            
            if existing:
                # Update existing
                existing.question_text = rubric.question_text
                existing.reference_answer = rubric.reference_answer
                existing.concepts = [c.__dict__ if hasattr(c, '__dict__') else c for c in rubric.concepts]
                existing.important_keywords = rubric.important_keywords
                existing.keyword_synonyms = rubric.keyword_synonyms
                existing.generation_confidence = rubric.confidence_score
                existing.quality_score = quality_score
                existing.validation_errors = validation_errors or []
                existing.updated_at = datetime.utcnow()
                record = existing
                logger.info(f"Updated rubric for {rubric.question_id}")
            else:
                # Create new
                record = RubricRecord(
                    question_id=rubric.question_id,
                    subject_id=subject_id,
                    question_text=rubric.question_text,
                    question_type="short_answer",
                    reference_answer=rubric.reference_answer,
                    concepts=[c.__dict__ if hasattr(c, '__dict__') else c for c in rubric.concepts],
                    important_keywords=rubric.important_keywords,
                    keyword_synonyms=rubric.keyword_synonyms,
                    generation_strategy=rubric.generation_strategy.value,
                    source_context_ids=rubric.source_context_ids,
                    difficulty_estimate=rubric.difficulty_estimate,
                    generation_confidence=rubric.confidence_score,
                    quality_score=quality_score,
                    validation_errors=validation_errors or [],
                    status="active"
                )
                db.add(record)
                logger.info(f"Created rubric for {rubric.question_id}")
            
            db.commit()
            db.refresh(record)
            
            # Update cache
            self._cache[rubric.question_id] = record
            
            return record
            
        except IntegrityError as e:
            db.rollback()
            logger.error(f"Database integrity error: {e}")
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save rubric: {e}")
            raise
        finally:
            db.close()
    
    def increment_usage(self, question_id: str) -> None:
        """Increment usage counter for a rubric."""
        
        db = SessionLocal()
        try:
            record = db.query(RubricRecord).filter(
                RubricRecord.question_id == question_id
            ).first()
            
            if record:
                record.times_used += 1
                record.last_used_at = datetime.utcnow()
                db.commit()
                
                # Update cache
                self._cache[question_id] = record
        finally:
            db.close()
    
    def list_by_subject(self, subject_id: str, limit: int = 100) -> list:
        """List rubrics for a subject."""
        
        db = SessionLocal()
        try:
            records = db.query(RubricRecord).filter(
                RubricRecord.subject_id == subject_id,
                RubricRecord.status == "active"
            ).limit(limit).all()
            
            return records
        finally:
            db.close()

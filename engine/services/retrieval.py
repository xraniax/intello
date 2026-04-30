from typing import List, Optional
from sqlalchemy.orm import Session
from uuid import UUID
from sqlalchemy import select
import time
import os
from utils.logging import get_job_logger

# CONFIGURATION FLAGS
QUIZ_TOP_K = int(os.getenv("QUIZ_TOP_K", "10"))
ENABLE_RERANKING_PER_TASK = os.getenv("ENABLE_RERANKING_PER_TASK", "true").lower() == "true"

try:
    from models import Chunk, Document
except ImportError:
    from ..models import Chunk, Document

from .embeddings import embed_step
from .embedding_cache import get_cache


def retrieve_chunks_by_topic(
    session: Session,
    subject_id: UUID,
    topic: Optional[str] = None,
    top_k: int = 5,
    job_id: Optional[str] = None,
    rerank: bool = True,
    task_type: Optional[str] = None
) -> List[Chunk]:
    """
    Retrieve the top_k most relevant chunks for a given topic within a subject.
    If topic is None, returns all chunks for the subject.

    Performance optimization: Topic embeddings are cached to avoid redundant HTTP calls.
    """
    # Normalize subject_id to UUID when provided as string.
    normalized_subject_id = subject_id
    if isinstance(subject_id, str):
        try:
            normalized_subject_id = UUID(subject_id)
        except ValueError:
            return []

    # Always enforce bounded retrieval size.
    safe_top_k = top_k if isinstance(top_k, int) and top_k > 0 else 5

    log = get_job_logger(job_id, "engine-retrieval")

    # If no topic, return a bounded, deterministic sample (most recent chunks first).
    if not topic:
        return session.query(Chunk).join(Document)\
            .filter(Document.subject_id == normalized_subject_id)\
            .order_by(Chunk.created_at.desc(), Chunk.id.desc())\
            .limit(safe_top_k)\
            .all()

    log.info(f"STEP: RETRIEVAL STARTED for subject {subject_id}, topic='{topic}', task={task_type}")
    start_time = time.perf_counter()

    # Get topic embedding (cached)
    cache = get_cache()
    topic_embedding = cache.get(topic)

    if topic_embedding is None:
        topic_embedding = embed_step([topic])[0]
        if topic_embedding:
            cache.set(topic, topic_embedding)

    if topic_embedding:
        chunks = session.query(Chunk).join(Document)\
            .filter(Document.subject_id == normalized_subject_id)\
            .order_by(Chunk.embedding.cosine_distance(topic_embedding))\
            .limit(safe_top_k)\
            .all()
    else:
        chunks = session.query(Chunk).join(Document)\
            .filter(Document.subject_id == normalized_subject_id)\
            .order_by(Chunk.created_at.desc(), Chunk.id.desc())\
            .limit(safe_top_k)\
            .all()

    log.info(f"STEP: RETRIEVAL SUCCESS for subject {subject_id} (duration: {time.perf_counter() - start_time:.2f}s, retrieved: {len(chunks)})")
    return chunks

def retrieve_sequential_chunks(
    session: Session,
    subject_id: UUID,
    limit: Optional[int] = None
) -> List[Chunk]:
    """
    Retrieve all chunks for a subject sequentially for full-document analysis (e.g. Map-Reduce).
    Ordered by creation and ID ascending to reconstruct the document.
    """
    normalized_subject_id = subject_id
    if isinstance(subject_id, str):
        try:
            normalized_subject_id = UUID(subject_id)
        except ValueError:
            return []

    query = session.query(Chunk).join(Document)\
        .filter(Document.subject_id == normalized_subject_id)\
        .order_by(Chunk.created_at.asc(), Chunk.id.asc())
        
    if limit:
        query = query.limit(limit)
        
    return query.all()

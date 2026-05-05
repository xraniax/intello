from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from uuid import UUID
from sqlalchemy import select
import time
import os
from utils.logging import get_job_logger

# CONFIGURATION FLAGS
QUIZ_TOP_K = int(os.getenv("QUIZ_TOP_K", "10"))
ENABLE_RERANKING_PER_TASK = os.getenv("ENABLE_RERANKING_PER_TASK", "true").lower() == "true"

from models import Chunk, Document

from .embeddings import embed_step
from .embedding_cache import get_cache


from sqlalchemy import func

def retrieve_chunks_by_topic(
    session: Session,
    subject_id: UUID,
    topic: Optional[str] = None,
    material_ids: Optional[List[UUID]] = None,
    top_k: int = 5,
    job_id: Optional[str] = None,
    rerank: bool = True,
    task_type: Optional[str] = None
) -> List[tuple]:
    """
    Retrieve the top_k most relevant chunks for a given topic within a subject.
    Optionally filter by material_ids (UUIDs).
    Returns a list of (Chunk, similarity_score) tuples.
    """

    # ... (same UUID normalization logic)
    normalized_subject_id = subject_id
    if isinstance(subject_id, str):
        try:
            normalized_subject_id = UUID(subject_id)
        except ValueError:
            return []

    safe_top_k = top_k if isinstance(top_k, int) and top_k > 0 else 5
    log = get_job_logger(job_id, "engine-retrieval")

    if not topic:
        chunks = session.query(Chunk).options(joinedload(Chunk.document)).join(Document)\
            .filter(Document.subject_id == normalized_subject_id)\
            .order_by(Chunk.created_at.desc(), Chunk.id.desc())\
            .limit(safe_top_k)\
            .all()
        return [(c, 0.0) for c in chunks]

    log.info(f"STEP: RETRIEVAL STARTED for subject {subject_id}, topic='{topic}', task={task_type}")
    start_time = time.perf_counter()

    cache = get_cache()
    topic_embedding = cache.get(topic)

    if topic_embedding is None:
        topic_embedding = embed_step([topic])[0]
        if topic_embedding:
            cache.set(topic, topic_embedding)

    if topic_embedding:
        # Calculate cosine distance and convert to similarity (1 - distance)
        distance_col = Chunk.embedding.cosine_distance(topic_embedding)
        
        query = session.query(Chunk, (1 - distance_col).label("similarity"))\
            .options(joinedload(Chunk.document))\
            .join(Document)\
            .filter(Document.subject_id == normalized_subject_id)\
            .filter(Chunk.embedding.isnot(None))

        if material_ids:
            query = query.filter(Document.material_id.in_(material_ids))
            
        results = query.order_by(distance_col)\
            .limit(safe_top_k)\
            .all()
        
        chunks_with_scores = [(r[0], float(r[1])) for r in results if r[1] is not None]


    else:
        query = session.query(Chunk).options(joinedload(Chunk.document)).join(Document)\
            .filter(Document.subject_id == normalized_subject_id)

        if material_ids:
            query = query.filter(Document.material_id.in_(material_ids))

        chunks = query.order_by(Chunk.created_at.desc(), Chunk.id.desc())\
            .limit(safe_top_k)\
            .all()
        chunks_with_scores = [(c, 0.0) for c in chunks]


    log.info(f"STEP: RETRIEVAL SUCCESS for subject {subject_id} (duration: {time.perf_counter() - start_time:.2f}s, retrieved: {len(chunks_with_scores)})")
    return chunks_with_scores

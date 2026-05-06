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
    top_k: int = 5,
    material_ids: Optional[List[UUID]] = None,
    job_id: Optional[str] = None,
    rerank: bool = True,
    task_type: Optional[str] = None,
    source_filenames: Optional[List[str]] = None
) -> List[tuple]:
    """
    Retrieve the top_k most relevant chunks for a given topic within a subject.
    Optionally filter by material_ids (UUIDs) or source_filenames.
    Returns a list of (Chunk, similarity_score) tuples.
    
    Performance optimization: Topic embeddings are cached to avoid redundant HTTP calls.
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

    fn_filter = [f for f in (source_filenames or []) if f and isinstance(f, str)]
    
    # Ensure material_ids are UUID objects if present
    m_ids = []
    if material_ids:
        for mid in material_ids:
            if isinstance(mid, str):
                try: m_ids.append(UUID(mid))
                except: pass
            elif isinstance(mid, UUID):
                m_ids.append(mid)

    log.info(f"RETRIEVAL FILTERS | subject_id={normalized_subject_id} | material_ids={m_ids} | topic={topic} | file_filter={fn_filter}")

    if not topic:
        query = session.query(Chunk).options(joinedload(Chunk.document)).join(Document)\
            .filter(Document.subject_id == normalized_subject_id)
            
        if m_ids:
            query = query.filter(Document.material_id.in_(m_ids))
        elif fn_filter:
            query = query.filter(Document.filename.in_(fn_filter))
            
        chunks = query.order_by(Chunk.created_at.desc(), Chunk.id.desc())\
            .limit(safe_top_k)\
            .all()
        log.info(f"RETRIEVAL: No-topic fallback retrieved {len(chunks)} chunks")
        return [(c, 0.0) for c in chunks]

    log.info(f"STEP: RETRIEVAL STARTED for subject {subject_id}, topic='{topic}', task={task_type}, file_filter={len(fn_filter)}")
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

        if m_ids:
            query = query.filter(Document.material_id.in_(m_ids))
        elif fn_filter:
            query = query.filter(Document.filename.in_(fn_filter))
            
        results = query.order_by(distance_col)\
            .limit(safe_top_k)\
            .all()
        
        chunks_with_scores = [(r[0], float(r[1])) for r in results if r[1] is not None]


    else:
        query = session.query(Chunk).options(joinedload(Chunk.document)).join(Document)\
            .filter(Document.subject_id == normalized_subject_id)

        if m_ids:
            query = query.filter(Document.material_id.in_(m_ids))
        elif fn_filter:
            query = query.filter(Document.filename.in_(fn_filter))

        chunks = query.order_by(Chunk.created_at.desc(), Chunk.id.desc())\
            .limit(safe_top_k)\
            .all()
        chunks_with_scores = [(c, 0.0) for c in chunks]


    log.info(f"STEP: RETRIEVAL SUCCESS for subject {subject_id} (duration: {time.perf_counter() - start_time:.2f}s, retrieved: {len(chunks_with_scores)})")
    return chunks_with_scores

def retrieve_sequential_chunks(
    session: Session,
    subject_id: UUID,
    limit: Optional[int] = None,
    source_filenames: Optional[List[str]] = None,
    material_ids: Optional[List[UUID]] = None
) -> List[Chunk]:
    """
    Retrieve all chunks for a subject sequentially for full-document analysis (e.g. Map-Reduce).
    Ordered by creation and ID ascending to reconstruct the document.
    If source_filenames is provided, restricts to those engine Documents.
    """
    normalized_subject_id = subject_id
    if isinstance(subject_id, str):
        try:
            normalized_subject_id = UUID(subject_id)
        except ValueError:
            return []

    fn_filter = [f for f in (source_filenames or []) if f and isinstance(f, str)]
    
    # Ensure material_ids are UUID objects if present
    m_ids = []
    if material_ids:
        for mid in material_ids:
            if isinstance(mid, str):
                try: m_ids.append(UUID(mid))
                except: pass
            elif isinstance(mid, UUID):
                m_ids.append(mid)

    log = get_job_logger(None, "engine-retrieval-seq")
    log.info(f"RETRIEVAL FILTERS (SEQ) | subject_id={normalized_subject_id} | material_ids={m_ids} | file_filter={fn_filter} | limit={limit}")

    query = session.query(Chunk).join(Document)\
        .filter(Document.subject_id == normalized_subject_id)

    if m_ids:
        query = query.filter(Document.material_id.in_(m_ids))
    elif fn_filter:
        query = query.filter(Document.filename.in_(fn_filter))
        
    # Log SQL for diagnostic
    from sqlalchemy.dialects import postgresql
    compiled = query.statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
    log.info(f"RETRIEVAL QUERY (SEQ): {compiled}")

    query = query.order_by(Chunk.created_at.asc(), Chunk.id.asc())

    if limit:
        query = query.limit(limit)

    results = query.all()
    log.info(f"SEQUENTIAL RETRIEVAL: Found {len(results)} chunks")
    return results

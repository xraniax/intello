from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select
try:
    from models import Chunk, Document
except ImportError:
    from ..models import Chunk, Document

from .embeddings import embed_step  #Ollama embedding function

def retrieve_chunks_by_topic(
    session: Session,
    subject_id: str,
    topic: Optional[str] = None,
    top_k: int = 5
) -> List[Chunk]:
    """
    Retrieve the top_k most relevant chunks for a given topic within a subject.
    If topic is None, returns all chunks for the subject.
    """
    # if no topic, just return all chunks for the subject
    if not topic:
        return session.query(Chunk).join(Document)\
            .filter(Document.subject_id == subject_id)\
            .all()

    # 1️⃣ embed the topic
    topic_embedding = embed_step([topic])[0]  # returns list of floats

    # 2️⃣ query chunks with similarity ordering
    chunks = session.query(Chunk).join(Document)\
        .filter(Document.subject_id == subject_id)\
        .order_by(Chunk.embedding.cosine_distance(topic_embedding))\
        .limit(top_k)\
        .all()

    return chunks
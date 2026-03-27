from sqlalchemy import Column, ForeignKey, Integer, JSON, Text
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

try:
    from database import Base
except ImportError:
    from .database import Base


class Chunk(Base):
    """
    Stores text chunks and their vector embeddings for semantic search.
    Written by processor.py (AI logic) — not touched by Celery tasks.
    The engine does NOT track job status here; that responsibility belongs
    to the Node.js backend's materials table.
    """
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, index=True, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(384))
    chunk_metadata = Column(JSON, nullable=True)

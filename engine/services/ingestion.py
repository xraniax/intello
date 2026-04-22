import os
import uuid
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

try:
    from models import Document
except ImportError:
    from ..models import Document

from .bulk_insert import bulk_insert_chunks
from .document_processor import process_document

logger = logging.getLogger("engine-ingestion")


def ensure_engine_schema(session: Session) -> None:
    """Safe fallback for development: create engine tables/indexes if missing."""
    session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

    session.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                subject_id UUID NOT NULL REFERENCES subjects(id),
                filename VARCHAR NOT NULL,
                file_path VARCHAR NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    )

    session.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS chunks (
                id SERIAL PRIMARY KEY,
                document_id INTEGER NOT NULL REFERENCES documents(id),
                content TEXT NOT NULL,
                embedding vector(768) NULL,
                chunk_index INTEGER NULL,
                page_number INTEGER NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    )

    session.execute(text("CREATE INDEX IF NOT EXISTS ix_documents_subject_id ON documents(subject_id)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS ix_chunks_document_id ON chunks(document_id)"))
    session.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_chunks_embedding_hnsw
            ON chunks USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
            WHERE embedding IS NOT NULL
            """
        )
    )
    session.commit()


def create_subject(session: Session, user_id: str, name: str, description: Optional[str] = None) -> str:
    """Create a subject row and return its UUID string."""
    if not user_id:
        raise ValueError("Missing user context: user_id is required for ingestion")

    new_id = str(uuid.uuid4())
    session.execute(
        text(
            """
            INSERT INTO subjects (id, user_id, name, description, created_at, updated_at)
            VALUES (:id, :user_id, :name, :description, NOW(), NOW())
            """
        ),
        {
            "id": new_id,
            "user_id": user_id,
            "name": name,
            "description": description,
        },
    )
    session.commit()
    return new_id


def ensure_subject_exists(
    session: Session,
    *,
    subject_id: str,
    user_id: str,
) -> str:
    """Validate subject ownership and return subject_id; never create subjects in ingestion workers."""
    if not user_id:
        raise ValueError("Missing user context: user_id is required for ingestion")

    if not subject_id:
        raise ValueError("Missing subject context: subject_id is required for ingestion")

    row = session.execute(
        text(
            """
            SELECT id::text
            FROM subjects
            WHERE id = CAST(:subject_id AS UUID)
              AND user_id = CAST(:user_id AS UUID)
            LIMIT 1
            """
        ),
        {"subject_id": subject_id, "user_id": user_id},
    ).fetchone()
    if row:
        return row[0]

    raise ValueError("Invalid subject context: subject_id does not belong to user")


def _upload_type_from_doc_type(doc_type: Optional[str]) -> str:
    if doc_type == "PDF":
        return "PDF"
    return "ScannedDoc"


def _insert_upload_metadata(
    session: Session,
    *,
    user_id: str,
    subject_id: str,
    file_path: str,
    doc_type: Optional[str],
) -> Optional[str]:
    """Best-effort upload metadata insert into uploads table."""
    try:
        upload_type = _upload_type_from_doc_type(doc_type)
        row = session.execute(
            text(
                """
                INSERT INTO uploads (user_id, subject_id, type, temp_file_path, processed_at, created_at)
                VALUES (
                    CAST(:user_id AS UUID),
                    CAST(:subject_id AS UUID),
                    CAST(:upload_type AS upload_type),
                    :temp_file_path,
                    NOW(),
                    NOW()
                )
                RETURNING id::text
                """
            ),
            {
                "user_id": user_id,
                "subject_id": subject_id,
                "upload_type": upload_type,
                "temp_file_path": file_path,
            },
        ).fetchone()
        session.commit()
        return row[0] if row else None
    except Exception as e:
        session.rollback()
        logger.warning("Upload metadata insert skipped: %s", e)
        return None


def ingest_file(
    session: Session,
    *,
    file_path: str,
    user_id: str,
    subject_id: str,
    original_filename: Optional[str] = None,
    source_uri: Optional[str] = None,
    request_id: Optional[str] = None,
) -> Dict[str, Any]:
    """End-to-end ingestion: subject safety -> extract/chunk/embed -> documents/chunks persistence."""
    ensure_engine_schema(session)

    if not user_id:
        raise ValueError("Missing user context: user_id is required for ingestion")
    if not subject_id:
        raise ValueError("Missing subject context: subject_id is required for ingestion")

    resolved_subject_id = ensure_subject_exists(
        session,
        subject_id=subject_id,
        user_id=user_id,
    )

    pipeline = process_document(file_path, include_embeddings=True, request_id=request_id)

    doc = Document(
        subject_id=resolved_subject_id,
        filename=original_filename or os.path.basename(file_path),
        file_path=source_uri or file_path,
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)

    chunks = pipeline.get("chunks", [])
    embeddings = pipeline.get("embeddings", [])

    chunks_data: List[Dict[str, Any]] = []
    for i, content in enumerate(chunks):
        emb = embeddings[i] if i < len(embeddings) else None
        chunks_data.append(
            {
                "content": content,
                "embedding": emb,
                "chunk_index": i,
                "page_number": None,
            }
        )

    inserted = bulk_insert_chunks(session, doc.id, chunks_data)

    upload_id = _insert_upload_metadata(
        session,
        user_id=user_id,
        subject_id=resolved_subject_id,
        file_path=file_path,
        doc_type=pipeline.get("type"),
    )

    return {
        "status": "success",
        "subject_id": resolved_subject_id,
        "document_id": doc.id,
        "upload_id": upload_id,
        "document_type": pipeline.get("type"),
        "chunks": inserted,
    }

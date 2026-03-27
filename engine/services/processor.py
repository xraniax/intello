"""
Subject document processor: fetches documents by subject_id from DB,
preprocesses (or uses existing chunks), and returns a JSON-like structure.
"""
import os
import sys
import logging
from typing import Any, Dict, List, Optional

#to connect to the database
from sqlalchemy.orm import Session
from sqlalchemy import text

from services.preprocessing import DEFAULT_UPLOADS_DIR
from services.document_processor import process_document

logger = logging.getLogger("engine-processor")

# DB integration: expect database.SessionLocal and models.Document when running with backend
try:
    import database
    import models
    SessionLocal = database.SessionLocal
    Document = models.Document
    Chunk = models.Chunk
    logger.info("Successfully imported database and models from engine root.")
except ImportError:
    # Fallback for different execution contexts (e.g. within services/ folder)
    try:
        sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
        import database
        import models
        SessionLocal = database.SessionLocal
        Document = models.Document
        Chunk = models.Chunk
        logger.info("Successfully imported database and models via sys.path adjustment.")
    except ImportError as e:
        logger.error(f"Failed to import database/models: {e}")
        SessionLocal = None  # type: ignore[misc, assignment]
        Document = None  # type: ignore[misc, assignment]
        Chunk = None  # type: ignore[misc, assignment]


def get_db() -> Optional[Session]:
    """Create a database session. Caller must close it."""
    if SessionLocal is None:
        return None
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise


def get_subject_documents(subject_id: int, db: Optional[Session] = None) -> List[Any]:
    """
    Return all documents for the given subject_id.
    If db is provided, use it; otherwise open and close a session.
    """
    if Document is None:
        return []
    own_session = db is None
    session = db if db is not None else get_db()
    if session is None:
        return []
    try:
        return list(session.query(Document).filter(Document.subject_id == subject_id).all())
    finally:
        if own_session and session is not None:
            try:
                session.close()
            except Exception:
                pass


def _get_existing_chunks(db: Session, document_id: int) -> List[str]:
    """Return list of chunk contents for a document from the chunks table, or empty if not processed."""
    if db is None:
        return []
    try:
        result = db.execute(
            text("SELECT content FROM chunks WHERE document_id = :doc_id ORDER BY id"),
            {"doc_id": document_id},
        )
        rows = result.fetchall()
        return [row[0] or "" for row in rows]
    except Exception:
        return []


def _document_already_processed(db: Session, document_id: int) -> bool:
    """Return True if the document has at least one chunk in the DB."""
    if db is None:
        return False
    try:
        result = db.execute(
            text("SELECT 1 FROM chunks WHERE document_id = :doc_id LIMIT 1"),
            {"doc_id": document_id},
        )
        return result.fetchone() is not None
    except Exception:
        return False


def _build_document_result(
    doc: Any,
    subject_id: int,
    file_path: str,
    uploads_dir: str,
    db: Optional[Session],
    max_chunk_tokens: int = 500,
    chunk_overlap_tokens: int = 50,
) -> Dict[str, Any]:
    """
    For one document: load from file (preprocess) or from DB chunks; return chunks with metadata.
    """
    doc_id = getattr(doc, "id", None)
    filename = getattr(doc, "filename", "") or os.path.basename(file_path)
    result: Dict[str, Any] = {
        "document_id": doc_id,
        "subject_id": subject_id,
        "filename": filename,
        "processed": False,
        "from_cache": False,
        "chunks": [],
        "error": None,
    }

    # Prefer existing chunks in DB if present
    if db is not None and doc_id is not None and _document_already_processed(db, doc_id):
        existing = _get_existing_chunks(db, doc_id)
        if existing:
            result["from_cache"] = True
            result["processed"] = True
            result["chunks"] = [
                {
                    "index": i,
                    "content": content,
                    "metadata": {
                        "document_id": doc_id,
                        "subject_id": subject_id,
                        "filename": filename,
                        "chunk_index": i,
                        "from_db": True,
                    },
                }
                for i, content in enumerate(existing)
            ]
            return result

    # Preprocess from file
    logger.info(f"Preprocessing file: {file_path}")
    if not os.path.isfile(file_path):
        msg = f"File not found: {file_path}"
        logger.error(msg)
        result["error"] = msg
        return result

    try:
        # Professional Pipeline: Extraction + Chunking + Embedding
        processed = process_document(
            file_path,
            max_chunk_tokens=max_chunk_tokens,
            chunk_overlap_tokens=chunk_overlap_tokens,
        )
        logger.info(f"Preprocessed {filename} successfully.")
    except Exception as e:
        logger.error(f"Preprocessing failed for {filename}: {e}")
        result["error"] = str(e)
        return result

    chunks_raw = processed.get("chunks", [])
    doc_type = processed.get("type", "PDF")
    result["processed"] = True
    result["doc_type"] = doc_type
    result["num_chunks"] = len(chunks_raw)
    result["provider"] = processed.get("provider")
    result["model"] = processed.get("model")
    
    embeddings = processed.get("embeddings", [])
    result["embeddings"] = embeddings

    # The engine is stateless — no DB writes here.
    # Results are returned to the caller or via Celery backend.
    # The Node.js backend handles final persistence.
    result["chunks"] = [
        {
            "index": i,
            "content": chunk,
            "metadata": {
                "document_id": doc_id,
                "subject_id": subject_id,
                "filename": filename,
                "chunk_index": i,
                "doc_type": doc_type,
                "from_db": False,
            },
        }
        for i, chunk in enumerate(chunks_raw)
    ]
    return result


def process_subject(
    subject_id: int,
    *,
    uploads_dir: Optional[str] = None,
    topic: Optional[str] = None,
    max_chunk_tokens: int = 500,
    chunk_overlap_tokens: int = 50,
) -> Dict[str, Any]:
    """
    Main entry: take a subject_id, pull all documents from DB, preprocess each (if not already
    processed), chunk with metadata, and return a JSON-like structure. Handles errors gracefully.

    - subject_id: ID of the subject whose documents to process.
    - uploads_dir: Base directory for document files (default: preprocessing.DEFAULT_UPLOADS_DIR).
    - topic: If set, only include chunks whose content contains this topic (case-insensitive).
    - max_chunk_tokens, chunk_overlap_tokens: Passed to preprocessing.

    Returns a dict suitable for JSON:
      - subject_id, documents[], total_chunks, errors[]
    """
    base_dir = uploads_dir if uploads_dir is not None else DEFAULT_UPLOADS_DIR
    payload: Dict[str, Any] = {
        "subject_id": subject_id,
        "documents": [],
        "total_chunks": 0,
        "errors": [],
    }

    db = None
    try:
        db = get_db()
    except Exception as e:
        payload["errors"].append(f"Database connection failed: {e}")
        return payload

    if db is None:
        msg = "Database not configured (database.SessionLocal unavailable)."
        logger.error(msg)
        payload["errors"].append(msg)
        return payload

    logger.info(f"Fetching documents for subject_id={subject_id}")
    try:
        docs = get_subject_documents(subject_id, db=db)
        logger.info(f"Found {len(docs)} documents.")
    except Exception as e:
        logger.error(f"Failed to fetch documents for subject {subject_id}: {e}")
        payload["errors"].append(f"Failed to fetch documents for subject {subject_id}: {e}")
        return payload
    finally:
        try:
            if db is not None:
                db.close()
        except Exception:
            pass

    if not docs:
        return payload

    # Re-open a session for per-document chunk lookups and keep it for the loop
    db = None
    try:
        db = get_db()
    except Exception:
        pass

    try:
        for doc in docs:
            doc_id = getattr(doc, "id", None)
            filename = getattr(doc, "filename", "")
            if not filename:
                payload["documents"].append({
                    "document_id": doc_id,
                    "subject_id": subject_id,
                    "filename": None,
                    "processed": False,
                    "from_cache": False,
                    "chunks": [],
                    "error": "Document has no filename",
                })
                payload["errors"].append(f"Document id={doc_id}: no filename")
                continue

            file_path = os.path.join(base_dir, filename)
            doc_result = _build_document_result(
                doc,
                subject_id,
                file_path,
                base_dir,
                db,
                max_chunk_tokens=max_chunk_tokens,
                chunk_overlap_tokens=chunk_overlap_tokens,
            )

            if doc_result.get("error"):
                payload["errors"].append(f"Document id={doc_id} ({filename}): {doc_result['error']}")

            # Optional topic filter
            if topic and doc_result.get("chunks"):
                filtered = [
                    c for c in doc_result["chunks"]
                    if topic.lower() in (c.get("content") or "").lower()
                ]
                doc_result["chunks"] = filtered
                doc_result["num_chunks"] = len(filtered)

            payload["documents"].append(doc_result)
            payload["total_chunks"] += len(doc_result.get("chunks", []))
    finally:
        try:
            if db is not None:
                db.close()
        except Exception:
            pass

    return payload


# Legacy helpers for backward compatibility (e.g. build_subject_corpus, filter_by_topic)

def build_subject_corpus(subject_id: int, uploads_dir: Optional[str] = None) -> str:
    """
    Build a single corpus string from all subject documents.
    Uses process_subject and concatenates cleaned text from each document.
    """
    result = process_subject(subject_id, uploads_dir=uploads_dir)
    parts: List[str] = []
    for doc in result.get("documents", []):
        if doc.get("error"):
            continue
        for c in doc.get("chunks", []):
            content = c.get("content") or ""
            if content:
                parts.append(content)
    return "\n".join(parts)


def filter_by_topic(corpus: str, topic: Optional[str]) -> str:
    """Filter corpus paragraphs by topic (case-insensitive)."""
    if topic is None:
        return corpus
    filtered = [p for p in corpus.split("\n") if topic.lower() in p.lower()]
    return "\n".join(filtered)

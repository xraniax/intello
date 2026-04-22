import os
import logging
import time
from typing import Optional, Any
from celery_app import celery_app
import traceback

# Import services required for tasks
try:
    from database import SessionLocal
    from models import Document, Chunk
    from services.document_processor import process_document
    from services.ingestion import ingest_file
    from services.retrieval import retrieve_chunks_by_topic
    from services.generation import generate_study_material
    from services.google_drive import download_file_from_drive
    from services.bulk_insert import bulk_insert_chunks
except ImportError:
    # Ensure correct sys path if not run directly
    import sys
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from database import SessionLocal
    from models import Document, Chunk
    from services.document_processor import process_document
    from services.ingestion import ingest_file
    from services.retrieval import retrieve_chunks_by_topic
    from services.generation import generate_study_material
    from services.google_drive import download_file_from_drive
    from services.bulk_insert import bulk_insert_chunks

logger = logging.getLogger("celery-tasks")


def _normalize_generation_result(material: Any, material_type: str, topic: Optional[str], language: str, top_k: int, subject_id: str) -> dict:
    """Normalize generation output to the ai_generated_content contract only."""
    if isinstance(material, dict) and material.get("error"):
        raise RuntimeError(str(material.get("error")))

    if isinstance(material, dict) and "content" in material and "ai_generated_content" in material:
        raise ValueError("Mixed contract detected - legacy content leak")

    if isinstance(material, dict) and "ai_generated_content" in material:
        payload = material.get("ai_generated_content")
        if not isinstance(payload, dict):
            raise ValueError("Invalid engine response: ai_generated_content must be an object")
        if "content" not in payload:
            raise ValueError("Invalid engine response: ai_generated_content.content is required")

        metadata = payload.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}

        return {
            "type": payload.get("type") or material_type,
            "content": payload.get("content"),
            "metadata": {
                "model": os.getenv("OLLAMA_GENERATION_MODEL", "unknown"),
                "provider": "ollama",
                **metadata,
                "additional_info": {
                    "topic": topic,
                    "language": language,
                    "top_k": top_k,
                    "subject_id": subject_id,
                },
            },
        }

    # Legacy root-level content is explicitly rejected.
    if isinstance(material, dict) and "content" in material:
        raise ValueError("Invalid engine response: legacy field 'content' is deprecated. Expected ai_generated_content.")

    # String outputs are allowed and wrapped in the normalized schema.
    normalized_content = material if isinstance(material, str) else material

    return {
        "type": material_type,
        "content": normalized_content,
        "metadata": {
            "model": os.getenv("OLLAMA_GENERATION_MODEL", "unknown"),
            "provider": "ollama",
            "additional_info": {
                "topic": topic,
                "language": language,
                "top_k": top_k,
                "subject_id": subject_id,
            },
        },
    }

def _safe_remove(path: Optional[str]) -> None:
    if not path or not os.path.exists(path):
        return
    try:
        os.remove(path)
        logger.info("Cleaned up temporary file: %s", path)
    except OSError as e:
        logger.error("Cleanup failed for %s: %s", path, e)

@celery_app.task(bind=True, max_retries=3)
def task_process_document(
    self,
    drive_file_id: str,
    original_filename: str,
    subject_id: str,
    user_id: str,
    request_id: Optional[str] = None,
):
    """Background celery task for document extraction, chunking, embedding, and DB persistence."""
    task_id = getattr(getattr(self, "request", None), "id", None)
    started_at = time.time()
    logger.info(
        "[PIPELINE] task_start request_id=%s task_id=%s drive_file_id=%s filename=%s subject_id=%s",
        request_id,
        task_id,
        drive_file_id,
        original_filename,
        subject_id,
    )

    if not user_id:
        raise ValueError("Missing user context: user_id is required for ingestion")
    if not subject_id:
        raise ValueError("Missing subject context: subject_id is required for ingestion")
    
    tmp_path = None
    db = SessionLocal()
    try:
        logger.info(
            "[PIPELINE] drive_download_begin request_id=%s task_id=%s drive_file_id=%s",
            request_id,
            task_id,
            drive_file_id,
        )
        try:
            download_started = time.time()
            tmp_path = download_file_from_drive(drive_file_id, request_id=request_id)
            if not os.path.exists(tmp_path) or os.path.getsize(tmp_path) == 0:
                logger.warning("Downloaded file is empty: %s", tmp_path)
            logger.info(
                "[PIPELINE] drive_download_end request_id=%s task_id=%s tmp_path=%s bytes=%d elapsed_ms=%d",
                request_id,
                task_id,
                tmp_path,
                os.path.getsize(tmp_path) if tmp_path and os.path.exists(tmp_path) else 0,
                int((time.time() - download_started) * 1000),
            )
        except Exception as e:
            logger.error("Drive download error: %s", e)
            raise self.retry(exc=e, countdown=15)
            
        logger.info(
            "[PIPELINE] ingestion_begin request_id=%s task_id=%s tmp_path=%s",
            request_id,
            task_id,
            tmp_path,
        )
        try:
            ingest_started = time.time()
            ingest_result = ingest_file(
                db,
                file_path=tmp_path,
                user_id=user_id,
                subject_id=subject_id,
                original_filename=original_filename,
                source_uri=f"https://drive.google.com/file/d/{drive_file_id}/view",
                request_id=request_id,
            )
            logger.info(
                "[PIPELINE] ingestion_end request_id=%s task_id=%s subject_id=%s document_id=%s chunks=%s elapsed_ms=%d",
                request_id,
                task_id,
                ingest_result.get("subject_id"),
                ingest_result.get("document_id"),
                ingest_result.get("chunks"),
                int((time.time() - ingest_started) * 1000),
            )
        except Exception as e:
            db.rollback()
            logger.error("Ingestion error for %s: %s", original_filename, e)
            raise self.retry(exc=e, countdown=10)

        logger.info(
            "[PIPELINE] task_success request_id=%s task_id=%s filename=%s total_elapsed_ms=%d",
            request_id,
            task_id,
            original_filename,
            int((time.time() - started_at) * 1000),
        )
        return {
            "status": "success",
            "subject_id": ingest_result.get("subject_id"),
            "document": original_filename,
            "chunks": ingest_result.get("chunks", 0),
            "document_id": ingest_result.get("document_id"),
        }

    except Exception as e:
        logger.error(f"Task crashed for {original_filename}: {e}")
        logger.error(traceback.format_exc())
        raise self.retry(exc=e, countdown=10)
    finally:
        logger.info(
            "[PIPELINE] cleanup request_id=%s task_id=%s tmp_path=%s",
            request_id,
            task_id,
            tmp_path,
        )
        _safe_remove(tmp_path)
        db.close()


@celery_app.task(bind=True, max_retries=3)
def task_generate_material(self, subject_id: str, material_type: str, topic: Optional[str] = None, language: str = "en", top_k: int = 5, user_id: Optional[str] = None):
    """Background celery task for executing Retrieval-Augmented LLM generation."""
    logger.info("Celery task_generate_material started: subject=%s, type=%s, topic=%s", subject_id, material_type, topic)
    db = SessionLocal()
    try:
        # 1. Retrieve context chunks
        chunks = retrieve_chunks_by_topic(db, subject_id, topic, top_k)
        chunk_texts = [c.content for c in chunks if c.content]
        
        logger.info(f"Retrieved {len(chunk_texts)} chunk texts for generation.")
        
        if not chunk_texts:
            raise ValueError("No document chunks found for the given subject or topic.")
            
        # 2. Generate material (this handles its own LLM retries)
        material = generate_study_material(chunk_texts, material_type, topic, language)
        ai_generated_content = _normalize_generation_result(
            material,
            material_type,
            topic,
            language,
            top_k,
            subject_id,
        )
        
        return {
            "status": "SUCCESS",
            "material_type": material_type,
            "ai_generated_content": ai_generated_content,
        }
    except Exception as e:
        logger.exception("Task Generation failed")
        # Retry with exponential backoff on failure (likely Ollama timeout)
        raise self.retry(exc=e, countdown=2 ** self.request.retries * 15)
    finally:
        db.close()

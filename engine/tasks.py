import os
import sys
import logging
import time
import traceback
from uuid import UUID
from typing import Optional, Dict, Any, List, Union

# Must come before any local imports so Celery workers find the project root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from celery_app import celery_app
from database import SessionLocal
from services.google_drive import download_file_from_drive
from services.ingestion import ingest_file
from services.retrieval import retrieve_chunks_by_topic
from services.generation import generate_study_material
from services.summary_pipeline import generate_summary, MAP_MAX_CHUNKS as SUMMARY_MAP_MAX_CHUNKS
from services.exam_utils import normalize_exam, wrap_normalized_exam
from utils.logging import get_job_logger

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# DEPRECATED: Standardizing on utils.logging.get_job_logger
def get_job_logger_deprecated(job_id):
    return get_job_logger(job_id, "cognify-worker")


# --- REUSABLE ERROR HANDLER ---

@celery_app.task(name="tasks.task_record_failure")
def task_record_failure(request, exc, traceback, document_id, user_id=None):
    """
    Global failure handler called when any task in the chain fails.
    Logs the error and returns a structured failure dictionary.
    The result will be stored in the chain's result backend.
    """
    error_message = str(exc)
    logger.error(
        f"Chain failure for document_id={document_id}, user_id={user_id}: {error_message}"
    )
    logger.exception(exc)
    return {
        "status": "FAILED",
        "document_id": document_id,
        "user_id": user_id,
        "error": error_message
    }


# --- MODULAR PIPELINE TASKS ---

@celery_app.task(
    bind=True,
    name="tasks.task_ocr",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
    soft_time_limit=600,
    time_limit=900,
)
def task_ocr(self, file_path, document_id, subject_id, user_id=None):
    """Step 1: Extract raw text from the PDF file.
    
    Also ensures an engine Document record exists and passes the integer
    engine_doc_id downstream so task_store can persist chunks with the
    correct FK (the engine documents table uses SERIAL int, not UUID).
    """
    job_id = self.request.id
    log = get_job_logger(job_id, "tasks.ocr")
    log.info(f"STEP: OCR STARTED for {file_path} (Attempt {self.request.retries + 1}), user_id={user_id}")
    start_time = time.perf_counter()

    # --- Ensure engine Document record exists BEFORE extraction ---
    # The backend passes a UUID document_id (its own PK), but the engine's
    # documents table uses an integer PK.  We create/find the engine record here
    # so all downstream tasks can use the correct integer engine_doc_id.
    engine_doc_id = None
    try:
        from database import SessionLocal
        from models import Document as EngineDocument
        import os as _os
        filename = _os.path.basename(file_path)
        db = SessionLocal()
        try:
            # Try to find existing record by filename + subject_id
            existing = db.query(EngineDocument).filter(
                EngineDocument.subject_id == subject_id,
                EngineDocument.filename == filename,
            ).first()
            if existing:
                engine_doc_id = existing.id
                log.info(f"STEP: OCR using existing engine doc_id={engine_doc_id}")
            else:
                doc = EngineDocument(
                    subject_id=subject_id,
                    filename=filename,
                    file_path=file_path,
                )
                db.add(doc)
                db.commit()
                db.refresh(doc)
                engine_doc_id = doc.id
                log.info(f"STEP: OCR created engine doc_id={engine_doc_id} for subject={subject_id}")
        finally:
            db.close()
    except Exception as e:
        log.error(f"STEP: OCR CRITICAL - Could not create/find engine Document record: {e}")
        log.error(f"DEBUG: subject_id={subject_id} (type={type(subject_id)}), filename={filename}")
        raise ValueError(f"Failed to establish engine Document record for subject {subject_id}: {e}")

    from services.preprocessing import preprocess_step
    try:
        pre = preprocess_step(file_path, job_id=job_id)
        text = pre.get("cleaned_text", "")
        duration = time.perf_counter() - start_time
        
        if not text or len(text.strip()) == 0:
            log.warning(f"STEP: OCR FINISHED but no text was extracted (duration: {duration:.2f}s)")
            text = "" # Ensure it's a string
        else:
            log.info(f"STEP: OCR SUCCESS (duration: {duration:.2f}s, chars: {len(text)})")
        return {
            "document_id": document_id,       # backend UUID (kept for reference)
            "engine_doc_id": engine_doc_id,   # integer FK for engine chunks table
            "subject_id": subject_id,
            "user_id": user_id,
            "file_path": file_path,
            "extracted_text": text,
        }
    except Exception as e:
        log.exception(f"STEP: OCR FAILED (Attempt {self.request.retries + 1}): {str(e)}")
        raise


@celery_app.task(
    bind=True,
    name="tasks.task_chunk",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
    soft_time_limit=120,
    time_limit=150
)
def task_chunk(self, data):
    """Step 2: Split extracted text into semantic chunks."""
    job_id = self.request.id
    log = get_job_logger(job_id, "tasks.chunk")
    text = data.get("extracted_text", "")
    user_id = data.get("user_id")
    
    if not text or len(text.strip()) == 0:
        log.info("STEP: CHUNKING SKIPPED because extracted text is empty.")
        return {**data, "chunks": []}

    log.info(f"STEP: CHUNKING STARTED for {len(text)} chars (Attempt {self.request.retries + 1})")
    start_time = time.perf_counter()

    try:
        from services.preprocessing import chunk_step
        chunks = chunk_step(text, max_chunk_chars=2000, chunk_overlap=200, request_id=job_id)
        duration = time.perf_counter() - start_time
        log.info(f"STEP: CHUNKING SUCCESS (duration: {duration:.2f}s, chunks: {len(chunks)})")
        return {**data, "chunks": chunks}
    except Exception as e:
        log.exception(f"STEP: CHUNKING FAILED (Attempt {self.request.retries + 1}): {str(e)}")
        raise


@celery_app.task(
    bind=True,
    name="tasks.task_embed",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
    soft_time_limit=180,
    time_limit=210
)
def task_embed(self, data):
    """Step 3: Generate embeddings for each chunk."""
    job_id = self.request.id
    log = get_job_logger(job_id, "tasks.embed")
    chunks = data["chunks"]
    user_id = data.get("user_id")
    log.info(f"STEP: EMBEDDING STARTED for {len(chunks)} chunks (Attempt {self.request.retries + 1})")
    start_time = time.perf_counter()

    from services.embeddings import embed_step
    try:
        embeddings = embed_step(chunks, job_id=job_id)
        duration = time.perf_counter() - start_time
        log.info(f"STEP: EMBEDDING SUCCESS (duration: {duration:.2f}s)")
        return {
            **data,
            "embeddings": embeddings,
            "provider": "ollama",
            "model": "nomic-embed-text",
        }
    except Exception as e:
        log.exception(f"STEP: EMBEDDING FAILED (Attempt {self.request.retries + 1}): {str(e)}")
        raise


@celery_app.task(
    bind=True,
    name="tasks.task_store",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
    soft_time_limit=180,
    time_limit=210
)
def task_store(self, data):
    """
    Step 4: Persist chunks and embeddings to DB.
    """
    job_id = self.request.id
    from services.api import logger as api_logger
    from database import SessionLocal
    from services.processor import _persist_new_chunks
    
    document_id = data.get("document_id")       # backend UUID (for reference)
    engine_doc_id = data.get("engine_doc_id")   # integer PK in engine documents table
    subject_id = data.get("subject_id")
    chunks = data.get("chunks", [])
    embeddings = data.get("embeddings", [])
    
    api_logger.info(f"[PIPELINE] task_store RECEIVED for document_id={document_id}, engine_doc_id={engine_doc_id}, chunks={len(chunks)}")
    
    if not engine_doc_id:
        api_logger.error(f"[PIPELINE] task_store: engine_doc_id missing for document_id={document_id}. Cannot persist chunks.")
        raise ValueError(f"engine_doc_id not provided — cannot persist chunks for document_id={document_id}")

    db = SessionLocal()
    try:
        _persist_new_chunks(db, engine_doc_id, chunks, embeddings)
        
        # Mark subject as READY
        from models import Subject
        from datetime import datetime
        subject = db.query(Subject).filter(Subject.id == subject_id).first()
        if subject:
            subject.is_ready = True
            subject.last_processed_at = datetime.now()
            api_logger.info(f"[PIPELINE] task_store SUCCESS: Marked subject {subject_id} as READY")
        else:
            api_logger.warning(f"[PIPELINE] task_store: Subject {subject_id} not found in DB")

        db.commit()
        api_logger.info(f"[PIPELINE] task_store SUCCESS: Saved {len(chunks)} chunks for engine_doc_id {engine_doc_id}")
    except Exception as e:
        api_logger.exception(f"[PIPELINE] task_store FAILED for engine_doc_id {engine_doc_id}: {e}")
        db.rollback()
        raise
    finally:
        db.close()
    
    return {
        "status": "SUCCESS",
        "document_id": document_id,
        "engine_doc_id": engine_doc_id,
        "chunk_count": len(chunks),
    }


CURRENT_CONFIG_VERSION = 1

def initialize_workspace_config(subject_id: str, existing_opts: Optional[dict] = None) -> dict:
    """
    Mandatory Workspace Entry Point. 
    Eradicates drift via strict versioning and 'Heal-and-Alert' logic.
    """
    opts = existing_opts or {}
    corrections = []
    
    # 1. Version Check
    version = opts.get("config_version", 0)
    if version < CURRENT_CONFIG_VERSION:
        corrections.append(f"version_upgrade({version}->{CURRENT_CONFIG_VERSION})")
    
    # 2. Build configuration with default-or-repair logic
    config = {
        "difficulty": opts.get("difficulty", "intermediate"),
        "count": opts.get("count", opts.get("numberOfQuestions", 10)),
        "types": opts.get("types", opts.get("examTypes", [])),
        "timeout": opts.get("timeout", 300),
        "strict_fallback_immunity": True,
        "config_version": CURRENT_CONFIG_VERSION
    }
    
    # 3. Detect and repair specific corruptions
    if not isinstance(config["types"], list) or len(config["types"]) == 0:
        config["types"] = ["single_choice", "multiple_select", "short_answer"]
        corrections.append("defaulted_missing_exam_types")
        
    if not isinstance(config["count"], int) or config["count"] <= 0:
        config["count"] = 10
        corrections.append(f"repaired_invalid_count({opts.get('count')})")

    # 4. Observability: Heal-and-Alert (No silent masking)
    if corrections:
        logger.warning(
            f"[CONFIG AUDIT] Workspace {subject_id} was misconfigured or outdated. "
            f"Repairs made: {', '.join(corrections)}. "
            "Please audit upstream write path in Node.js backend."
        )
    else:
        logger.info(f"[CONFIG VALID] Workspace {subject_id} passed initialization (v{CURRENT_CONFIG_VERSION})")
        
    return config


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

    # Direct output from generate_study_material: {type, content, metadata}
    if isinstance(material, dict) and "content" in material and "type" in material:
        metadata = material.get("metadata") or {}
        if not isinstance(metadata, dict):
            metadata = {}
        return {
            "type": material.get("type") or material_type,
            "content": material.get("content"),
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

    # String outputs are allowed and wrapped in the normalized schema.
    normalized_content = material if isinstance(material, str) else material
    
    result = {
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

    if material_type == "exam":
        norm_data = normalize_exam(result)
        result = wrap_normalized_exam(result, norm_data)
    
    return result

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
    material_id: Optional[str] = None,
    request_id: Optional[str] = None,
):
    """
    Background celery task for document extraction, chunking, embedding,
    and DB persistence.
    """

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
        raise ValueError("Missing user context: user_id is required")

    if not subject_id:
        raise ValueError("Missing subject context: subject_id is required for ingestion")
    
    from database import SessionLocal
    from services.ingestion import ingest_file
    from services.google_drive import download_file_from_drive

    tmp_path = None
    db = SessionLocal()

    try:
        # ---- Drive download ----
        try:
            logger.info(
                "[PIPELINE] drive_download_begin request_id=%s task_id=%s drive_file_id=%s",
                request_id,
                task_id,
                drive_file_id,
            )

            started_download = time.time()

            tmp_path = download_file_from_drive(
                drive_file_id,
                request_id=request_id,
            )

            if not tmp_path or not os.path.exists(tmp_path):
                raise RuntimeError("Downloaded file missing after drive fetch")

            file_size = os.path.getsize(tmp_path)

            if file_size == 0:
                raise RuntimeError("Downloaded file is empty")

            logger.info(
                "[PIPELINE] drive_download_end request_id=%s task_id=%s tmp_path=%s bytes=%d elapsed_ms=%d",
                request_id,
                task_id,
                tmp_path,
                file_size,
                int((time.time() - started_download) * 1000),
            )

        except (ConnectionError, TimeoutError) as e:
            logger.warning("Transient drive error, retrying: %s", e)
            raise self.retry(exc=e, countdown=15)

        # ---- Ingestion ----
        try:
            logger.info(
                "[PIPELINE] ingestion_begin request_id=%s task_id=%s tmp_path=%s",
                request_id,
                task_id,
                tmp_path,
            )

            started_ingest = time.time()

            ingest_result = ingest_file(
                db,
                file_path=tmp_path,
                user_id=user_id,
                subject_id=subject_id,
                material_id=material_id,
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
                int((time.time() - started_ingest) * 1000),
            )

        except (ConnectionError, TimeoutError) as e:
            db.rollback()
            logger.warning("Transient ingestion error, retrying: %s", e)
            raise self.retry(exc=e, countdown=10)

        except Exception:
            db.rollback()
            raise

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
        logger.error("Task crashed for %s: %s", original_filename, e)
        logger.error(traceback.format_exc())
        raise

    finally:
        logger.info(
            "[PIPELINE] cleanup request_id=%s task_id=%s tmp_path=%s",
            request_id,
            task_id,
            tmp_path,
        )

        _safe_remove(tmp_path)

        try:
            db.close()
        except Exception:
            logger.exception("DB close failed")


@celery_app.task(bind=True, max_retries=3)
def task_process_document_local(
    self,
    local_file_path: str,
    original_filename: str,
    subject_id: str,
    user_id: str,
    material_id: Optional[str] = None,
    request_id: Optional[str] = None,
):
    """Background celery task: process a document from a local file path (Drive-free fallback)."""
    task_id = getattr(getattr(self, "request", None), "id", None)
    started_at = time.time()
    logger.info(
        "[PIPELINE] local_task_start request_id=%s task_id=%s path=%s filename=%s subject_id=%s",
        request_id, task_id, local_file_path, original_filename, subject_id,
    )

    if not user_id:
        raise ValueError("Missing user context: user_id is required for ingestion")
    if not subject_id:
        raise ValueError("Missing subject context: subject_id is required for ingestion")

    from database import SessionLocal
    from services.ingestion import ingest_file

    db = SessionLocal()
    try:
        ingest_result = ingest_file(
            db,
            file_path=local_file_path,
            user_id=user_id,
            subject_id=subject_id,
            material_id=material_id,
            original_filename=original_filename,
            request_id=request_id,
        )
        logger.info(
            "[PIPELINE] local_task_success request_id=%s task_id=%s chunks=%s elapsed_ms=%d",
            request_id, task_id, ingest_result.get("chunks", 0),
            int((time.time() - started_at) * 1000),
        )
        return {
            "status": "success",
            "subject_id": ingest_result.get("subject_id"),
            "document": original_filename,
            "chunk_count": ingest_result.get("chunks", 0),
            "chunks": ingest_result.get("chunks", 0),
            "document_id": ingest_result.get("document_id"),
        }
    except Exception as e:
        logger.error("Local task crashed for %s: %s", original_filename, e)
        logger.error(traceback.format_exc())
        raise self.retry(exc=e, countdown=10)
    finally:
        db.close()

@celery_app.task(
    bind=True,
    max_retries=3,
    soft_time_limit=1800,
    time_limit=2100,
)
def task_generate_material(
    self, 
    subject_id: str, 
    material_type: str, 
    topic: Optional[str] = None, 
    language: str = "en", 
    top_k: int = 5, 
    user_id: Optional[str] = None, 
    difficulty: str = "intermediate", 
    source_filenames: Optional[List[str]] = None,
    options: Optional[dict] = None,
    chunks: Optional[List[str]] = None,
    material_ids: Optional[List[str]] = None
):
    """Background celery task for executing Retrieval-Augmented LLM generation."""
    logger.info("Celery task_generate_material started: subject=%s, type=%s, topic=%s, difficulty=%s, filenames=%s", subject_id, material_type, topic, difficulty, source_filenames)
    
    from database import SessionLocal
    from services.retrieval import retrieve_chunks_by_topic
    from services.generation import generate_study_material
    
    db = SessionLocal()
    try:
        request_options = options if isinstance(options, dict) else {}
        effective_topic = topic or request_options.get("topic")
        effective_language = language or request_options.get("language") or "en"
        raw_count = request_options.get("count") or request_options.get("total_count")
        count = int(raw_count) if raw_count is not None and isinstance(raw_count, (int, str)) and str(raw_count).isdigit() and 1 <= int(raw_count) <= 50 else None
        if material_type == "exam":
            logger.info(f"[EXAM COUNT] {count}")

        # 1. Retrieve context chunks — scope to selected files when provided
        if chunks and isinstance(chunks, list) and len(chunks) > 0:
            chunk_texts = chunks
        elif material_type == "summary":
            from services.retrieval import retrieve_sequential_chunks
            # FIX S-1: Cap retrieval to prevent OOM on large subjects.
            chunks_with_scores = retrieve_sequential_chunks(
                db, subject_id, limit=SUMMARY_MAP_MAX_CHUNKS, 
                source_filenames=source_filenames or [],
                material_ids=material_ids
            )
            chunk_texts = [c.content for c in chunks_with_scores if c.content]
        else:
            chunks_with_scores = retrieve_chunks_by_topic(
                db, subject_id, topic, top_k, 
                source_filenames=source_filenames or [],
                material_ids=material_ids
            )
            chunk_texts = [c.content for c, _ in chunks_with_scores if c.content]

        logger.info(f"Retrieved {len(chunk_texts)} chunk texts for generation (type={material_type}).")

        if not chunk_texts:
            raise ValueError("No document chunks found for the given subject or topic.")

        # 2. Generate material — dedicated pipeline for summaries
        if material_type == "summary":
            from services.summary_pipeline import generate_summary
            material = generate_summary(
                chunk_texts,
                topic=effective_topic,
                language=effective_language,
                difficulty=difficulty,
            )
        else:
            material = generate_study_material(
                chunk_texts,
                material_type,
                effective_topic,
                effective_language,
                user_id=user_id,
                difficulty=difficulty,
                count=count
            )

        # Fast-path normalization for summary strings (S-7)
        if material_type == "summary" and isinstance(material, str):
            ai_generated_content = {
                "type": "summary",
                "content": material,
                "metadata": {
                    "model": os.getenv("OLLAMA_GENERATION_MODEL", "unknown"),
                    "provider": "ollama",
                    "additional_info": {
                        "topic": effective_topic,
                        "language": effective_language,
                        "top_k": top_k,
                        "subject_id": subject_id,
                    },
                },
            }
        else:
            ai_generated_content = _normalize_generation_result(
                material,
                material_type,
                effective_topic,
                effective_language,
                top_k,
                subject_id,
            )
        
        return {
            "status": "SUCCESS",
            "material_type": material_type,
            "ai_generated_content": ai_generated_content,
        }
    except (ValueError, KeyError, TypeError, AttributeError) as e:
        # Non-retriable: programming errors or bad input that a retry cannot fix.
        # ValueError covers "No document chunks found"; the others cover code bugs
        # that should surface immediately rather than burn retry budget.
        logger.exception("Task Generation failed with non-retriable error (%s)", type(e).__name__)
        raise
    except Exception as e:
        logger.exception("Task Generation failed")
        # Retry with exponential backoff on failure (likely Ollama timeout)
        raise self.retry(exc=e, countdown=2 ** self.request.retries * 15)
    finally:
        db.close()

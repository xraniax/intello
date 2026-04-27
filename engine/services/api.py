import os
import tempfile
import logging
import traceback
import time
import asyncio
import json
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

import requests
import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile, Request, Depends, Form, BackgroundTasks
from sqlalchemy.orm import Session
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from .preprocessing import DEFAULT_UPLOADS_DIR, preprocess_document, preprocess_uploads_folder
from .document_processor import process_document, process_text_pipeline
from .embeddings import embed_step, ollama_tags_url
from .processor import process_subject
from .retrieval import retrieve_chunks_by_topic
from .generation import generate_study_material, generate_study_material_stream, evaluate_quiz, generate_chat_response
from .ollama_config import get_ollama_base_url, get_engine_env_source
from .google_client import (
    GoogleDriveConfigError,
    GoogleDriveNotConfiguredError,
    log_google_drive_config_mode,
)
from .schemas import (
    EmbedRequest, ProcessTextRequest, RetrieveRequest, GenerateRequest,
    ChatRequest, QuizEvaluateRequest, QuizEvaluateResponse,
    QuizNextRequest, QuizSubmitAnswerRequest,
)
from .google_drive import upload_file_to_drive_from_bytes
from streaming.stream_core import stream_llm_response
from gpu_detector import detect_gpu_and_ollama
try:
    from core.normalization.status_normalizer import normalize_status
    from core.normalization.input_normalizer import (
        SUPPORTED_MATERIAL_TYPES,
        coalesce_text,
        normalize_material_type,
        parse_optional_uuid,
    )
except ImportError:
    from ..core.normalization.status_normalizer import normalize_status
    from ..core.normalization.input_normalizer import (
        SUPPORTED_MATERIAL_TYPES,
        coalesce_text,
        normalize_material_type,
        parse_optional_uuid,
    )

from celery.result import AsyncResult
try:
    import celery_app
    from tasks import task_process_document, task_generate_material
except ImportError:
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import celery_app
    from tasks import task_process_document, task_generate_material

try:
    import database
    import models
    SessionLocal = database.SessionLocal
    Document = models.Document
    Chunk = models.Chunk
except ImportError:
    from ..database import SessionLocal
    from ..models import Document, Chunk

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("engine-api")

ALLOWED_UPLOAD_SUFFIXES = frozenset({".pdf", ".png", ".jpg", ".jpeg"})

TEXT_JOB_TERMINAL_STATES = {"SUCCESS", "FAILURE", "REVOKED"}
_TEXT_JOBS: Dict[str, Dict[str, Any]] = {}
_TEXT_JOBS_LOCK = asyncio.Lock()


def _extract_stream_text_from_generation_result(result: Dict[str, Any]) -> Optional[str]:
    """Extract stream-safe text from normalized generation payload only."""
    if not isinstance(result, dict):
        return None

    has_legacy_content = "content" in result
    has_new_payload = "ai_generated_content" in result
    if has_legacy_content and has_new_payload:
        raise ValueError("Mixed contract detected - legacy content leak")

    payload = result.get("ai_generated_content")
    if not isinstance(payload, dict):
        return None

    content = payload.get("content")
    if content is None:
        return None
    if isinstance(content, str):
        return content
    return json.dumps(content, ensure_ascii=False)

app = FastAPI(
    title="Cognify Engine API",
    description="Document preprocessing, chunking, embeddings (Ollama), and subject processing.",
    version="0.2.0",
)


@app.on_event("startup")
async def startup_event():
    """Run GPU and Ollama health check on application startup."""
    logger.info("Cognify Engine API starting up...")
    logger.info(
        "[config] env=%s db=%s:%s redis=%s ollama=%s",
        get_engine_env_source(),
        os.getenv("DB_HOST", "db"),
        os.getenv("DB_PORT", "5432"),
        os.getenv("REDIS_URL", "redis://redis:6379/0"),
        get_ollama_base_url(),
    )
    log_google_drive_config_mode()

    ollama_url = ollama_tags_url()
    startup_retries = int(os.getenv("OLLAMA_STARTUP_RETRIES", "5"))
    startup_delay = float(os.getenv("OLLAMA_STARTUP_RETRY_DELAY_SECONDS", "2"))
    for attempt in range(1, startup_retries + 1):
        try:
            response = requests.get(ollama_url, timeout=5)
            response.raise_for_status()
            logger.info("✓ Ollama reachable on startup (%s)", ollama_url)
            break
        except Exception as exc:
            if attempt == startup_retries:
                logger.error(
                    "Ollama is unreachable after %d startup attempts at %s: %s",
                    startup_retries,
                    ollama_url,
                    exc,
                )
            else:
                logger.warning(
                    "Ollama not ready yet (attempt %d/%d): %s",
                    attempt,
                    startup_retries,
                    exc,
                )
                await asyncio.sleep(startup_delay)

    gpu_health = detect_gpu_and_ollama()
    
    # Store health status for later reference
    app.state.gpu_health = gpu_health
    
    if gpu_health["status"] != "healthy":
        logger.warning("⚠️  GPU/Ollama status: %s", normalize_status(gpu_health.get("status")))
        if gpu_health["recommendations"]:
            logger.warning("Please address the recommendations above to restore performance.")
    else:
        logger.info("✓ GPU/Ollama health check passed. System ready for processing.")


def _stage_error_response(
    stage: str,
    message: str,
    *,
    details: Optional[str] = None,
    status_code: int = 500,
) -> JSONResponse:
    payload = {"status": "error", "stage": stage, "message": message}
    if details:
        payload["details"] = details
    logger.error("[%s] %s%s", stage, message, f" — {details}" if details else "")
    return JSONResponse(status_code=status_code, content=payload)


async def _save_upload_to_temp(file: UploadFile) -> str:
    suffix = os.path.splitext(file.filename or "")[1].lower() or ".pdf"
    if suffix not in ALLOWED_UPLOAD_SUFFIXES:
        raise ValueError(
            "Only PDF and image files are supported (.pdf, .png, .jpg, .jpeg)."
        )
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, mode="wb") as tmp:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            tmp.write(chunk)
        return tmp.name


def _safe_remove(path: Optional[str]) -> None:
    if not path or not os.path.exists(path):
        return
    try:
        os.remove(path)
        logger.info("Cleaned up temporary file: %s", path)
    except OSError as e:
        logger.error("Cleanup failed for %s: %s", path, e)


def _all_embeddings_failed(embeddings: List[Optional[List[float]]]) -> bool:
    return bool(embeddings) and all(e is None for e in embeddings)


async def _text_job_create(metadata: Optional[Dict[str, Any]] = None) -> str:
    job_id = str(uuid4())
    now = time.time()
    job_entry = {
        "job_id": job_id,
        "status": "PENDING",
        "result": None,
        "error": None,
        "meta": metadata or {},
        "created_at": now,
        "updated_at": now,
        "source": "text",
    }
    async with _TEXT_JOBS_LOCK:
        _TEXT_JOBS[job_id] = job_entry
    return job_id


async def _text_job_get(job_id: str) -> Optional[Dict[str, Any]]:
    async with _TEXT_JOBS_LOCK:
        job = _TEXT_JOBS.get(job_id)
        return dict(job) if job else None


async def _text_job_update(job_id: str, **updates: Any) -> Optional[Dict[str, Any]]:
    async with _TEXT_JOBS_LOCK:
        job = _TEXT_JOBS.get(job_id)
        if not job:
            return None
        job.update(updates)
        job["updated_at"] = time.time()
        return dict(job)


async def _resolve_job(job_id: str) -> Dict[str, Any]:
    text_job = await _text_job_get(job_id)
    if text_job:
        logger.info("[JOB_RESOLVE] job_id=%s kind=text status=%s", job_id, text_job.get("status", "UNKNOWN"))
        return {"kind": "text", "entry": text_job}

    try:
        task_result = AsyncResult(job_id, app=celery_app.celery_app)
        logger.info("[JOB_RESOLVE] job_id=%s kind=celery status=%s", job_id, task_result.status)
        return {"kind": "celery", "entry": task_result}
    except Exception as e:
        logger.exception("[JOB_RESOLVE] job_id=%s kind=unknown error=%s", job_id, e)
        return {"kind": "unknown", "entry": None, "error": str(e)}


async def _run_text_job(
    job_id: str,
    raw_text: str,
    *,
    subject_id: Optional[str],
    document_id: Optional[str],
    user_id: Optional[str],
) -> None:
    await _text_job_update(job_id, status="STARTED")
    try:
        result = await asyncio.to_thread(
            process_text_pipeline,
            raw_text,
            max_chunk_chars=1500,
            chunk_overlap=200,
            include_embeddings=True,
        )
        extracted_text = (result.get("cleaned_text") or raw_text).strip()
        job_result = {
            "status": "SUCCESS",
            "source": "text",
            "document_id": document_id,
            "subject_id": subject_id,
            "user_id": user_id,
            "extracted_text": extracted_text,
            "chunk_count": int(result.get("num_chunks") or 0),
            "provider": "ollama",
            "model": os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text"),
        }
        # Prevent cancelled jobs from being overwritten as SUCCESS
        job_state = await _text_job_get(job_id)
        if job_state and job_state.get("status") == "REVOKED":
            logger.info("Text job %s was cancelled before completion", job_id)
            return

        await _text_job_update(job_id, status="SUCCESS", result=job_result, error=None)
    except Exception as e:
           logger.exception("Text processing job failed for job_id=%s", job_id)

    job_state = await _text_job_get(job_id)
    if job_state and job_state.get("status") == "REVOKED":
        logger.info("Cancelled text job %s exited after revoke", job_id)
        return

    await _text_job_update(
        job_id,
        status="FAILURE",
        error=str(e),
        result=None,
    )
       

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=jsonable_encoder({"status": "error", "stage": "api", "detail": exc.detail}),
        )
    logger.error("Global error: %s", exc)
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "stage": "api",
            "message": "Internal Server Error",
            "details": str(exc),
        },
    )


@app.get("/")
async def root():
    return {
        "service": "Cognify Engine",
        "docs": "/docs",
        "endpoints": {
            "preprocess": "POST /preprocess — upload file → raw_text, cleaned_text, chunks",
            "embed": "POST /embed — JSON body with text or chunks → embeddings",
            "process_text": "POST /process-text — JSON raw text → full pipeline (optional embeddings)",
            "process_document": "POST /process-document — upload → preprocess → chunk → embed",
            "process_uploads_folder": "GET /process-uploads — batch preprocess files in uploads dir",
            "process_subject": "GET /subjects/{subject_id}/process — DB-backed subject pipeline",
        },
    }


@app.get("/health")
async def health():
    try:
        ollama_response = requests.get(ollama_tags_url(), timeout=5)
        ollama_healthy = ollama_response.status_code == 200
    except Exception as e:
        logger.warning("Ollama health check failed: %s", e)
        ollama_healthy = False

    return {
        "status": "ok" if ollama_healthy else "degraded",
        "ollama": "healthy" if ollama_healthy else "unreachable",
        "engine": "healthy",
    }


@app.get("/gpu-health")
async def gpu_health():
    """Get detailed GPU and Ollama status (populated at startup)."""
    if not hasattr(app.state, "gpu_health"):
        # If startup event hasn't run yet, run detection now
        app.state.gpu_health = detect_gpu_and_ollama()
    
    return app.state.gpu_health


@app.get("/job/{job_id}")
async def get_job_status(job_id: str):
    """Check the status of a background task."""
    resolved = await _resolve_job(job_id)
    logger.info("[JOB_STATUS] job_id=%s resolved_kind=%s", job_id, resolved.get("kind"))
    if resolved["kind"] == "text":
        text_job = resolved["entry"]
        response = {
            "job_id": job_id,
            "status": text_job.get("status", "UNKNOWN"),
            "result": text_job.get("result"),
            "error": text_job.get("error"),
        }
        if text_job.get("status") == "STARTED":
            response["meta"] = text_job.get("meta") or {}
        return response

    if resolved["kind"] == "unknown":
        return {
            "job_id": job_id,
            "status": "UNKNOWN",
            "error": resolved.get("error") or "Celery not configured properly",
        }

    task_result = resolved["entry"]
    response = {
        "job_id": job_id,
        "status": task_result.status,
        "result": None,
        "error": None,
    }

    if task_result.status == "FAILURE":
        response["error"] = str(task_result.result)
    elif task_result.status == "SUCCESS":
        response["result"] = task_result.result
    elif task_result.status == "STARTED":
        response["meta"] = task_result.info

    return response


@app.post("/job/cancel")
async def cancel_job(payload: dict):
    """Request cancellation of a background Celery task by job id."""
    job_id = (payload or {}).get("job_id")
    if not job_id:
        return _stage_error_response(
            "job_cancel",
            "Missing job_id",
            status_code=400,
        )

    text_job = await _text_job_get(job_id)
    if text_job:
        if text_job.get("status") in TEXT_JOB_TERMINAL_STATES:
            return {
                "status": "success",
                "stage": "job_cancel",
                "job_id": job_id,
                "message": "Job already finished",
            }
        await _text_job_update(job_id, status="REVOKED", error="Cancelled by user")
        return {
            "status": "success",
            "stage": "job_cancel",
            "job_id": job_id,
            "message": "Cancellation requested",
        }

    try:
        celery_app.celery_app.control.revoke(job_id, terminate=False)
        return {
            "status": "success",
            "stage": "job_cancel",
            "job_id": job_id,
            "message": "Cancellation requested",
        }
    except Exception as e:
        logger.exception("Job cancellation failed")
        return _stage_error_response(
            "job_cancel",
            "Failed to cancel job",
            details=str(e),
            status_code=500,
        )


@app.get("/job/{job_id}/stream")
async def stream_job_status(job_id: str):
    """SSE stream for task status updates compatible with backend stream proxy."""
    from fastapi.responses import StreamingResponse

    async def event_generator():
        terminal_states = {"SUCCESS", "FAILURE", "REVOKED"}
        iteration = 0
        unknown_iterations = 0
        last_status = None

        while True:
            iteration += 1
            try:
                resolved = await _resolve_job(job_id)

                if resolved["kind"] == "text":
                    unknown_iterations = 0
                    text_job = resolved["entry"]
                    status = text_job.get("status", "UNKNOWN")
                    result = text_job.get("result") if status == "SUCCESS" else None
                    error = text_job.get("error") if status in {"FAILURE", "REVOKED"} else None
                    if status == "SUCCESS" and isinstance(result, dict):
                        chunk_text = (
                            result.get("extracted_text")
                            or result.get("status")
                            or "SUCCESS"
                        )
                    elif status in {"FAILURE", "REVOKED"}:
                        chunk_text = error or status
                    else:
                        chunk_text = status
                elif resolved["kind"] == "unknown":
                    unknown_iterations += 1
                    status = "UNKNOWN"
                    chunk_text = resolved.get("error") or "Celery not configured properly"
                else:
                    unknown_iterations = 0
                    task_result = resolved["entry"]
                    status = task_result.status
                    result = task_result.result if status == "SUCCESS" else None
                    error = str(task_result.result) if status == "FAILURE" else None

                    if status == "SUCCESS" and isinstance(result, dict):
                        try:
                            generation_stream = _extract_stream_text_from_generation_result(result)
                        except ValueError as contract_error:
                            payload = {
                                "chunk": str(contract_error),
                                "status": "FAILURE",
                                "is_final": True,
                            }
                            yield f"data: {json.dumps(payload)}\n\n"
                            break
                        chunk_text = generation_stream or result.get("extracted_text") or result.get("status") or "SUCCESS"
                    elif status == "FAILURE":
                        chunk_text = error or "FAILURE"
                    else:
                        chunk_text = status

                logger.info(
                    "[JOB_STREAM] job_id=%s iteration=%d kind=%s status=%s unknown_iterations=%d",
                    job_id,
                    iteration,
                    resolved.get("kind"),
                    status,
                    unknown_iterations,
                )

                if status != last_status:
                    logger.info("[JOB_STREAM] job_id=%s state_change %s -> %s", job_id, last_status, status)
                    last_status = status

                is_final = status in terminal_states
                # Keep stream open during transient resolve failures and avoid immediate close.
                if status == "UNKNOWN":
                    is_final = False

                payload = {
                    "chunk": str(chunk_text),
                    "status": status,
                    "is_final": is_final,
                }
                yield f"data: {json.dumps(payload)}\n\n"

                if payload["is_final"]:
                    break

            except Exception as e:
                logger.exception("[JOB_STREAM] job_id=%s iteration=%d stream_error=%s", job_id, iteration, e)
                payload = {
                    "chunk": f"stream iteration error: {e}",
                    "status": "UNKNOWN",
                    "is_final": False,
                }
                yield f"data: {json.dumps(payload)}\n\n"

            # Emit periodic heartbeat comment so proxies keep the stream alive.
            yield ": keep-alive\n\n"
            await asyncio.sleep(1)

        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/preprocess")
async def preprocess_route(file: UploadFile = File(..., description="PDF or image file")):
    """
    Upload a file, run extract + clean + chunk only (no Ollama).
    Returns raw_text, cleaned_text, chunks, num_chunks, and document type.
    """
    logger.info("Preprocess request for: %s", file.filename)
    tmp_path: Optional[str] = None
    try:
        try:
            tmp_path = await _save_upload_to_temp(file)
        except ValueError as e:
            return _stage_error_response(
                "preprocess",
                "Invalid or unsupported upload",
                details=str(e),
                status_code=400,
            )
        logger.info("Saved temporary file to: %s", tmp_path)
        result = preprocess_document(tmp_path)
        return {
            "status": "success",
            "stage": "preprocess",
            "filename": file.filename,
            **result,
        }
    except ValueError as e:
        return _stage_error_response(
            "preprocess",
            "Text extraction or validation failed",
            details=str(e),
            status_code=422,
        )
    except FileNotFoundError as e:
        return _stage_error_response(
            "preprocess",
            "Uploaded file missing on disk",
            details=str(e),
            status_code=400,
        )
    except Exception as e:
        logger.exception("Preprocess failed for %s", file.filename)
        return _stage_error_response(
            "preprocess",
            "Preprocessing failed",
            details=str(e),
            status_code=500,
        )
    finally:
        _safe_remove(tmp_path)


@app.post("/embed")
async def embed_route(body: EmbedRequest):
    """
    Generate embeddings using the same Ollama path as the full document pipeline.
    Send either `text` (one string) or `chunks` (list of strings).
    """
    if body.chunks is not None and len(body.chunks) > 0:
        texts = body.chunks
    else:
        texts = [body.text.strip()]
    logger.info("Embed request: %d text(s)", len(texts))
    try:
        embeddings = embed_step(texts)
    except Exception as e:
        logger.exception("Embedding stage failed")
        return _stage_error_response(
            "embedding",
            "Embedding service error",
            details=str(e),
            status_code=502,
        )

    if _all_embeddings_failed(embeddings):
        return _stage_error_response(
            "embedding",
            "All embedding requests failed (check Ollama and OLLAMA_BASE_URL)",
            status_code=502,
        )

    return {
        "status": "success",
        "stage": "embedding",
        "count": len(embeddings),
        "embeddings": embeddings,
    }


@app.post("/process-text")
async def process_text_route(body: ProcessTextRequest):
    """Run clean → chunk → optional embed on raw text (no file upload)."""
    logger.info("Process-text request, include_embeddings=%s", body.include_embeddings)
    try:
        result = process_text_pipeline(
            body.text,
            max_chunk_chars=body.max_chunk_chars,
            chunk_overlap=body.chunk_overlap,
            include_embeddings=body.include_embeddings,
        )
        out = {
            "status": "success",
            "stage": "processing",
            "message": "Text pipeline completed",
            **result,
        }
        if body.include_embeddings and _all_embeddings_failed(result.get("embeddings") or []):
            out["embedding_warning"] = (
                "all_embedding_requests_failed; check Ollama and OLLAMA_BASE_URL"
            )
            logger.error("[%s] %s", "embedding", out["embedding_warning"])
        return out
    except Exception as e:
        logger.exception("Process-text pipeline failed")
        return _stage_error_response(
            "processing",
            "Text pipeline failed",
            details=str(e),
            status_code=500,
        )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# background_process_document was moved to engine/tasks.py as task_process_document


@app.post("/process-document")
async def process_document_route(
    request: Request,
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    file_path: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
    document_id: Optional[str] = Form(None),
    subject_id: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None),
):
    """
    Upload a single file directly to Google Drive, and deploy the processing pipeline 
    to a background Celery task. Returns immediately to prevent HTTP timeouts.
    """
    request_id = str(uuid4())
    content_type = (request.headers.get("content-type") or "").lower()

    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception:
            body = {}
        if isinstance(body, dict):
            content = content if content is not None else body.get("content")
            text = text if text is not None else body.get("text")
            file_path = file_path if file_path is not None else body.get("file_path")
            document_id = document_id if document_id is not None else body.get("document_id")
            subject_id = subject_id if subject_id is not None else body.get("subject_id")
            user_id = user_id if user_id is not None else body.get("user_id")

    normalized_text = coalesce_text(content, text)

    try:
        normalized_subject_id = parse_optional_uuid(subject_id, "subject_id")
        normalized_user_id = parse_optional_uuid(user_id, "user_id")
    except ValueError as e:
        return _stage_error_response("processing", "Invalid request payload", details=str(e), status_code=400)

    if normalized_user_id is None:
        return _stage_error_response(
            "processing",
            "Missing user context: user_id is required for ingestion",
            status_code=400,
        )

    if normalized_subject_id is None:
        return _stage_error_response(
            "processing",
            "Missing subject context: subject_id is required for ingestion",
            status_code=400,
        )

    if file is None and not normalized_text:
        return _stage_error_response(
            "processing",
            "No file or raw text provided",
            details="Provide either file upload or non-empty content/text",
            status_code=400,
        )

    if file is not None and normalized_text:
        logger.warning(
            "[PIPELINE] both_file_and_text request_id=%s document_id=%s subject_id=%s; preferring file",
            request_id,
            document_id,
            normalized_subject_id,
        )

    if file is None and normalized_text:
        job_id = await _text_job_create(
            {
                "stage": "processing",
                "subject_id": normalized_subject_id,
                "document_id": document_id,
                "user_id": normalized_user_id,
                "request_id": request_id,
                "file_path": file_path,
                "mode": "text",
            }
        )
        background_tasks.add_task(
            _run_text_job,
            job_id,
            normalized_text,
            subject_id=normalized_subject_id,
            document_id=document_id,
            user_id=normalized_user_id,
        )
        return {
            "status": "accepted",
            "stage": "processing",
            "job_id": job_id,
            "message": "Text accepted. AI processing and embedding generation has started in the background.",
        }

    unique_filename = f"{uuid4()}_{file.filename}"
    started_at = time.time()
    logger.info(
        "[PIPELINE] upload_received request_id=%s filename=%s content_type=%s subject_id=%s document_id=%s user_id=%s",
        request_id,
        file.filename,
        getattr(file, "content_type", None),
        normalized_subject_id,
        document_id,
        normalized_user_id,
    )
    try:
        # Read file content once
        content = await file.read()
        logger.info(
            "[PIPELINE] upload_buffered request_id=%s filename=%s bytes=%d",
            request_id,
            file.filename,
            len(content) if content is not None else 0,
        )
        
        # Validate file type
        suffix = os.path.splitext(file.filename or "")[1].lower() or ".pdf"
        if suffix not in ALLOWED_UPLOAD_SUFFIXES:
            raise ValueError("Only PDF and image files are supported (.pdf, .png, .jpg, .jpeg).")

        # Upload to Google Drive directly from bytes (no local save)
        logger.info(
            "[PIPELINE] drive_upload_start request_id=%s unique_filename=%s",
            request_id,
            unique_filename,
        )
        google_file_id = await upload_file_to_drive_from_bytes(content, unique_filename, request_id=request_id)
        logger.info(
            "[PIPELINE] drive_upload_done request_id=%s drive_file_id=%s elapsed_ms=%d",
            request_id,
            google_file_id,
            int((time.time() - started_at) * 1000),
        )
        
    except ValueError as e:
        return _stage_error_response(
            "preprocess", "Invalid or unsupported upload", details=str(e), status_code=400
        )
    except GoogleDriveNotConfiguredError:
        return _stage_error_response(
            "preprocess",
            "Google Drive integration not configured",
            status_code=503,
        )
    except GoogleDriveConfigError as e:
        return _stage_error_response(
            "preprocess",
            "Google Drive credentials are missing or invalid",
            details=str(e),
            status_code=500,
        )
    except Exception as e:
        return _stage_error_response(
            "preprocess", "Failed to upload file to Google Drive", details=str(e), status_code=500
        )

    # Queue the celery background task, passing drive_file_id instead of temp path
    job = task_process_document.delay(
        drive_file_id=google_file_id,
        original_filename=file.filename,
        subject_id=normalized_subject_id,
        user_id=normalized_user_id,
        request_id=request_id,
    )

    logger.info(
        "[PIPELINE] celery_queued request_id=%s job_id=%s drive_file_id=%s",
        request_id,
        job.id,
        google_file_id,
    )

    return {
        "status": "accepted",
        "stage": "processing",
        "job_id": job.id,
        "filename": file.filename,
        "message": "Document uploaded to Google Drive. AI processing and embedding generation has started in the background."
    }


@app.get("/process-uploads")
async def process_uploads_route(uploads_dir: Optional[str] = None):
    try:
        results = preprocess_uploads_folder(uploads_dir=uploads_dir)
        return {
            "message": f"Processed {len(results)} file(s) from uploads.",
            "uploads_dir": uploads_dir or DEFAULT_UPLOADS_DIR,
            "results": results,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@app.get("/subjects/{subject_id}/process")
async def process_subject_route(
    subject_id: UUID,
    uploads_dir: Optional[str] = None,
    topic: Optional[str] = None,
):
    result = process_subject(
        subject_id,
        uploads_dir=uploads_dir,
        topic=topic,
    )
    return result

@app.post("/retrieve")
async def retrieve_route(body: RetrieveRequest, db: Session = Depends(get_db)):
    """Retrieve top-k relevant chunks for a given topic and subject."""
    logger.info("Retrieve request for subject: %s, topic: %s", body.subject_id, body.topic)
    try:
        chunks = retrieve_chunks_by_topic(db, str(body.subject_id), body.topic, body.top_k)
        return {
            "status": "success",
            "stage": "retrieval",
            "count": len(chunks),
            "chunks": [{"id": c.id, "content": c.content, "document_id": c.document_id} for c in chunks]
        }
    except Exception as e:
        logger.exception("Retrieval failed")
        return _stage_error_response(
            "retrieval",
            "Retrieval failed",
            details=str(e),
            status_code=500,
        )

@app.post("/chat")
async def chat_route(body: ChatRequest, db: Session = Depends(get_db)):
    """Conversational chat grounded in retrieved context."""
    logger.info("Chat request: subject=%s, query=%s", body.subject_id, body.question)
    try:
        if body.context and body.context.strip():
            context = body.context
        else:
            if body.subject_id is None:
                return _stage_error_response(
                    "chat",
                    "Missing subject_id or context",
                    status_code=400,
                )
            chunks = retrieve_chunks_by_topic(db, str(body.subject_id), None, body.top_k)
            chunk_texts = [c.content for c in chunks if c.content]
            context = "\n\n".join(chunk_texts)

        response = generate_chat_response(context, body.question, body.language)

        return {
            "status": "success",
            "stage": "chat",
            "result": response,
            "response": response,
        }
    except Exception as e:
        logger.exception("Chat failed")
        return _stage_error_response(
            "chat",
            "Chat failed",
            details=str(e),
            status_code=500,
        )

@app.post("/generate")
async def generate_route(body: GenerateRequest, db: Session = Depends(get_db)):
    """Generate study materials using LLM based on retrieved context via Celery."""
    logger.info("Generate request (async): subject=%s, type=%s, topic=%s", body.subject_id, body.material_type, body.topic)
    try:
        request_options = body.options if isinstance(body.options, dict) else {}
        topic = body.topic or request_options.get("topic")
        language = body.language or request_options.get("language") or "en"

        requested_type = (body.material_type or "").strip().lower()
        material_type = normalize_material_type(body.material_type)
        if material_type not in SUPPORTED_MATERIAL_TYPES:
            return _stage_error_response(
                "generation",
                f"Unsupported material type '{requested_type}'",
                status_code=400,
            )

        if body.subject_id is None:
            return _stage_error_response(
                "generation",
                "Missing subject_id for async generation",
                status_code=400,
            )

        # Dispatch to celery
        task = task_generate_material.delay(
            str(body.subject_id),
            material_type,
            topic,
            language,
            body.top_k,
            getattr(body, 'user_id', None),
            request_options,
        )
        
        return {
            "status": "SUCCESS",
            "stage": "generation",
            "job_id": task.id,
            "message": f"Study material generation for {body.material_type} started in background"
        }
    except Exception as e:
        logger.exception("Generation trigger failed")
        return _stage_error_response(
            "generation",
            "Study material generation failed to queue",
            details=str(e),
            status_code=500,
        )


@app.post("/generate/stream")
async def generate_stream_route(body: GenerateRequest, db: Session = Depends(get_db)):
    """Generate study materials as real-time SSE chunks (bypasses Celery)."""
    from fastapi.responses import StreamingResponse

    logger.info(
        "Generate stream request: subject=%s, type=%s, topic=%s",
        body.subject_id,
        body.material_type,
        body.topic,
    )

    request_options = body.options if isinstance(body.options, dict) else {}
    topic = body.topic or request_options.get("topic")
    language = body.language or request_options.get("language") or "en"

    requested_type = (body.material_type or "").strip().lower()
    material_type = normalize_material_type(body.material_type)
    if material_type not in SUPPORTED_MATERIAL_TYPES:
        return _stage_error_response(
            "generation_stream",
            f"Unsupported material type '{requested_type}'",
            status_code=400,
        )

    if body.subject_id is None:
        return _stage_error_response(
            "generation_stream",
            "Missing subject_id for generation stream",
            status_code=400,
        )

    try:
        chunks = retrieve_chunks_by_topic(db, str(body.subject_id), topic, body.top_k)
        chunk_texts = [c.content for c in chunks if c.content]
    except Exception as e:
        logger.exception("Generation stream retrieval failed")
        return _stage_error_response(
            "generation_stream",
            "Failed to retrieve context",
            details=str(e),
            status_code=500,
        )

    if not chunk_texts:
        return _stage_error_response(
            "generation_stream",
            "No document chunks found for the given subject or topic.",
            status_code=404,
        )

    async def generation_async_generator():
        async for piece in generate_study_material_stream(
            chunk_texts,
            material_type,
            topic,
            language,
            options=request_options,
        ):
            if piece is None:
                continue
            text = str(piece)
            if text.startswith("[ERROR]"):
                raise RuntimeError(text[7:].strip() or "Generation stream failed")
            yield text
            await asyncio.sleep(0)

    return StreamingResponse(
        stream_llm_response(generation_async_generator(), source="generation"),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@app.post("/evaluate-quiz", response_model=QuizEvaluateResponse)
async def evaluate_quiz_route(body: QuizEvaluateRequest):
    """
    Evaluate user answers for a quiz.
    The request includes the original questions (with correct answers) 
    and the user submissions.
    """
    logger.info("Evaluate quiz request: %d submissions", len(body.submissions))
    try:
        # Convert Pydantic models to dicts for the helper
        questions_dict = [q.model_dump() for q in body.questions]
        submissions_dict = [s.model_dump() for s in body.submissions]
        
        result = evaluate_quiz(questions_dict, submissions_dict)
        return result
    except Exception as e:
        logger.exception("Quiz evaluation failed")
        return _stage_error_response(
            "evaluation",
            "Quiz evaluation failed",
            details=str(e),
            status_code=500,
        )


@app.post("/quiz/next")
async def quiz_next_route(body: QuizNextRequest, db: Session = Depends(get_db)):
    """Return the first adaptive question for a session. Thin controller — logic in quiz_manager."""
    from .quiz_manager import next_question_only

    try:
        return next_question_only(
            user_id=body.user_id.strip(),
            subject_id=body.subject_id,
            topic=body.topic,
            language=body.language,
            top_k=body.top_k,
            db=db,
        )
    except ValueError as exc:
        return _stage_error_response("quiz_next", str(exc), status_code=404)
    except Exception as exc:
        logger.exception("quiz/next failed")
        return _stage_error_response("quiz_next", "Failed to fetch question", details=str(exc), status_code=500)


@app.post("/quiz/submit-answer")
async def quiz_submit_answer_route(body: QuizSubmitAnswerRequest, db: Session = Depends(get_db)):
    """Record answer, update student model, return next adaptive question. Thin controller — logic in quiz_manager."""
    from .quiz_manager import submit_answer_and_get_next

    try:
        return submit_answer_and_get_next(
            user_id=body.user_id.strip(),
            subject_id=body.subject_id,
            topic=body.topic,
            is_correct=body.is_correct,
            response_time=body.response_time,
            language=body.language,
            top_k=body.top_k,
            db=db,
        )
    except ValueError as exc:
        return _stage_error_response("quiz_submit", str(exc), status_code=404)
    except Exception as exc:
        logger.exception("quiz/submit-answer failed")
        return _stage_error_response("quiz_submit", "Failed to process answer", details=str(exc), status_code=500)


@app.post("/chat/stream")
async def chat_stream_route(body: ChatRequest, db: Session = Depends(get_db)):
    """SSE chat endpoint that streams model output progressively."""
    from fastapi.responses import StreamingResponse
    from .generation import OLLAMA_GENERATE_URL, OLLAMA_GENERATION_MODEL, OLLAMA_CHAT_TIMEOUT

    logger.info("Chat stream request: subject=%s, query=%s", body.subject_id, body.question)

    try:
        chunks = retrieve_chunks_by_topic(db, str(body.subject_id), None, body.top_k)
        chunk_texts = [c.content for c in chunks if c.content]
        context = "\n\n".join(chunk_texts)

        if not context.strip():
            async def empty_stream_error():
                raise ValueError("No context found for this subject.")
                yield ""

            return StreamingResponse(
                stream_llm_response(empty_stream_error(), source="chat"),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        prompt = (
            f"System instructions: Answer the user's question clearly and concisely based on the provided context in {body.language}. "
            f"If the answer is not in the context, say you don't know based on the provided material.\n\n"
            f"Context:\n---\n{context}\n---\n\n"
            f"User Question: {body.question}\n"
            f"Response:"
        )

        payload = {
            "model": OLLAMA_GENERATION_MODEL,
            "prompt": prompt,
            "stream": True,
        }

        async def chat_generator():
            timeout = httpx.Timeout(OLLAMA_CHAT_TIMEOUT)
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("POST", OLLAMA_GENERATE_URL, json=payload) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                        except json.JSONDecodeError:
                            continue

                        piece = chunk.get("response")
                        if isinstance(piece, str) and piece:
                            yield piece

                        if chunk.get("done") is True:
                            break

        return StreamingResponse(
            stream_llm_response(chat_generator(), source="chat"),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as e:
        logger.exception("Chat stream setup failed")
        return _stage_error_response(
            "chat_stream",
            "Chat stream failed",
            details=str(e),
            status_code=500,
        )


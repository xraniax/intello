"""Document ingestion routes: preprocess, embed, process-text, process-document, drive, uploads."""
import logging
import os
import time
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from core.normalization.input_normalizer import coalesce_text, parse_optional_uuid
from tasks import task_process_document, task_process_document_local
from .._route_utils import (
    ALLOWED_UPLOAD_SUFFIXES,
    _all_embeddings_failed,
    _safe_remove,
    _save_upload_to_temp,
    _stage_error_response,
    get_db,
)
from ..document_processor import process_text_pipeline
from ..embeddings import embed_step
from ..google_client import GoogleDriveConfigError, GoogleDriveNotConfiguredError
from ..google_drive import list_files_in_folder, upload_file_to_drive_from_bytes
from ..preprocessing import DEFAULT_UPLOADS_DIR, preprocess_document, preprocess_uploads_folder
from ..processor import process_subject
from ..schemas import EmbedRequest, ProcessTextRequest
from .jobs import _run_text_job, _text_job_create

router = APIRouter()
logger = logging.getLogger("engine-api")


@router.post("/preprocess")
async def preprocess_route(file: UploadFile = File(..., description="PDF or image file")):
    """Upload a file, run extract + clean + chunk only (no Ollama)."""
    logger.info("Preprocess request for: %s", file.filename)
    tmp_path: Optional[str] = None
    try:
        try:
            tmp_path = await _save_upload_to_temp(file)
        except ValueError as e:
            return _stage_error_response("preprocess", "Invalid or unsupported upload", details=str(e), status_code=400)
        logger.info("Saved temporary file to: %s", tmp_path)
        result = preprocess_document(tmp_path)
        return {"status": "success", "stage": "preprocess", "filename": file.filename, **result}
    except ValueError as e:
        return _stage_error_response("preprocess", "Text extraction or validation failed", details=str(e), status_code=422)
    except FileNotFoundError as e:
        return _stage_error_response("preprocess", "Uploaded file missing on disk", details=str(e), status_code=400)
    except Exception as e:
        logger.exception("Preprocess failed for %s", file.filename)
        return _stage_error_response("preprocess", "Preprocessing failed", details=str(e), status_code=500)
    finally:
        _safe_remove(tmp_path)


@router.post("/embed")
async def embed_route(body: EmbedRequest):
    """Generate embeddings via Ollama. Send `text` (single string) or `chunks` (list)."""
    texts = body.chunks if (body.chunks and len(body.chunks) > 0) else [body.text.strip()]
    logger.info("Embed request: %d text(s)", len(texts))
    try:
        embeddings = embed_step(texts)
    except Exception as e:
        logger.exception("Embedding stage failed")
        return _stage_error_response("embedding", "Embedding service error", details=str(e), status_code=502)

    if _all_embeddings_failed(embeddings):
        return _stage_error_response(
            "embedding", "All embedding requests failed (check Ollama and OLLAMA_BASE_URL)", status_code=502
        )
    return {"status": "success", "stage": "embedding", "count": len(embeddings), "embeddings": embeddings}


@router.post("/process-text")
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
        out = {"status": "success", "stage": "processing", "message": "Text pipeline completed", **result}
        if body.include_embeddings and _all_embeddings_failed(result.get("embeddings") or []):
            out["embedding_warning"] = "all_embedding_requests_failed; check Ollama and OLLAMA_BASE_URL"
            logger.error("[%s] %s", "embedding", out["embedding_warning"])
        return out
    except Exception as e:
        logger.exception("Process-text pipeline failed")
        return _stage_error_response("processing", "Text pipeline failed", details=str(e), status_code=500)


@router.post("/process-document")
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
    """Upload a file → Google Drive → background Celery processing. Returns immediately."""
    request_id = str(uuid4())
    content_type = (request.headers.get("content-type") or "").lower()

    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception:
            body = {}
        if isinstance(body, dict):
            content    = content    if content    is not None else body.get("content")
            text       = text       if text       is not None else body.get("text")
            file_path  = file_path  if file_path  is not None else body.get("file_path")
            document_id= document_id if document_id is not None else body.get("document_id")
            subject_id = subject_id if subject_id is not None else body.get("subject_id")
            user_id    = user_id    if user_id    is not None else body.get("user_id")

    normalized_text = coalesce_text(content, text)
    try:
        normalized_subject_id = parse_optional_uuid(subject_id, "subject_id")
        normalized_user_id    = parse_optional_uuid(user_id, "user_id")
    except ValueError as e:
        return _stage_error_response("processing", "Invalid request payload", details=str(e), status_code=400)

    if normalized_user_id is None:
        return _stage_error_response("processing", "Missing user context: user_id is required for ingestion", status_code=400)
    if normalized_subject_id is None:
        return _stage_error_response("processing", "Missing subject context: subject_id is required for ingestion", status_code=400)
    if file is None and not normalized_text:
        return _stage_error_response(
            "processing", "No file or raw text provided",
            details="Provide either file upload or non-empty content/text", status_code=400,
        )

    if file is not None and normalized_text:
        logger.warning(
            "[PIPELINE] both_file_and_text request_id=%s document_id=%s subject_id=%s; preferring file",
            request_id, document_id, normalized_subject_id,
        )

    if file is None and normalized_text:
        job_id = await _text_job_create({
            "stage": "processing",
            "subject_id": normalized_subject_id,
            "document_id": document_id,
            "user_id": normalized_user_id,
            "request_id": request_id,
            "file_path": file_path,
            "mode": "text",
        })
        background_tasks.add_task(
            _run_text_job, job_id, normalized_text,
            subject_id=normalized_subject_id, document_id=document_id, user_id=normalized_user_id,
        )
        return {
            "status": "accepted", "stage": "processing", "job_id": job_id,
            "message": "Text accepted. AI processing and embedding generation has started in the background.",
        }

    unique_filename = f"{uuid4()}_{file.filename}"
    started_at = time.time()
    logger.info(
        "[PIPELINE] upload_received request_id=%s filename=%s content_type=%s subject_id=%s document_id=%s user_id=%s",
        request_id, file.filename, getattr(file, "content_type", None),
        normalized_subject_id, document_id, normalized_user_id,
    )
    try:
        content = await file.read()
        logger.info("[PIPELINE] upload_buffered request_id=%s filename=%s bytes=%d",
                    request_id, file.filename, len(content) if content is not None else 0)

        suffix = os.path.splitext(file.filename or "")[1].lower() or ".pdf"
        if suffix not in ALLOWED_UPLOAD_SUFFIXES:
            raise ValueError("Only PDF and image files are supported (.pdf, .png, .jpg, .jpeg).")

        logger.info("[PIPELINE] drive_upload_start request_id=%s unique_filename=%s", request_id, unique_filename)
        google_file_id = await upload_file_to_drive_from_bytes(content, unique_filename, request_id=request_id)
        logger.info("[PIPELINE] drive_upload_done request_id=%s drive_file_id=%s elapsed_ms=%d",
                    request_id, google_file_id, int((time.time() - started_at) * 1000))

    except ValueError as e:
        return _stage_error_response("preprocess", "Invalid or unsupported upload", details=str(e), status_code=400)
    except Exception as e:
        logger.warning(
            "[PIPELINE] drive_upload_failed request_id=%s filename=%s error=%s — falling back to local processing",
            request_id, file.filename, e,
        )
        local_path = os.path.join(DEFAULT_UPLOADS_DIR, unique_filename)
        try:
            with open(local_path, "wb") as fh:
                fh.write(content)
        except OSError as write_err:
            return _stage_error_response(
                "preprocess", "File storage unavailable for local fallback", details=str(write_err), status_code=500
            )
        job = task_process_document_local.delay(
            local_file_path=local_path, original_filename=file.filename,
            subject_id=normalized_subject_id, user_id=normalized_user_id,
            material_id=document_id, request_id=request_id,
        )
        logger.info("[PIPELINE] local_fallback_queued request_id=%s job_id=%s path=%s", request_id, job.id, local_path)
        return {"status": "accepted", "stage": "processing", "job_id": job.id,
                "filename": file.filename, "message": "Document queued for local processing."}

    job = task_process_document.delay(
        drive_file_id=google_file_id, original_filename=file.filename,
        subject_id=normalized_subject_id, user_id=normalized_user_id,
        material_id=document_id, request_id=request_id,
    )

    logger.info("[PIPELINE] celery_queued request_id=%s job_id=%s drive_file_id=%s", request_id, job.id, google_file_id)
    return {
        "status": "accepted", "stage": "processing", "job_id": job.id, "filename": file.filename,
        "drive_file_id": google_file_id,
        "message": "Document uploaded to Google Drive. AI processing and embedding generation has started in the background.",
    }


@router.post("/drive/delete")
async def delete_drive_file_route(payload: dict):
    """Delete a file from Google Drive by ID."""
    file_id = payload.get("file_id")
    if not file_id:
        return _stage_error_response("drive_delete", "Missing file_id", status_code=400)
    try:
        from ..google_drive import delete_file_from_drive
        success = delete_file_from_drive(file_id)
        return {"status": "success" if success else "error", "deleted": success}
    except Exception as e:
        return _stage_error_response("drive_delete", "Failed to delete file", details=str(e), status_code=500)


@router.get("/drive/files")
async def drive_files_route():
    """List all files in the configured Google Drive folder."""
    try:
        files = list_files_in_folder()
        return {"status": "success", "files": files}
    except GoogleDriveNotConfiguredError:
        return _stage_error_response("drive", "Google Drive not configured", status_code=503)
    except GoogleDriveConfigError as e:
        return _stage_error_response("drive", "Google Drive configuration error", details=str(e), status_code=500)
    except Exception as e:
        return _stage_error_response("drive", "Failed to list Drive files", details=str(e), status_code=500)


@router.get("/process-uploads")
async def process_uploads_route(uploads_dir: Optional[str] = None):
    try:
        results = preprocess_uploads_folder(uploads_dir=uploads_dir)
        return {"message": f"Processed {len(results)} file(s) from uploads.",
                "uploads_dir": uploads_dir or DEFAULT_UPLOADS_DIR, "results": results}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/subjects/{subject_id}/process")
async def process_subject_route(subject_id: UUID, uploads_dir: Optional[str] = None, topic: Optional[str] = None):
    return process_subject(subject_id, uploads_dir=uploads_dir, topic=topic)

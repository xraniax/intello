import os
import tempfile
import logging
import traceback
from typing import List, Optional
from uuid import UUID

import requests
from fastapi import FastAPI, File, HTTPException, UploadFile, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from .preprocessing import DEFAULT_UPLOADS_DIR, preprocess_document, preprocess_uploads_folder
from .document_processor import process_document, process_text_pipeline
from .embeddings import embed_step, ollama_tags_url
from .processor import process_subject
from .schemas import EmbedRequest, ProcessTextRequest

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("engine-api")

ALLOWED_UPLOAD_SUFFIXES = frozenset({".pdf", ".png", ".jpg", ".jpeg"})

app = FastAPI(
    title="Cognify Engine API",
    description="Document preprocessing, chunking, embeddings (Ollama), and subject processing.",
    version="0.2.0",
)


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


@app.post("/process-document")
async def process_document_route(file: UploadFile = File(...)):
    """
    Upload a single file and run the full pipeline: preprocess → chunk → embed.
    Response includes prior fields plus `embeddings` when embedding succeeds (entries may be null per chunk).
    """
    logger.info("Full pipeline request for: %s", file.filename)
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
        result = process_document(tmp_path, include_embeddings=True)
        out = {
            "status": "success",
            "message": "Document processed",
            "stage": "processing",
            "filename": file.filename,
            **result,
        }
        if _all_embeddings_failed(result.get("embeddings") or []):
            out["embedding_warning"] = (
                "all_embedding_requests_failed; check Ollama and OLLAMA_BASE_URL"
            )
            logger.error("[%s] %s", "embedding", out["embedding_warning"])
        return out
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
        logger.exception("Pipeline crashed for %s", file.filename)
        return _stage_error_response(
            "processing",
            "Processing failed",
            details=str(e),
            status_code=500,
        )
    finally:
        _safe_remove(tmp_path)


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

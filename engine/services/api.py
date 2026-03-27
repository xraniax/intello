import os
import logging
import traceback
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request
from fastapi.responses import JSONResponse

from celery import chain
from celery.result import AsyncResult
from celery_app import celery_app
from tasks import (
    task_ocr,
    task_chunk,
    task_embed,
    task_store,
    task_record_failure,
    process_subject_task,
)
from services.preprocessing import DEFAULT_UPLOADS_DIR

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("engine-api")

app = FastAPI(
    title="Cognify Engine API",
    description="API for document preprocessing and processing.",
    version="0.1.0",
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error: {exc}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "Internal Server Error", "details": str(exc)},
    )


@app.get("/")
async def root():
    """Health check and API info."""
    return {
        "service": "Cognify Engine",
        "docs": "/docs",
        "endpoints": {
            "process_document": "POST /process-document (upload a file)",
            "get_job_status": "GET /job/{job_id}",
        },
    }


@app.get("/health")
async def health():
    """Simple health check."""
    return {"status": "ok"}


@app.get("/job/{job_id}")
async def get_job_status(job_id: str):
    """Check the status of a background task."""
    task_result = AsyncResult(job_id, app=celery_app)

    response = {
        "job_id": job_id,
        "status": task_result.status,  # PENDING, STARTED, SUCCESS, FAILURE
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


def _trigger_pipeline(file_path: str, document_id: Optional[str], subject_id: Optional[str]) -> str:
    """
    Build and dispatch the Celery chain:
        task_ocr → task_chunk → task_embed → task_store
    with task_record_failure wired as a link_error callback.
    Returns the chain's root task ID (used as the job_id).
    """
    pipeline = chain(
        task_ocr.s(file_path, document_id, subject_id, None),
        task_chunk.s(),
        task_embed.s(),
        task_store.s(),
    )
    # The chain's apply_async allows attaching a link_error (errback)
    # which is triggered if any task in the chain fails.
    result = pipeline.apply_async(
        link_error=task_record_failure.s(document_id, None)
    )
    return result.id


@app.post("/process-document")
async def process_document_route(
    file: Optional[UploadFile] = File(None),
    file_path: Optional[str] = Form(None),
    document_id: Optional[str] = Form(None),
    subject_id: Optional[str] = Form(None),
):
    """
    Trigger background processing for a document via the modular Celery pipeline.
    Accepts either an NFS file_path or a direct file upload.
    """
    if file_path and os.path.exists(file_path):
        logger.info(f"Triggering pipeline for NFS file: {file_path} (document_id={document_id})")
        job_id = _trigger_pipeline(file_path, document_id, subject_id)
        return {"status": "accepted", "job_id": job_id, "message": "Processing started in background"}

    if not file:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "No file or valid file_path provided."},
        )

    # HTTP upload fallback: save to shared uploads dir then process
    filename = file.filename
    target_path = os.path.join(DEFAULT_UPLOADS_DIR, f"async_{filename}")

    try:
        os.makedirs(DEFAULT_UPLOADS_DIR, exist_ok=True)
        with open(target_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                f.write(chunk)

        logger.info(f"Saved upload to {target_path}, triggering pipeline.")
        job_id = _trigger_pipeline(target_path, document_id, subject_id)
        return {"status": "accepted", "job_id": job_id, "message": "Upload success, processing started"}
    except Exception as e:
        logger.error(f"Failed to handle upload: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


@app.get("/subjects/{subject_id}/process")
async def process_subject_route(
    subject_id: str,
    uploads_dir: Optional[str] = None,
):
    """
    Trigger async processing for all documents in a subject.
    """
    logger.info(f"Triggering async subject processing for id={subject_id}")
    task = process_subject_task.delay(subject_id, uploads_dir=uploads_dir)
    return {"status": "accepted", "job_id": task.id, "message": "Subject processing task queued"}

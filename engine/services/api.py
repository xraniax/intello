import os
import tempfile
import logging
import traceback
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile, Request
from fastapi.responses import JSONResponse

from .preprocessing import (
    DEFAULT_UPLOADS_DIR,
    preprocess_document,
    preprocess_uploads_folder,
)
from .document_processor import process_document
from .processor import process_subject

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
            "process_uploads_folder": "GET /process-uploads (process all files in backend/uploads)",
        },
    }


@app.get("/health")
async def health():
    """Simple health check."""
    return {"status": "ok"}


@app.post("/process-document")
async def process_document_route(file: UploadFile = File(...)):
    """
    Upload a single file and run it through the processing pipeline.
    Returns type, raw_text, cleaned_text, chunks, and num_chunks.
    """
    logger.info(f"Received document process request for: {file.filename}")
    
    suffix = os.path.splitext(file.filename or "")[1] or ".pdf"
    if suffix.lower() != ".pdf":
        logger.warning(f"Unsupported file type: {suffix}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "Only PDF files are supported."}
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, mode='wb') as tmp:
        try:
            # Optimize: Stream the file to disk in chunks instead of loading entirely into memory
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                tmp.write(chunk)
            tmp_path = tmp.name
            logger.info(f"Saved temporary file to: {tmp_path}")
        except Exception as e:
            logger.error(f"Failed to save temporary file: {e}")
            return JSONResponse(
                status_code=500,
                content={"status": "error", "message": "Failed to save uploaded file.", "details": str(e)}
            )

    try:
        logger.info(f"Starting pipeline for: {tmp_path}")
        result = process_document(tmp_path)
        logger.info(f"Successfully processed: {file.filename}")
        return {"status": "success", "message": "Document processed", "filename": file.filename, **result}
    except Exception as e:
        logger.error(f"Pipeline crashed for {file.filename}: {e}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": "Processing failed", "details": str(e)}
        )
    finally:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
                logger.info(f"Cleaned up temporary file: {tmp_path}")
        except Exception as e:
            logger.error(f"Cleanup failed: {e}")


@app.get("/process-uploads")
async def process_uploads_route(
    uploads_dir: Optional[str] = None,
):
    """
    Process all supported documents in backend/uploads (or the given directory).
    Returns a dict mapping each filename to its preprocessing result.
    """
    try:
        results = preprocess_uploads_folder(uploads_dir=uploads_dir)
        return {
            "message": f"Processed {len(results)} file(s) from uploads.",
            "uploads_dir": uploads_dir or DEFAULT_UPLOADS_DIR,
            "results": results,
        }
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))


@app.get("/subjects/{subject_id}/process")
async def process_subject_route(
    subject_id: int,
    uploads_dir: Optional[str] = None,
    topic: Optional[str] = None,
):
    """
    Trigger the database-backed processor for a given subject.
    This uses the engine's PostgreSQL connection (service name 'db').
    """
    result = process_subject(
        subject_id,
        uploads_dir=uploads_dir,
        topic=topic,
    )
    return result

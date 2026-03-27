import os
import sys
import logging

# Ensure project root is in path for Celery workers
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from celery import chain
from celery_app import celery_app

# Structured Logging Setup
logger = logging.getLogger("cognify-worker")
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] [%(name)s] %(message)s')


class JobLoggerAdapter(logging.LoggerAdapter):
    def process(self, msg, kwargs):
        return '[JOB %s] %s' % (self.extra['job_id'], msg), kwargs


def get_job_logger(job_id):
    return JobLoggerAdapter(logger, {'job_id': job_id})


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
        f"Chain failure for document_id={document_id}: {error_message}"
    )
    return {
        "status": "FAILED",
        "document_id": document_id,
        "error": error_message
    }


# --- MODULAR PIPELINE TASKS ---

@celery_app.task(
    bind=True,
    name="tasks.task_ocr",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
    soft_time_limit=300,
    time_limit=360,
)
def task_ocr(self, file_path, document_id, subject_id, user_id=None):
    """Step 1: Extract raw text from the PDF file."""
    log = get_job_logger(self.request.id)
    log.info(f"Step: OCR started for {file_path} (Attempt {self.request.retries + 1})")
    log.info(f"File exists check: {os.path.exists(file_path)}")

    from services.preprocessing import extract_text_from_pdf
    try:
        text = extract_text_from_pdf(file_path)
        log.info(f"Step: OCR completed. Extracted {len(text)} characters.")
        return {
            "document_id": document_id,
            "subject_id": subject_id,
            "user_id": user_id,
            "file_path": file_path,
            "extracted_text": text,
        }
    except Exception as e:
        log.error(f"Step: OCR failed (Attempt {self.request.retries + 1}): {str(e)}")
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
    log = get_job_logger(self.request.id)
    text = data["extracted_text"]
    log.info(f"Step: Chunking started for {len(text)} chars (Attempt {self.request.retries + 1})")

    try:
        from services.preprocessing import _chunk_text
        chunks = _chunk_text(text, max_tokens=500, overlap_tokens=50)
        log.info(f"Step: Chunking completed. Derived {len(chunks)} chunks.")
        return {**data, "chunks": chunks}
    except Exception as e:
        log.error(f"Step: Chunking failed (Attempt {self.request.retries + 1}): {str(e)}")
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
    log = get_job_logger(self.request.id)
    chunks = data["chunks"]
    log.info(f"Step: Embedding started for {len(chunks)} chunks (Attempt {self.request.retries + 1})")

    from utils.embeddings import get_embedder
    try:
        embedder = get_embedder()
        embeddings = embedder.get_embeddings(chunks)
        log.info(f"Step: Embedding completed using {embedder.provider_name}.")
        return {
            **data,
            "embeddings": embeddings,
            "provider": embedder.provider_name,
            "model": embedder.model_name,
        }
    except Exception as e:
        log.error(f"Step: Embedding failed (Attempt {self.request.retries + 1}): {str(e)}")
        raise


@celery_app.task(
    bind=True,
    name="tasks.task_store",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
    soft_time_limit=60,
    time_limit=90
)
def task_store(self, data):
    """
    Step 4: Finalise the pipeline.
    The engine is stateless — no DB writes here. Status is reported via
    the Celery result backend (Redis). The Node.js backend polls
    /job/{job_id} and owns the materials table as the source of truth.
    """
    log = get_job_logger(self.request.id)
    document_id = data["document_id"]
    chunk_count = len(data.get("chunks", []))
    log.info(
        f"Step: Pipeline complete for document_id={document_id} (Attempt {self.request.retries + 1}). "
        f"{chunk_count} chunks processed via {data.get('provider', 'unknown')}."
    )
    return {
        "status": "SUCCESS",
        "document_id": document_id,
        "extracted_text": data["extracted_text"],
        "chunk_count": chunk_count,
        "provider": data.get("provider"),
        "model": data.get("model"),
    }


# --- LEGACY WRAPPER (subject-level processing, backward compatible) ---

@celery_app.task(name="tasks.process_subject_task")
def process_subject_task(subject_id, uploads_dir=None):
    logger.info(f"Starting legacy subject processing for subject_id={subject_id}")
    from services.processor import process_subject
    try:
        result = process_subject(subject_id, uploads_dir=uploads_dir)
        return {"status": "SUCCESS", "subject_id": subject_id, "summary": result}
    except Exception as e:
        logger.error(f"Subject task failed for {subject_id}: {str(e)}")
        return {"status": "FAILED", "error": str(e)}

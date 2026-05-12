"""Cognify Engine API — app factory. Route logic lives in services/routes/."""
import asyncio
import logging
import os
import traceback

import httpx
import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from .preprocessing import DEFAULT_UPLOADS_DIR, preprocess_document, preprocess_uploads_folder
from .document_processor import process_document, process_text_pipeline
from .embeddings import embed_step, ollama_tags_url
from .processor import process_subject
from .retrieval import retrieve_chunks_by_topic
from .generation import generate_study_material, generate_study_material_stream, evaluate_quiz, generate_chat_response
from .summary_pipeline import generate_summary_stream
from .ollama_config import get_ollama_base_url, get_engine_env_source, OLLAMA_GENERATE_URL, OLLAMA_GENERATION_MODEL
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
from .routes import chat, documents, generation, health, jobs, quiz, goals, assistant, scoring

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("engine-api")

from typing import Dict, Any, Optional
import json

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

app.include_router(health.router)
app.include_router(jobs.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(generation.router)
app.include_router(quiz.router)
app.include_router(goals.router)
app.include_router(assistant.router)
app.include_router(scoring.router, prefix="/scoring", tags=["Exam Scoring"])


def _get_db_display() -> str:
    """Return a log-safe DB host:port string parsed from DATABASE_URL."""
    from urllib.parse import urlparse
    url = os.getenv("DATABASE_URL", "")
    try:
        p = urlparse(url)
        return f"{p.hostname}:{p.port or 5432}"
    except Exception:
        return "configured"


@app.on_event("startup")
async def startup_event():
    logger.info("Cognify Engine API starting up...")
    logger.info(
        "[config] env=%s db=%s redis=%s ollama=%s",
        get_engine_env_source(),
        _get_db_display(),
        os.getenv("REDIS_URL", "redis://redis:6379/0"),
        get_ollama_base_url(),
    )
    log_google_drive_config_mode()

    ollama_url = ollama_tags_url()
    startup_retries = int(os.getenv("OLLAMA_STARTUP_RETRIES", "5"))
    startup_delay = float(os.getenv("OLLAMA_STARTUP_RETRY_DELAY_SECONDS", "2"))
    for attempt in range(1, startup_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(ollama_url)
            response.raise_for_status()
            logger.info("Ollama reachable on startup (%s)", ollama_url)
            break
        except Exception as exc:
            if attempt == startup_retries:
                logger.error(
                    "Ollama is unreachable after %d startup attempts at %s: %s",
                    startup_retries, ollama_url, exc,
                )
            else:
                logger.warning("Ollama not ready yet (attempt %d/%d): %s", attempt, startup_retries, exc)
                await asyncio.sleep(startup_delay)

    gpu_health = detect_gpu_and_ollama()
    app.state.gpu_health = gpu_health

    if gpu_health["status"] != "healthy":
        logger.warning("⚠️  GPU/Ollama status: %s", normalize_status(gpu_health.get("status")))
        if gpu_health["recommendations"]:
            logger.warning("Please address the recommendations above to restore performance.")
    else:
        logger.info("GPU/Ollama health check passed. System ready for processing.")

    async def _warmup_generation_model():
        model = OLLAMA_GENERATION_MODEL
        try:
            logger.info("[warmup] Pinging generation model %s to load into memory...", model)
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    OLLAMA_GENERATE_URL,
                    json={"model": model, "prompt": "hi", "stream": False, "options": {"num_predict": 1}},
                )
                if resp.status_code == 200:
                    logger.info("[warmup] Generation model %s is warm and ready.", model)
                else:
                    logger.warning("[warmup] Warmup ping returned status %d for model %s", resp.status_code, model)
        except Exception as exc:
            logger.warning("[warmup] Generation model warmup failed for %s: %s", model, exc)

    asyncio.create_task(_warmup_generation_model())

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=jsonable_encoder({"status": "error", "stage": "api", "detail": exc.detail}),
        )
    logger.error("Global error: %s\n%s", exc, traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"status": "error", "stage": "api", "message": "Internal Server Error", "details": str(exc)},
    )

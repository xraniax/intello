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

from .embeddings import ollama_tags_url
from .generation import OLLAMA_GENERATE_URL, OLLAMA_GENERATION_MODEL
from .google_client import log_google_drive_config_mode
from .ollama_config import get_engine_env_source, get_ollama_base_url
from .routes import chat, documents, generation, health, jobs, quiz, goals
from gpu_detector import detect_gpu_and_ollama
from core.normalization.status_normalizer import normalize_status

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("engine-api")

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


@app.on_event("startup")
async def startup_event():
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
        logger.warning("GPU/Ollama status: %s", normalize_status(gpu_health.get("status")))
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

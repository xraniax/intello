import logging

import requests
from fastapi import APIRouter, Request
from gpu_detector import detect_gpu_and_ollama

from ..embeddings import ollama_tags_url

router = APIRouter()
logger = logging.getLogger("engine-api")


@router.get("/")
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


@router.get("/health")
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


@router.get("/gpu-health")
async def gpu_health(request: Request):
    """Get detailed GPU and Ollama status (populated at startup)."""
    if not hasattr(request.app.state, "gpu_health"):
        request.app.state.gpu_health = detect_gpu_and_ollama()
    return request.app.state.gpu_health

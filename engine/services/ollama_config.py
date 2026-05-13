import os
import json
import time
import logging
from pathlib import Path
from typing import Optional, Dict, Any

import httpx
import requests
from dotenv import load_dotenv


def _running_in_container() -> bool:
    """Heuristic to detect if we're running inside a container.

    We prefer explicit configuration via OLLAMA_BASE_URL, but fall back to:
    - docker/k8s: service DNS name (ollama)
    - local dev: localhost
    """
    # Common Docker/Kubernetes hints
    if os.path.exists("/.dockerenv"):
        return True
    if os.environ.get("KUBERNETES_SERVICE_HOST"):
        return True
    return False


def _load_local_env_if_needed() -> None:
    """Load engine/.env.local or engine/.env for local runs.

    This is a convenience for running engine scripts directly on a developer
    machine (e.g. `python test_generation.py`) without manually exporting
    OLLAMA_* variables. Inside containers we rely on the orchestrator's
    env configuration instead.
    """

    if _running_in_container():
        # In Docker/Kubernetes, we expect env_file to inject values. We still
        # expose the source marker to improve startup diagnostics.
        os.environ.setdefault("ENGINE_ENV_SOURCE", "engine/.env.docker")
        return

    # This file lives in engine/services/; base_dir is engine/.
    base_dir = Path(__file__).resolve().parent.parent

    # Prefer .env.local for developer overrides, then fall back to .env.
    for candidate in (base_dir / ".env.local", base_dir / ".env"):
        if candidate.exists():
            load_dotenv(candidate, override=False)
            os.environ.setdefault("ENGINE_ENV_SOURCE", f"engine/{candidate.name}")
            return

    os.environ.setdefault("ENGINE_ENV_SOURCE", "process-env-only")


# Ensure local env vars are loaded before any access to OLLAMA_* when
# running directly on a developer machine.
_load_local_env_if_needed()


def get_ollama_base_url() -> str:
    """Return the base URL for the Ollama service.

    Precedence:
    1. Explicit OLLAMA_BASE_URL env var (respected everywhere: local, docker, prod).
    2. If inside a container and no env override: http://ollama:11434
    3. Otherwise (local dev): http://localhost:11434
    """
    explicit = os.getenv("OLLAMA_BASE_URL")
    if explicit:
        return explicit.rstrip("/")

    if _running_in_container():
        # Default Docker service name from docker-compose.yml
        return "http://ollama:11434"

    # Sensible default for local development when hitting a host Ollama daemon.
    return "http://localhost:11434"


def get_engine_env_source() -> str:
    """Return a human-friendly marker for the active engine env source."""
    return os.getenv("ENGINE_ENV_SOURCE", "unknown")


def get_ollama_generation_model(required: bool = True) -> Optional[str]:
    """Return the generation model name, optionally enforcing presence.

    When required=True (default), missing OLLAMA_GENERATION_MODEL results in a
    RuntimeError with a clear configuration message so the engine fails fast
    instead of sending `null` to Ollama.
    """
    model = os.getenv("OLLAMA_GENERATION_MODEL")
    if model:
        return model
    if not required:
        return None
    raise RuntimeError(
        "OLLAMA_GENERATION_MODEL environment variable is not set. "
        "Configure a valid generation model (e.g. 'qwen2.5:3b') in engine/.env "
        "or your deployment environment before using the generation pipeline."
    )


def get_dynamic_timeout(question_count: int) -> int:
    """
    Return a dynamic timeout for Ollama generational requests.
    Base timeout from OLLAMA_GENERATION_TIMEOUT, with an additional buffer per question
    to accommodate long generations on various hardware (CPU/GPU).
    """
    env_timeout = int(os.getenv("OLLAMA_GENERATION_TIMEOUT", 300))
    
    # We add 15s per question above a baseline of 5 questions.
    # For a 50-question exam, this adds 45 * 15 = 675s.
    # Total for 50 questions with 300s base: 975s (~16 minutes).
    buffer_per_question = 15
    baseline_questions = 5
    
    dynamic_buffer = max(0, (question_count - baseline_questions)) * buffer_per_question
    
    total_timeout = env_timeout + dynamic_buffer
    
    logger.info(
        "Calculated dynamic timeout: %ds (base: %ds, count: %d, buffer: %ds)",
        total_timeout,
        env_timeout,
        question_count,
        dynamic_buffer
    )
    
    return total_timeout


# ── Configuration ────────────────────────────────────────────────────────────
OLLAMA_BASE_URL = get_ollama_base_url()
OLLAMA_GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"
OLLAMA_GENERATION_MODEL = get_ollama_generation_model(required=True)

logger = logging.getLogger("engine-ollama-client")


def _stream_ollama_generate(payload: Dict[str, Any], *, timeout: Any, material_type: str) -> str:
    """Call Ollama /api/generate with streaming enabled and reconstruct full text."""
    payload = dict(payload)
    payload["stream"] = True
    full_text = []

    start_time = time.time()
    logger.info("[OLLAMA] Generation started", extra={
        "material_type": material_type,
        "timestamp": start_time,
        "timeout": str(timeout)
    })

    try:
        response = requests.post(OLLAMA_GENERATE_URL, json=payload, stream=True, timeout=timeout)
        response.raise_for_status()

        for line in response.iter_lines():
            if line:
                chunk = json.loads(line)
                if piece := chunk.get("response"):
                    full_text.append(piece)
                if chunk.get("done"):
                    break
        
        duration = time.time() - start_time
        logger.info("[OLLAMA] Generation completed", extra={
            "material_type": material_type,
            "duration": duration,
            "chars": sum(len(p) for p in full_text)
        })
        return "".join(full_text)
    except Exception as e:
        duration = time.time() - start_time
        logger.error("Ollama stream error for %s after %.2fs: %s", material_type, duration, e)
        raise


async def _async_stream_ollama_generate(payload: Dict[str, Any], *, timeout: Any, material_type: str) -> str:
    """Async version of _stream_ollama_generate using httpx."""
    payload = dict(payload)
    payload["stream"] = True
    full_text = []

    start_time = time.time()
    logger.info("[OLLAMA] Async Generation started", extra={
        "material_type": material_type,
        "timestamp": start_time,
        "timeout": str(timeout)
    })

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", OLLAMA_GENERATE_URL, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        chunk = json.loads(line)
                        if piece := chunk.get("response"):
                            full_text.append(piece)
                        if chunk.get("done"):
                            break
        
        duration = time.time() - start_time
        logger.info("[OLLAMA] Async Generation completed", extra={
            "material_type": material_type,
            "duration": duration,
            "chars": sum(len(p) for p in full_text)
        })
        return "".join(full_text)
    except Exception as e:
        duration = time.time() - start_time
        logger.error("Ollama async stream error for %s after %.2fs: %s", material_type, duration, e)
        raise

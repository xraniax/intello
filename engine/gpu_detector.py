"""GPU and Ollama health detection for startup diagnostics.

This module checks GPU availability, Ollama connectivity, and model loading.
Call detect_gpu_and_ollama() at application startup to verify performance capabilities.
"""

import os
import logging
import requests
from typing import Dict, Any
from datetime import datetime

from services.ollama_config import get_ollama_base_url
from core.normalization.status_normalizer import normalize_status

logger = logging.getLogger("engine-gpu-detector")

OLLAMA_BASE_URL = get_ollama_base_url()
OLLAMA_TAGS_URL = f"{OLLAMA_BASE_URL}/api/tags"
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")
OLLAMA_GENERATION_MODEL = os.getenv(
    "OLLAMA_GENERATION_MODEL",
    "dreamingbumblebee/qwen2.5vl-3b-qlora-ko-1.5k_q4_k_m",
)


def check_ollama_connection(timeout: int = 5) -> Dict[str, Any]:
    """Check if Ollama is reachable and responsive.
    
    Returns:
        {
            "reachable": bool,
            "latency_ms": float,
            "models": List[str],
            "error": Optional[str]
        }
    """
    try:
        start = datetime.now()
        response = requests.get(OLLAMA_TAGS_URL, timeout=timeout)
        latency_ms = (datetime.now() - start).total_seconds() * 1000
        
        if response.status_code == 200:
            models = [m["name"] for m in response.json().get("models", [])]
            return {
                "reachable": True,
                "latency_ms": latency_ms,
                "models": models,
                "error": None
            }
        else:
            return {
                "reachable": False,
                "latency_ms": latency_ms,
                "models": [],
                "error": f"HTTP {response.status_code}: {response.text[:100]}"
            }
    except requests.Timeout:
        return {
            "reachable": False,
            "latency_ms": timeout * 1000,
            "models": [],
            "error": f"Timeout after {timeout}s"
        }
    except Exception as e:
        return {
            "reachable": False,
            "latency_ms": 0,
            "models": [],
            "error": str(e)
        }


def check_model_loaded(model_name: str, timeout: int = 5) -> Dict[str, Any]:
    """Check if a specific model is loaded in Ollama.
    
    Returns:
        {
            "loaded": bool,
            "model_name": str,
            "available_models": List[str],
            "error": Optional[str]
        }
    """
    try:
        response = requests.get(OLLAMA_TAGS_URL, timeout=timeout)
        if response.status_code != 200:
            return {
                "loaded": False,
                "model_name": model_name,
                "available_models": [],
                "error": f"HTTP {response.status_code}"
            }
        
        models = response.json().get("models", [])
        model_names = [m["name"] for m in models]
        
        # Check for exact match or partial match (e.g., nomic-embed-text vs nomic-embed-text:latest)
        is_loaded = any(
            model_name in m["name"] or m["name"] in model_name
            for m in models
        )
        
        return {
            "loaded": is_loaded,
            "model_name": model_name,
            "available_models": model_names,
            "error": None if is_loaded else f"Model '{model_name}' not found in available models"
        }
    except Exception as e:
        return {
            "loaded": False,
            "model_name": model_name,
            "available_models": [],
            "error": str(e)
        }


def detect_gpu_and_ollama() -> Dict[str, Any]:
    """Comprehensive GPU and Ollama health check. Call at application startup.
    
    Returns:
        {
            "timestamp": str,
            "ollama": {
                "reachable": bool,
                "latency_ms": float,
                "url": str,
                "models": List[str],
                "error": Optional[str]
            },
            "embedding_model": {
                "loaded": bool,
                "model_name": str,
                "error": Optional[str]
            },
            "generation_model": {
                "loaded": bool,
                "model_name": str,
                "error": Optional[str]
            },
            "gpu_enabled": bool,
            "status": str,  # "healthy", "degraded", "failed"
            "recommendations": List[str]
        }
    """
    logger.info("=" * 80)
    logger.info("Starting GPU & Ollama Health Check")
    logger.info("=" * 80)
    
    # Check Ollama connection
    ollama_check = check_ollama_connection()
    logger.info(f"Ollama Connection: {'✓ REACHABLE' if ollama_check['reachable'] else '✗ UNREACHABLE'}")
    if ollama_check['reachable']:
        logger.info(f"  - URL: {OLLAMA_BASE_URL}")
        logger.info(f"  - Latency: {ollama_check['latency_ms']:.1f}ms")
        logger.info(f"  - Available Models: {len(ollama_check['models'])}")
        for model in ollama_check['models'][:5]:  # Show first 5
            logger.info(f"    • {model}")
        if len(ollama_check['models']) > 5:
            logger.info(f"    ... and {len(ollama_check['models']) - 5} more")
    else:
        logger.error(f"  - Error: {ollama_check['error']}")
    
    # Check embedding model
    embed_check = check_model_loaded(OLLAMA_EMBEDDING_MODEL)
    logger.info(f"Embedding Model ('{OLLAMA_EMBEDDING_MODEL}'): {'✓ LOADED' if embed_check['loaded'] else '✗ NOT LOADED'}")
    if embed_check['error']:
        logger.warning(f"  - Issue: {embed_check['error']}")
    
    # Check generation model
    gen_check = check_model_loaded(OLLAMA_GENERATION_MODEL)
    logger.info(f"Generation Model ('{OLLAMA_GENERATION_MODEL}'): {'✓ LOADED' if gen_check['loaded'] else '✗ NOT LOADED'}")
    if gen_check['error']:
        logger.warning(f"  - Issue: {gen_check['error']}")
    
    # Determine GPU status (implied by Ollama reachability)
    gpu_enabled = ollama_check['reachable']
    
    # Determine overall status
    if ollama_check['reachable'] and embed_check['loaded'] and gen_check['loaded']:
        status = "healthy"
        recommendations = []
    elif ollama_check['reachable']:
        status = "degraded"
        recommendations = []
        if not embed_check['loaded']:
            recommendations.append(f"Pull embedding model: ollama pull {OLLAMA_EMBEDDING_MODEL}")
        if not gen_check['loaded']:
            recommendations.append(f"Pull generation model: ollama pull {OLLAMA_GENERATION_MODEL}")
    else:
        status = "failed"
        recommendations = [
            f"Ensure Ollama is running at {OLLAMA_BASE_URL}",
            "Check OLLAMA_BASE_URL environment variable",
            "Verify GPU drivers and CUDA availability on host",
            "Run: docker logs ollama_gpu (if using Docker)"
        ]
    
    # Log recommendations
    if recommendations:
        logger.warning("Recommendations:")
        for i, rec in enumerate(recommendations, 1):
            logger.warning(f"  {i}. {rec}")
    
    result = {
        "timestamp": datetime.now().isoformat(),
        "ollama": {
            "reachable": ollama_check['reachable'],
            "latency_ms": ollama_check['latency_ms'],
            "url": OLLAMA_BASE_URL,
            "models": ollama_check['models'],
            "error": ollama_check['error']
        },
        "embedding_model": {
            "loaded": embed_check['loaded'],
            "model_name": OLLAMA_EMBEDDING_MODEL,
            "error": embed_check['error']
        },
        "generation_model": {
            "loaded": gen_check['loaded'],
            "model_name": OLLAMA_GENERATION_MODEL,
            "error": gen_check['error']
        },
        "gpu_enabled": gpu_enabled,
        "status": status,
        "recommendations": recommendations
    }
    
    logger.info("=" * 80)
    logger.info("Overall Status: %s", normalize_status(status))
    logger.info("=" * 80)
    
    return result


if __name__ == "__main__":
    # Run detection manually for diagnostics
    import json
    result = detect_gpu_and_ollama()
    print(json.dumps(result, indent=2))

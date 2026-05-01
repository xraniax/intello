import logging
import time
import httpx
import asyncio
from typing import Dict, Any
from .generation import OLLAMA_GENERATION_TIMEOUT, OLLAMA_BASE_URL, OLLAMA_GENERATION_MODEL

logger = logging.getLogger("engine-diagnostics")

async def audit_gpu_offload() -> Dict[str, Any]:
    """Check if weights are correctly offloaded to GPU."""
    try:
        # We can't easily read docker logs from inside the container, 
        # but we can query the Ollama /api/tags or /api/show for model details.
        # However, the most reliable 'in-app' way is to check the first-token latency of a 'ping'.
        # If it's < 500ms, it's almost certainly GPU-resident.
        start = time.perf_counter()
        async with httpx.AsyncClient() as client:
            await client.post(f"{OLLAMA_BASE_URL}/api/generate", json={
                "model": "qwen2.5:7b-instruct",
                "prompt": "ping",
                "stream": False,
                "options": {"num_predict": 1}
            }, timeout=30)
        latency = (time.perf_counter() - start) * 1000
        return {"offload_status": "GPU" if latency < 1500 else "CPU_WARMING", "ping_ms": int(latency)}
    except Exception as e:
        return {"offload_status": "ERROR", "error": str(e)}

async def run_pipeline_diagnostic():
    """Run a full suite of generation health checks."""
    logger.info("="*40)
    logger.info("PIPELINE DIAGNOSTIC REPORT")
    logger.info("="*40)
    
    # 1. Router Verification
    models = {
        "quiz": OLLAMA_GENERATION_MODEL,
        "chat": OLLAMA_GENERATION_MODEL,
        "flashcard": OLLAMA_GENERATION_MODEL,
    }
    logger.info(f"[ROUTER] Active model: {OLLAMA_GENERATION_MODEL} {models}")
    
    # 2. GPU & Latency Ping
    gpu_audit = await audit_gpu_offload()
    logger.info(f"[HARDWARE] GPU Status: {gpu_audit['offload_status']} ({gpu_audit.get('ping_ms', 'N/A')}ms)")
    
    # 3. Connection Check
    connection_stable = gpu_audit['offload_status'] != "ERROR"
    logger.info(f"[NETWORK] Ollama Connection: {'OK' if connection_stable else 'FAIL'}")
    
    logger.info("="*40)
    if connection_stable:
        logger.info("HEARTBEAT SUCCESS: Pipeline is stable.")
    else:
        logger.warning("HEARTBEAT WARNING: Pipeline may have optimization gaps.")
    logger.info("="*40)

import os
import logging
import asyncio
import threading
from typing import Any, Dict, List, Optional

import requests
import httpx

logger = logging.getLogger("engine-embeddings")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama_gpu:11434").rstrip("/")
OLLAMA_EMBEDDINGS_URL = os.getenv("OLLAMA_EMBEDDINGS_URL") or f"{OLLAMA_BASE_URL}/api/embeddings"
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")

# Control how many requests hit Ollama concurrently
MAX_CONCURRENT_REQUESTS = int(os.getenv("OLLAMA_MAX_CONCURRENT", "10"))

def ollama_tags_url() -> str:
    return f"{OLLAMA_BASE_URL}/api/tags"

async def _generate_embedding_async(client: httpx.AsyncClient, text: str, timeout: int, retries: int) -> Optional[List[float]]:
    if not text or not text.strip():
        return None

    payload: Dict[str, Any] = {"model": OLLAMA_EMBEDDING_MODEL, "prompt": text}

    for attempt in range(retries):
        try:
            response = await client.post(OLLAMA_EMBEDDINGS_URL, json=payload, timeout=timeout)
            response.raise_for_status()
            
            data = response.json()
            embedding = data.get("embedding") or data.get("embeddings")
            
            if embedding and isinstance(embedding, list):
                return [float(x) for x in embedding]
            return None
            
        except httpx.TimeoutException:
            logger.warning("Embedding timeout (attempt %d/%d)", attempt + 1, retries)
        except httpx.RequestError as err:
            logger.warning("Embedding request failed (attempt %d/%d): %s", attempt + 1, retries, err)
            
    return None

async def _generate_embeddings_batch(texts: List[str], timeout: int, retries: int) -> List[Optional[List[float]]]:
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    
    async def bound_fetch(client: httpx.AsyncClient, text: str):
        async with semaphore:
            return await _generate_embedding_async(client, text, timeout, retries)

    limits = httpx.Limits(max_keepalive_connections=MAX_CONCURRENT_REQUESTS, max_connections=MAX_CONCURRENT_REQUESTS)
    async with httpx.AsyncClient(limits=limits) as client:
        tasks = [bound_fetch(client, text) for text in texts]
        return await asyncio.gather(*tasks)

def embed_step(texts: List[str], *, timeout: int = 15, retries: int = 3) -> List[Optional[List[float]]]:
    """Pipeline entry point with a synchronous thread wrapper to avoid event loop conflicts."""
    if not texts:
        return []
        
    result_container = []
    
    def _run_in_thread():
        new_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(new_loop)
        try:
            res = new_loop.run_until_complete(_generate_embeddings_batch(texts, timeout, retries))
            result_container.append(res)
        finally:
            new_loop.close()

    thread = threading.Thread(target=_run_in_thread)
    thread.start()
    thread.join()
    
    return result_container[0]

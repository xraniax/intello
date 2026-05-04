"""Dedicated summary generation pipeline.

Isolates summary-specific logic from the shared generation module for
independent maintainability, testing, and latency optimization.

This module owns:
- Summary prompt construction (system + user)
- Context assembly with summary-specific limits
- MAP stage orchestration (sync + async)
- REDUCE streaming generation
- Synchronous (Celery-compatible) generation

Other material types continue to use generation.py unchanged.
"""

import asyncio
import json
import logging
import os
import time
from typing import AsyncIterator, Dict, Any, List, Optional

import httpx

from .ollama_config import get_ollama_base_url, get_ollama_generation_model

logger = logging.getLogger("engine-summary-pipeline")

# ── Configuration ────────────────────────────────────────────────────────────
OLLAMA_BASE_URL = get_ollama_base_url()
OLLAMA_GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"
OLLAMA_GENERATION_MODEL = get_ollama_generation_model(required=True)

OLLAMA_GENERATION_TIMEOUT = int(os.getenv("OLLAMA_GENERATION_TIMEOUT", "300"))
OLLAMA_REQUEST_RETRIES = int(os.getenv("OLLAMA_REQUEST_RETRIES", "4"))
OLLAMA_REQUEST_RETRY_DELAY_SECONDS = float(os.getenv("OLLAMA_REQUEST_RETRY_DELAY_SECONDS", "2"))

# Summary-specific context limits — larger than the shared 15K to accommodate
# post-MAP synthesis material.  MAP summaries are already compressed so 30K
# gives the REDUCE stage enough room without hitting Ollama context limits.
SUMMARY_MAX_CONTEXT_CHARS = int(os.getenv("SUMMARY_MAX_CONTEXT_CHARS", "30000"))

# MAP stage configuration.
MAP_MAX_CHUNKS = int(os.getenv("MAP_MAX_CHUNKS", "80"))
MAP_CONCURRENCY = int(os.getenv("MAP_CONCURRENCY", "2"))
STREAM_MAP_MAX_CHUNKS = int(os.getenv("STREAM_MAP_MAX_CHUNKS", "20"))

# Per-chunk MAP timeout.  MAP prompts are short extractions — they don't need
# the full 300 s generation budget.  A stuck chunk releases its concurrency
# slot after this many seconds, unblocking the rest of the batch.
MAP_CHUNK_TIMEOUT_SECONDS = int(os.getenv("MAP_CHUNK_TIMEOUT_SECONDS", "90"))

# Retry delay for MAP chunks specifically. Shorter than the shared generation
# delay (2 s default) because holding an executor thread idle hurts concurrency.
MAP_RETRY_DELAY_SECONDS = float(os.getenv("MAP_RETRY_DELAY_SECONDS", "0.5"))

# Minimum chunk length to be considered for MAP processing.
_MIN_CHUNK_CHARS = 100


# ── System Prompt ────────────────────────────────────────────────────────────

def _build_summary_system_prompt() -> str:
    """Centralized system prompt for summary generation."""
    return (
        "You are a knowledgeable student explaining material to a classmate. "
        "Write in a natural, human voice — clear and direct, not formal or robotic. "
        "Prioritize the most important ideas; not everything deserves equal coverage. "
        "Never narrate what the document is about (avoid 'This text discusses...', "
        "'The document covers...', 'In this paper...'). "
        "Instead, just explain the actual content directly. "
        "Choose whatever structure fits best — flowing paragraphs, or short bullet "
        "groups when listing related items — but never force one format throughout. "
        "Do not use headers, section titles, or bold/italic formatting."
    )


# ── User Prompt ──────────────────────────────────────────────────────────────

def build_summary_prompt(
    context: str,
    language: str = "en",
    difficulty: str = "intermediate",
    topic: Optional[str] = None,
) -> str:
    """Build the user-facing prompt for the REDUCE stage of summary generation.

    Extracted from the shared ``build_prompt()`` to allow summary-specific
    evolution without affecting other material types.
    """
    lang_phrase = f" Write in {language}." if language and language.lower() != "en" else ""

    if difficulty in ("introductory", "beginner", "easy"):
        depth_instruction = (
            "Focus ONLY on the 2-3 most important ideas. "
            "Skip minor details, examples, and edge cases entirely. "
            "Keep it short and simple — a quick overview someone can read in under a minute."
        )
    elif difficulty in ("advanced", "hard"):
        depth_instruction = (
            "Cover nearly all the major and supporting ideas from the material. "
            "Include important details, distinctions, and nuances, but still synthesize — "
            "do not just restate every sentence. Explain connections between concepts."
        )
    else:  # intermediate / default
        depth_instruction = (
            "Cover all major concepts but compress the explanations. "
            "Include enough detail to understand each idea, but skip minor examples "
            "and tangential points. Aim for a balanced, medium-length summary."
        )

    prompt = (
        f"{depth_instruction}{lang_phrase}\n\n"
        f"Text to summarize:\n---\n{context}\n---\n\n"
        f"Summary:"
    )
    return prompt


# ── Context Assembly ─────────────────────────────────────────────────────────

def _build_summary_context(chunks: List[str]) -> str:
    """Combine chunks into a single context string with summary-specific limits.

    Uses the larger ``SUMMARY_MAX_CONTEXT_CHARS`` (30K default) instead of the
    shared 15K limit, because post-MAP summaries are already compressed.
    """
    context = "\n\n".join(chunks)
    if len(context) > SUMMARY_MAX_CONTEXT_CHARS:
        logger.warning(
            "[SUMMARY] context truncated from %d to %d chars",
            len(context), SUMMARY_MAX_CONTEXT_CHARS,
        )
        context = context[:SUMMARY_MAX_CONTEXT_CHARS] + "\n...[Context truncated]"
    return context


# ── MAP Stage ────────────────────────────────────────────────────────────────

def _build_map_prompt(chunk_text: str, language: str, difficulty: str) -> str:
    """Build a difficulty-aware MAP prompt for a single chunk.

    Beginner MAP extracts only key ideas; advanced MAP preserves details.
    """
    if difficulty in ("introductory", "beginner", "easy"):
        extract_level = (
            "Extract ONLY the 2-3 most important ideas from the following text. "
            "Skip details, examples, and supporting evidence."
        )
    elif difficulty in ("advanced", "hard"):
        extract_level = (
            "Extract ALL key facts, concepts, details, and nuances from the following text. "
            "Preserve important distinctions and relationships between ideas."
        )
    else:
        extract_level = (
            "Extract ALL key facts, concepts, and details without omitting important information. "
            "Skip minor examples but keep supporting arguments."
        )

    return (
        f"System instructions:\n"
        f"You are a highly efficient assistant. Compress the following text into a concise summary in {language}. "
        f"{extract_level} "
        f"Do not add introductions or conclusions. Return ONLY the summary.\n\n"
        f"Text to summarize:\n---\n{chunk_text}\n---\n\n"
        f"Summary:"
    )


def _map_summarize_chunk(
    chunk_text: str,
    language: str,
    difficulty: str,
    timeout: int,
    retries: int,
) -> str:
    """Summarize a single chunk for the MAP stage.

    Delegates to the shared ``_stream_ollama_generate`` for the actual LLM call.

    Uses ``MAP_CHUNK_TIMEOUT_SECONDS`` (default 90 s) rather than the caller-
    supplied ``timeout`` (typically 300 s) so that a stalled Ollama request
    releases its concurrency slot quickly instead of blocking for 5 minutes.
    Falls back to the caller timeout only when MAP_CHUNK_TIMEOUT_SECONDS is
    unset or larger than the caller value.
    """
    from .generation import _stream_ollama_generate

    # Use the tighter MAP-specific timeout to bound executor thread hold time.
    effective_timeout = min(timeout, MAP_CHUNK_TIMEOUT_SECONDS)

    prompt = _build_map_prompt(chunk_text, language, difficulty)
    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
        "keep_alive": -1,
    }

    prompt_chars = len(prompt)
    logger.info(
        "[SUMMARY][MAP_CHUNK] model=%s prompt_chars=%d chunk_chars=%d timeout=%d difficulty=%s",
        OLLAMA_GENERATION_MODEL, prompt_chars, len(chunk_text), effective_timeout, difficulty,
    )

    for attempt in range(retries):
        attempt_start = time.perf_counter()
        try:
            generated_text = _stream_ollama_generate(
                payload, timeout=effective_timeout, material_type="summary_map",
            )
            attempt_ms = int((time.perf_counter() - attempt_start) * 1000)
            if generated_text and generated_text.strip():
                logger.info(
                    "[SUMMARY][MAP_CHUNK] attempt=%d/%d duration_ms=%d output_chars=%d",
                    attempt + 1, retries, attempt_ms, len(generated_text),
                )
                return generated_text.strip()
        except Exception as e:
            attempt_ms = int((time.perf_counter() - attempt_start) * 1000)
            logger.warning(
                "[SUMMARY][MAP_CHUNK] attempt=%d/%d FAILED duration_ms=%d error=%s",
                attempt + 1, retries, attempt_ms, e,
            )
            if attempt == retries - 1:
                return ""
            # Use MAP-specific retry delay — shorter than the shared generation
            # delay so the executor thread is held idle for less time.
            time.sleep(MAP_RETRY_DELAY_SECONDS)
    return ""


def _prepare_eligible_chunks(
    chunks: List[str],
    max_chunks: int,
) -> List[str]:
    """Filter and cap chunks for MAP processing."""
    eligible = [c for c in chunks if len(c.strip()) >= _MIN_CHUNK_CHARS]
    if len(eligible) > max_chunks:
        logger.warning(
            "[SUMMARY][MAP] capping %d eligible chunks to %d", len(eligible), max_chunks,
        )
        eligible = eligible[:max_chunks]
    return eligible


def generate_map_summaries(
    chunks: List[str],
    language: str = "en",
    difficulty: str = "intermediate",
    timeout: int = OLLAMA_GENERATION_TIMEOUT,
    retries: int = OLLAMA_REQUEST_RETRIES,
    max_chunks: Optional[int] = None,
) -> List[str]:
    """MAP stage: summarize chunks with bounded concurrency (sync/Celery path).

    Returns ordered list of non-empty chunk summaries.
    """
    import concurrent.futures

    map_stage_start = time.perf_counter()
    cap = max_chunks or MAP_MAX_CHUNKS
    eligible = _prepare_eligible_chunks(chunks, cap)
    if not eligible:
        return []

    total_input_chars = sum(len(c) for c in eligible)
    concurrency = min(len(eligible), MAP_CONCURRENCY) if eligible else 1

    logger.info(
        "[SUMMARY][MAP_START] total_chunks=%d eligible=%d total_chars=%d cap=%d concurrency=%d difficulty=%s",
        len(chunks), len(eligible), total_input_chars, cap, concurrency, difficulty,
    )

    results = [None] * len(eligible)
    chunk_timings = [0] * len(eligible)

    def _run_chunk(idx_chunk):
        idx, chunk = idx_chunk
        chunk_start = time.perf_counter()
        logger.info("[SUMMARY][MAP] chunk %d/%d chars=%d", idx + 1, len(eligible), len(chunk))
        summary = _map_summarize_chunk(chunk, language, difficulty, timeout, retries)
        chunk_ms = int((time.perf_counter() - chunk_start) * 1000)
        if summary:
            logger.info("[SUMMARY][MAP] chunk %d/%d DONE ms=%d out_chars=%d", idx + 1, len(eligible), chunk_ms, len(summary))
        else:
            logger.warning("[SUMMARY][MAP] chunk %d/%d EMPTY ms=%d", idx + 1, len(eligible), chunk_ms)
        return idx, summary or "", chunk_ms

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = pool.map(_run_chunk, enumerate(eligible))
        for idx, summary, chunk_ms in futures:
            results[idx] = summary
            chunk_timings[idx] = chunk_ms

    mapped = [s for s in results if s]
    map_total_ms = int((time.perf_counter() - map_stage_start) * 1000)
    valid_timings = [t for t in chunk_timings if t > 0]
    avg_ms = int(sum(valid_timings) / len(valid_timings)) if valid_timings else 0

    logger.info(
        "[SUMMARY][MAP_END] processed=%d/%d total_ms=%d avg_ms=%d min_ms=%d max_ms=%d output=%d",
        len(eligible), len(chunks), map_total_ms, avg_ms,
        min(valid_timings) if valid_timings else 0,
        max(valid_timings) if valid_timings else 0,
        len(mapped),
    )
    return mapped


async def _async_map_summaries(
    chunks: List[str],
    language: str = "en",
    difficulty: str = "intermediate",
    timeout: int = OLLAMA_GENERATION_TIMEOUT,
    retries: int = OLLAMA_REQUEST_RETRIES,
    max_chunks: Optional[int] = None,
    progress_queue: Optional[asyncio.Queue] = None,
) -> List[str]:
    """Async MAP stage for the streaming path.

    Uses asyncio.Semaphore + run_in_executor so the event loop stays
    responsive (emitting keepalives) while MAP work proceeds in threads.

    If *progress_queue* is provided, pushes a short progress string each
    time a chunk finishes so the caller can yield SSE progress events.
    """
    cap = max_chunks or STREAM_MAP_MAX_CHUNKS
    eligible = _prepare_eligible_chunks(chunks, cap)
    if not eligible:
        return []

    map_start = time.perf_counter()
    concurrency = min(len(eligible), MAP_CONCURRENCY)
    sem = asyncio.Semaphore(concurrency)
    loop = asyncio.get_running_loop()
    completed_count = 0

    logger.info(
        "[SUMMARY][ASYNC_MAP_START] eligible=%d cap=%d concurrency=%d difficulty=%s",
        len(eligible), cap, concurrency, difficulty,
    )

    async def _map_one(idx: int, chunk: str):
        nonlocal completed_count
        async with sem:
            result = await loop.run_in_executor(
                None, _map_summarize_chunk, chunk, language, difficulty, timeout, retries,
            )
            completed_count += 1
            if progress_queue is not None:
                await progress_queue.put(
                    f"map {completed_count}/{len(eligible)}"
                )
            return idx, result or ""

    tasks = [_map_one(i, c) for i, c in enumerate(eligible)]
    gathered = await asyncio.gather(*tasks, return_exceptions=True)

    ordered = [None] * len(eligible)
    for item in gathered:
        if isinstance(item, Exception):
            logger.warning("[SUMMARY][ASYNC_MAP] chunk failed: %s", item)
            continue
        idx, summary = item
        ordered[idx] = summary

    mapped = [s for s in ordered if s]
    map_ms = int((time.perf_counter() - map_start) * 1000)
    logger.info(
        "[SUMMARY][ASYNC_MAP_END] total_ms=%d input=%d output=%d concurrency=%d",
        map_ms, len(eligible), len(mapped), concurrency,
    )

    # Signal the progress consumer that MAP is complete.
    if progress_queue is not None:
        await progress_queue.put(None)

    return mapped


# ── Streaming Summary Generation ─────────────────────────────────────────────

async def generate_summary_stream(
    chunks: List[str],
    topic: Optional[str] = None,
    language: str = "en",
    difficulty: str = "intermediate",
) -> AsyncIterator[str]:
    """Stream summary tokens from Ollama with MAP/REDUCE pipeline.

    This is the primary summary generation entry point for the streaming path.
    It is intentionally independent from Celery.

    Progressive MAP feedback:
    During the MAP phase, progress markers (``[PROGRESS] map N/M``) are
    yielded so that ``stream_core`` emits ``{"type": "progress", ...}``
    SSE events.  The frontend ignores these (it only processes ``delta``
    events) but they keep the connection alive with real payloads and
    allow future UI enhancements (progress bars, stage indicators).

    Fixes over the old shared path:
    - REDUCE retries no longer yield partial + duplicate content (S-6).
    - Difficulty-aware MAP prompts (S-3).
    - Larger context window post-MAP (S-4).
    """
    overall_start = time.perf_counter()
    logger.info(
        "[SUMMARY][STREAM_START] chunks=%d difficulty=%s topic=%s",
        len(chunks), difficulty, topic,
    )

    if not chunks:
        yield "[ERROR] Not enough context to generate summary."
        return

    # ── MAP decision ──
    total_chars = sum(len(c) for c in chunks)
    if total_chars <= SUMMARY_MAX_CONTEXT_CHARS:
        logger.info(
            "[SUMMARY][MAP_SKIP] total_chars=%d <= max_context=%d",
            total_chars, SUMMARY_MAX_CONTEXT_CHARS,
        )
    else:
        map_start = time.perf_counter()
        logger.info(
            "[SUMMARY][MAP_PHASE_START] input_chunks=%d total_chars=%d",
            len(chunks), total_chars,
        )

        # Progressive MAP: run summarization in a background task while
        # this generator yields progress markers for each completed chunk.
        progress_queue: asyncio.Queue = asyncio.Queue()
        map_task = asyncio.create_task(
            _async_map_summaries(
                chunks, language, difficulty,
                OLLAMA_GENERATION_TIMEOUT, OLLAMA_REQUEST_RETRIES,
                progress_queue=progress_queue,
            )
        )

        # Drain progress signals until MAP signals completion (None).
        while True:
            try:
                msg = await asyncio.wait_for(progress_queue.get(), timeout=10)
            except asyncio.TimeoutError:
                # No chunk finished in 10 s — emit a generic heartbeat.
                yield "[PROGRESS] map processing"
                continue
            if msg is None:
                # MAP finished.
                break
            yield f"[PROGRESS] {msg}"

        # Collect the final ordered results.
        mapped_chunks = await map_task
        map_ms = int((time.perf_counter() - map_start) * 1000)
        logger.info(
            "[SUMMARY][MAP_PHASE_END] duration_ms=%d input=%d output=%d",
            map_ms, len(chunks), len(mapped_chunks) if mapped_chunks else 0,
        )
        if mapped_chunks:
            chunks = mapped_chunks

    # ── REDUCE ──
    context = _build_summary_context(chunks)
    prompt = build_summary_prompt(context, language, difficulty, topic)

    # Use adaptive context sizing to avoid allocating unnecessary VRAM.
    # 1 token ≈ 3 chars, plus 1024 tokens buffer for generation.
    adaptive_num_ctx = max(2048, min(32768, (len(prompt) // 3) + 1024))

    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
        "stream": True,
        "system": _build_summary_system_prompt(),
        "keep_alive": -1,
        "options": {
            "num_ctx": adaptive_num_ctx
        }
    }

    reduce_prompt_chars = len(prompt)
    logger.info(
        "[SUMMARY][REDUCE_START] model=%s prompt_chars=%d context_chars=%d timeout=%d",
        OLLAMA_GENERATION_MODEL, reduce_prompt_chars, len(context), OLLAMA_GENERATION_TIMEOUT,
    )

    retries = OLLAMA_REQUEST_RETRIES
    for attempt in range(1, retries + 1):
        reduce_start = time.perf_counter()
        first_token_logged = False
        token_count = 0
        total_chars_out = 0
        attempt_succeeded = False

        try:
            async with httpx.AsyncClient(timeout=OLLAMA_GENERATION_TIMEOUT) as client:
                async with client.stream("POST", OLLAMA_GENERATE_URL, json=payload) as resp:
                    resp.raise_for_status()
                    logger.info(
                        "[SUMMARY][REDUCE_HTTP_OK] attempt=%d/%d status=%d ttfb_ms=%d",
                        attempt, retries, resp.status_code,
                        int((time.perf_counter() - reduce_start) * 1000),
                    )

                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                        except json.JSONDecodeError:
                            continue

                        if not isinstance(chunk, dict):
                            continue

                        piece = chunk.get("response")
                        if isinstance(piece, str) and piece:
                            token_count += 1
                            total_chars_out += len(piece)
                            if not first_token_logged:
                                ttft_ms = int((time.perf_counter() - reduce_start) * 1000)
                                logger.info(
                                    "[SUMMARY][REDUCE_FIRST_TOKEN] attempt=%d/%d ttft_ms=%d",
                                    attempt, retries, ttft_ms,
                                )
                                first_token_logged = True
                            yield piece

                        if chunk.get("done") is True:
                            reduce_ms = int((time.perf_counter() - reduce_start) * 1000)
                            overall_ms = int((time.perf_counter() - overall_start) * 1000)
                            throughput = (token_count / (reduce_ms / 1000)) if reduce_ms > 0 else 0
                            logger.info(
                                "[SUMMARY][REDUCE_DONE] attempt=%d/%d ms=%d tokens=%d chars=%d tok/s=%.1f total_ms=%d",
                                attempt, retries, reduce_ms, token_count, total_chars_out, throughput, overall_ms,
                            )
                            attempt_succeeded = True
                            return

            # Stream ended without done=true — still treat as success if we got tokens.
            if token_count > 0:
                attempt_succeeded = True
                return

        except (httpx.TimeoutException, httpx.RequestError, httpx.HTTPStatusError) as e:
            attempt_ms = int((time.perf_counter() - reduce_start) * 1000)

            # FIX S-6: If we already yielded tokens to the client on this attempt,
            # we cannot silently retry (would produce garbled output).  Yield error
            # and bail out instead.
            if token_count > 0:
                logger.error(
                    "[SUMMARY][REDUCE_PARTIAL_FAIL] attempt=%d/%d ms=%d tokens_yielded=%d error=%s",
                    attempt, retries, attempt_ms, token_count, e,
                )
                yield f"\n\n[Generation interrupted after {token_count} tokens — please retry]"
                return

            if attempt == retries:
                logger.error(
                    "[SUMMARY][REDUCE_FAIL] attempt=%d/%d ms=%d error=%s",
                    attempt, retries, attempt_ms, e,
                )
                yield f"[ERROR] Ollama unreachable at {OLLAMA_BASE_URL} after {retries} attempts"
                return

            logger.warning(
                "[SUMMARY][REDUCE_RETRY] attempt=%d/%d ms=%d error=%s",
                attempt, retries, attempt_ms, e,
            )
            await asyncio.sleep(OLLAMA_REQUEST_RETRY_DELAY_SECONDS)

        except Exception as e:
            attempt_ms = int((time.perf_counter() - reduce_start) * 1000)
            logger.exception(
                "[SUMMARY][REDUCE_CRASH] attempt=%d ms=%d error=%s",
                attempt, attempt_ms, e,
            )
            yield f"[ERROR] {e}"
            return


# ── Synchronous Summary Generation (Celery path) ────────────────────────────

def generate_summary(
    chunks: List[str],
    topic: Optional[str] = None,
    language: str = "en",
    difficulty: str = "intermediate",
    timeout: int = OLLAMA_GENERATION_TIMEOUT,
    retries: int = OLLAMA_REQUEST_RETRIES,
) -> str:
    """Generate a complete summary synchronously (for the Celery fallback path).

    Runs MAP/REDUCE in a blocking fashion and returns the full summary text.
    """
    from .generation import _stream_ollama_generate

    if not chunks:
        return "Not enough context to generate summary."

    # ── MAP ──
    logger.info("[SUMMARY][SYNC] starting MAP for %d chunks, difficulty=%s", len(chunks), difficulty)
    mapped = generate_map_summaries(
        chunks, language, difficulty, timeout, retries,
        max_chunks=MAP_MAX_CHUNKS,
    )
    if mapped:
        chunks = mapped

    # ── REDUCE ──
    context = _build_summary_context(chunks)
    prompt = build_summary_prompt(context, language, difficulty, topic)

    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
        "system": _build_summary_system_prompt(),
    }

    for attempt in range(retries):
        try:
            logger.info(
                "[SUMMARY][SYNC_REDUCE] attempt=%d/%d timeout=%d",
                attempt + 1, retries, timeout,
            )
            start = time.perf_counter()
            text = _stream_ollama_generate(payload, timeout=timeout, material_type="summary")
            ms = int((time.perf_counter() - start) * 1000)

            if not text.strip():
                if attempt < retries - 1:
                    logger.info("[SUMMARY][SYNC_REDUCE] empty output, retrying")
                    continue
                raise RuntimeError("Empty summary output from Ollama")

            logger.info(
                "[SUMMARY][SYNC_REDUCE] done attempt=%d/%d ms=%d chars=%d",
                attempt + 1, retries, ms, len(text),
            )
            return text

        except Exception as e:
            logger.warning(
                "[SUMMARY][SYNC_REDUCE] attempt=%d/%d failed: %s",
                attempt + 1, retries, e,
            )
            if attempt == retries - 1:
                raise

    raise RuntimeError("All summary generation retry attempts failed")

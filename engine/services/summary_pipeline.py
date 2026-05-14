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

from .ollama_config import (
    get_ollama_base_url,
    get_ollama_generation_model,
    get_dynamic_timeout,
    _stream_ollama_generate,
    OLLAMA_GENERATE_URL,
    OLLAMA_GENERATION_MODEL,
)

logger = logging.getLogger("engine-summary-pipeline")

# ── Configuration ────────────────────────────────────────────────────────────
OLLAMA_BASE_URL = get_ollama_base_url()
OLLAMA_GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"
OLLAMA_GENERATION_MODEL = get_ollama_generation_model(required=True)

OLLAMA_GENERATION_TIMEOUT = int(os.getenv("OLLAMA_GENERATION_TIMEOUT", "600"))
OLLAMA_REQUEST_RETRIES = int(os.getenv("OLLAMA_REQUEST_RETRIES", "4"))
OLLAMA_REQUEST_RETRY_DELAY_SECONDS = float(os.getenv("OLLAMA_REQUEST_RETRY_DELAY_SECONDS", "2"))

# Summary-specific context limits — larger than the shared 15K to accommodate
# post-MAP synthesis material.  MAP summaries are already compressed so 30K
# gives the REDUCE stage enough room without hitting Ollama context limits.
# Threshold for switching between "One-Shot" (fast) and "Map-Reduce" (comprehensive).
# Increased to 100k characters so almost all common 10-60 page PDFs stay in the fast path.
SUMMARY_MAX_CONTEXT_CHARS = int(os.getenv("SUMMARY_MAX_CONTEXT_CHARS", "30000"))

# Target size for coalescing chunks during the MAP phase. 4500 chars (approx 3 chunks) 
# reduces sequential overhead of LLM calls significantly on slower hardware.
MAP_BLOCK_CHARS = int(os.getenv("MAP_BLOCK_CHARS", "4500"))

# Absolute max chunks to retrieve to prevent OOM/timeouts on massive subjects.
MAP_MAX_CHUNKS = int(os.getenv("MAP_MAX_CHUNKS", "80"))
MAP_CONCURRENCY = int(os.getenv("MAP_CONCURRENCY", "1"))
STREAM_MAP_MAX_CHUNKS = int(os.getenv("STREAM_MAP_MAX_CHUNKS", "30"))

# Per-chunk MAP timeout.  MAP prompts are short extractions — they don't need
# the full generation budget.  A stuck chunk releases its concurrency
# slot after this many seconds, unblocking the rest of the batch.
MAP_CHUNK_TIMEOUT_SECONDS = int(os.getenv("MAP_CHUNK_TIMEOUT_SECONDS", "180"))

# Retry delay for MAP chunks specifically. Shorter than the shared generation
# delay (2 s default) because holding an executor thread idle hurts concurrency.
MAP_RETRY_DELAY_SECONDS = float(os.getenv("MAP_RETRY_DELAY_SECONDS", "0.5"))

# Minimum chunk length to be considered for MAP processing.
_MIN_CHUNK_CHARS = 100


# ── System Prompt ────────────────────────────────────────────────────────────

def _build_summary_system_prompt() -> str:
    """Invariant contract for REDUCE-stage generation: grounding, structure, and multi-doc rules.

    Depth strategy (beginner / intermediate / advanced) is injected separately via the user
    prompt so this contract stays stable across all difficulty levels.
    """
    return (
        "You are a knowledgeable student synthesizing material for a peer. "
        "Write in a natural, direct voice — clear, confident, never formal or robotic. "
        "Never narrate what the documents are about (avoid 'This text discusses...', "
        "'The document covers...', 'In this paper...'). Explain the actual content directly.\n\n"

        "GLOBAL RULES\n"
        "All constraints below are global — apply them implicitly across every section "
        "without re-evaluation at section level.\n"
        "1. Grounding: Use only information present in the input. "
        "No external knowledge, invented examples, or concepts absent from the source.\n"
        "2. Concept preservation: Every distinct concept in the input must appear in the output. "
        "Do not merge, skip, or compress unrelated ideas.\n"
        "3. Depth and length scaling: Output depth and length scale with input complexity — "
        "more concepts and topic clusters mean more coverage and longer output. "
        "Brevity is never a goal; shorten only when the input itself is genuinely minimal.\n"
        "4. Input synthesis: Before writing, classify the input as single-topic or multi-topic. "
        "Single-topic: produce a focused explanation. "
        "Multi-topic: treat all topics as a unified curriculum and synthesize into one structured "
        "knowledge map. The input may have no explicit topic boundaries — infer them from shifts "
        "in vocabulary, domain, or conceptual focus.\n"
        "5. Structure: Use the required section order. Never add, rename, or reorder sections. "
        "Omit a section only when it has no applicable content.\n\n"

        "FORMATTING\n"
        "Write each section label as plain text followed by a newline, then the content. "
        "No markdown headings, bold, or italic.\n\n"

        "SECTIONS\n\n"

        "Overview\n"
        "State the core subject(s) and why they matter. Give each distinct topic its own sentence.\n\n"

        "Key Concepts\n"
        "The essential ideas, principles, or mechanisms, grouped by logical theme. "
        "For each concept: state the idea, explain it plainly, and note its context. "
        "Do not group concepts from unrelated topic clusters under the same theme.\n\n"

        "Detailed Explanation\n"
        "How the concepts work, interact, and matter. "
        "Make relationships explicit — dependencies, contrasts, enabling conditions. "
        "Build on Key Concepts rather than repeating definitions. "
        "If multiple topic clusters exist, explain each cluster before drawing cross-topic connections.\n\n"

        "Examples / Applications\n"
        "Concrete examples from the source, anchored to the concept each illustrates. "
        "Omit only when the input contains no examples and none can be directly inferred.\n\n"

        "Key Terms / Definitions\n"
        "Domain-specific terms from the input, defined as used in the source. Skip common vocabulary."
    )


# ── User Prompt ──────────────────────────────────────────────────────────────

def map_mode_to_difficulty(summary_mode: Optional[str]) -> str:
    """Map a summary mode identifier to a canonical difficulty level."""
    if not summary_mode:
        return "intermediate"
    
    mapping = {
        "key_concepts": "introductory",
        "teach_me_mode": "introductory",
        "concise_summary": "intermediate",
        "detailed_explanation": "advanced",
        "exam_ready_notes": "advanced",
    }
    return mapping.get(summary_mode, "intermediate")


def build_summary_prompt(
    context: str,
    language: str = "en",
    difficulty: str = "intermediate",
    topic: Optional[str] = None,
    summary_mode: Optional[str] = None,
) -> str:
    """Build the user-facing REDUCE prompt, injecting a mode-specific depth strategy.

    This function injects the depth frame or learning style based on summary_mode.
    If summary_mode is not selected, it falls back to the canonical depth strategies
    driven by the difficulty parameter.
    """
    # 1. If difficulty is "adaptive" and no mode is set, default to teach_me_mode.
    #    The engine does not have a real adaptive algorithm for summaries (only for quizzes).
    #    "Teach Me Mode" is the closest semantic match: it adapts to the learner
    #    by using simple language, analogies, and a progressive tutor style.
    if difficulty == "adaptive" and not summary_mode:
        summary_mode = "teach_me_mode"
        logger.info("[TRACE][SYNC] adaptive summary defaulted to teach_me_mode")

    # 2. Sync difficulty with summary_mode if difficulty is default/ambiguous
    if summary_mode and difficulty in ("intermediate", "adaptive"):
        difficulty = map_mode_to_difficulty(summary_mode)
        logger.info("[TRACE][SYNC] Mapped summary_mode '%s' to difficulty '%s'", summary_mode, difficulty)

    lang_phrase = f" Write in {language}." if language and language.lower() != "en" else ""

    # 2. Derive Depth Signal from difficulty
    if difficulty in ("introductory", "beginner", "easy"):
        depth_signal = (
            "DEPTH STRATEGY: INTRODUCTORY\n"
            "Coverage: 1-2 essential concepts per topic cluster. Skip sub-concepts.\n"
            "Explanation: Surface-level summary of what and why."
        )
    elif difficulty in ("advanced", "hard"):
        depth_signal = (
            "DEPTH STRATEGY: ADVANCED\n"
            "Coverage: Exhaustive coverage of all material, preserving all nuances."
        )
    else:
        depth_signal = (
            "DEPTH STRATEGY: INTERMEDIATE\n"
            "Coverage: All major concepts with moderate depth."
        )

    # 3. Derive Mode-specific Instruction
    mode_instruction = ""
    if summary_mode == "key_concepts":
        mode_instruction = (
            "MODE: KEY CONCEPTS\n"
            "Goal: Extract ONLY essential points and definitions.\n"
            "Format: Bullet-point format for rapid revision.\n"
            "Constraint: No filler content, no elaborate reasoning. Focus on 'the what'."
        )
    elif summary_mode == "concise_summary":
        mode_instruction = (
            "MODE: CONCISE SUMMARY\n"
            "Goal: Balanced compression of content.\n"
            "Format: Short, highly structured paragraphs.\n"
            "Constraint: Explain the core concepts without exhaustive detail."
        )
    elif summary_mode == "detailed_explanation":
        mode_instruction = (
            "MODE: DETAILED EXPLANATION\n"
            "Goal: Step-by-step reasoning and context.\n"
            "Format: Comprehensive sections with depth.\n"
            "Constraint: Include reasoning, background context, and all supporting details."
        )
    elif summary_mode == "exam_ready_notes":
        mode_instruction = (
            "MODE: EXAM READY NOTES\n"
            "Goal: Optimization for exam preparation.\n"
            "Format: Headings + definitions + formulas + quick-recall facts.\n"
            "Constraint: Use a highly structured revision format."
        )
    elif summary_mode == "teach_me_mode":
        mode_instruction = (
            "MODE: TEACH ME (TUTOR STYLE)\n"
            "Goal: Progressive learning through simple language.\n"
            "Format: Conversational, tutor-style explanation.\n"
            "Constraint: Use analogies and simple language to explain complex ideas."
        )

    # Combine signals
    combined_strategy = f"{mode_instruction}\n{depth_signal}" if mode_instruction else depth_signal

    prompt = (
        f"{combined_strategy}{lang_phrase}\n\n"
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

def _build_map_prompt(
    chunk_text: str,
    language: str,
    difficulty: str,
    summary_mode: Optional[str] = None,
) -> str:
    """Build a mode-aware or difficulty-aware MAP prompt for a single chunk.

    Modes leverage semantic goals; legacy difficulty extracts based on depth.
    """
    # 1. Mode-based semantic extraction
    if summary_mode == "key_concepts":
        extract_level = (
            "Extract ONLY the 2-3 most essential concepts and their basic definitions. "
            "Ignore all supporting details, reasoning, or examples."
        )
    elif summary_mode == "concise_summary":
        extract_level = (
            "Extract all major facts and concepts, but compress them significantly. "
            "Keep the core ideas but discard minor nuances."
        )
    elif summary_mode == "detailed_explanation":
        extract_level = (
            "Extract all facts, concepts, details, and context. "
            "Preserve causal relationships and reasoning chains for later synthesis."
        )
    elif summary_mode == "exam_ready_notes":
        extract_level = (
            "Extract all formulas, definitions, and key facts. "
            "Identify content likely to appear in an exam."
        )
    elif summary_mode == "teach_me_mode":
        extract_level = (
            "Extract concepts in a way that highlights analogies and simple explanations. "
            "Identify the 'why' and 'how' behind each point."
        )
    # 2. Fallback to legacy difficulty-based extraction
    elif difficulty in ("introductory", "beginner", "easy"):
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
    summary_mode: Optional[str] = None,
) -> str:
    """Summarize a single chunk for the MAP stage.

    Delegates to the shared ``_stream_ollama_generate`` for the actual LLM call.

    Uses ``MAP_CHUNK_TIMEOUT_SECONDS`` (default 90 s) rather than the caller-
    supplied ``timeout`` (typically 300 s) so that a stalled Ollama request
    releases its concurrency slot quickly instead of blocking for 5 minutes.
    Falls back to the caller timeout only when MAP_CHUNK_TIMEOUT_SECONDS is
    unset or larger than the caller value.
    """


    # Use the tighter MAP-specific timeout to bound executor thread hold time.
    effective_timeout = min(timeout, MAP_CHUNK_TIMEOUT_SECONDS)

    prompt = _build_map_prompt(chunk_text, language, difficulty, summary_mode)
    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
        "options": {
            "num_predict": 512,      # Cap output to prevent chatty MAP summaries
            "temperature": 0.1,      # Deterministic extraction
            "top_k": 20,
            "top_p": 0.9,
            "num_ctx": 4096,         # MAP chunks are small, so 4k is plenty
        },
        "keep_alive": -1,
    }

    prompt_chars = len(prompt)
    logger.info(
        "[SUMMARY][MAP_CHUNK] model=%s prompt_chars=%d chunk_chars=%d timeout=%d difficulty=%s mode=%s",
        OLLAMA_GENERATION_MODEL, prompt_chars, len(chunk_text), effective_timeout, difficulty, summary_mode,
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
    """Filter, coalesce, and cap chunks for MAP processing.
    
    Restoration refinement: Individual 1500-char chunks are merged into
    blocks of ~4500 chars (MAP_BLOCK_CHARS) to reduce the total number
    of sequential LLM calls and fixed startup overhead.
    """
    raw_eligible = [c for c in chunks if len(c.strip()) >= _MIN_CHUNK_CHARS]
    
    coalesced = []
    current_block = []
    current_len = 0
    for chunk in raw_eligible:
        if current_len + len(chunk) > MAP_BLOCK_CHARS and current_block:
            coalesced.append("\n\n".join(current_block))
            current_block = [chunk]
            current_len = len(chunk)
        else:
            current_block.append(chunk)
            current_len += len(chunk)
    if current_block:
        coalesced.append("\n\n".join(current_block))
    
    if len(coalesced) > max_chunks:
        logger.warning(
            "[SUMMARY][MAP] capping %d blocks to %d", len(coalesced), max_chunks,
        )
        coalesced = coalesced[:max_chunks]
        
    return coalesced


def generate_map_summaries(
    chunks: List[str],
    language: str = "en",
    difficulty: str = "intermediate",
    timeout: int = OLLAMA_GENERATION_TIMEOUT,
    retries: int = OLLAMA_REQUEST_RETRIES,
    max_chunks: Optional[int] = None,
    summary_mode: Optional[str] = None,
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
        "[SUMMARY][MAP_START] total_chunks=%d eligible=%d total_chars=%d cap=%d concurrency=%d difficulty=%s mode=%s",
        len(chunks), len(eligible), total_input_chars, cap, concurrency, difficulty, summary_mode,
    )

    results = [None] * len(eligible)
    chunk_timings = [0] * len(eligible)

    def _run_chunk(idx_chunk):
        idx, chunk = idx_chunk
        chunk_start = time.perf_counter()
        logger.info("[SUMMARY][MAP] chunk %d/%d chars=%d", idx + 1, len(eligible), len(chunk))
        summary = _map_summarize_chunk(chunk, language, difficulty, timeout, retries, summary_mode=summary_mode)
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
    summary_mode: Optional[str] = None,
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
                None, _map_summarize_chunk, chunk, language, difficulty, timeout, retries, summary_mode,
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
    summary_mode: Optional[str] = None,
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
        "[SUMMARY][STREAM_START] chunks=%d difficulty=%s mode=%s topic=%s",
        len(chunks), difficulty, summary_mode, topic,
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
        yield "[PROGRESS] Generating one-shot summary..."
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
                summary_mode=summary_mode,
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
    prompt = build_summary_prompt(context, language, difficulty, topic, summary_mode)

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
            "num_ctx": adaptive_num_ctx,
            "num_predict": 2048,
            "temperature": 0.7,
        }
    }

    reduce_prompt_chars = len(prompt)
    # Stability patch: dynamic timeout
    dynamic_timeout = get_dynamic_timeout(0) # Summary reduce uses default or adaptive
    
    logger.info(
        "[SUMMARY][REDUCE_START] model=%s prompt_chars=%d context_chars=%d timeout=%s",
        OLLAMA_GENERATION_MODEL, reduce_prompt_chars, len(context), str(dynamic_timeout),
    )

    retries = OLLAMA_REQUEST_RETRIES
    for attempt in range(1, retries + 1):
        reduce_start = time.perf_counter()
        first_token_logged = False
        token_count = 0
        total_chars_out = 0
        attempt_succeeded = False

        try:
            start_time = time.time()
            logger.info("[OLLAMA] [SUMMARY_REDUCE] Generation started", extra={
                "attempt": attempt,
                "timestamp": start_time,
                "timeout": str(dynamic_timeout)
            })
            async with httpx.AsyncClient(timeout=dynamic_timeout) as client:
                async with client.stream("POST", OLLAMA_GENERATE_URL, json=payload) as resp:
                    resp.raise_for_status()
                    logger.info(
                        "[SUMMARY][REDUCE_HTTP_OK] attempt=%d/%d status=%d ttfb_ms=%d",
                        attempt, retries, resp.status_code,
                        int((time.time() - start_time) * 1000),
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
                            duration = time.time() - start_time
                            overall_ms = int((time.time() - overall_start) * 1000)
                            logger.info(
                                "[SUMMARY][REDUCE_DONE] attempt=%d/%d ms=%d tokens=%d chars=%d tok/s=%.1f overall_ms=%d",
                                attempt, retries, int(duration * 1000), token_count, total_chars_out, (token_count/duration if duration > 0 else 0), overall_ms,
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
    summary_mode: Optional[str] = None,
    timeout: int = OLLAMA_GENERATION_TIMEOUT,
    retries: int = OLLAMA_REQUEST_RETRIES,
) -> str:
    """Generate a complete summary synchronously (for the Celery fallback path).

    Runs MAP/REDUCE in a blocking fashion and returns the full summary text.
    """
    if not chunks:
        return "Not enough context to generate summary."

    # ── Pre-flight check ──
    total_chars = sum(len(c) for c in chunks)
    logger.info(
        "[SUMMARY][SYNC] total_chars=%d threshold=%d chunks=%d",
        total_chars, SUMMARY_MAX_CONTEXT_CHARS, len(chunks),
    )

    # Guard: if the document has almost no text (e.g. a scanned image with minimal OCR),
    # there is nothing meaningful to summarize. Return a clear, helpful message immediately
    # instead of burning 10+ minutes on LLM calls that will produce empty output.
    _MIN_SUMMARY_CHARS = 200
    if total_chars < _MIN_SUMMARY_CHARS:
        logger.warning(
            "[SUMMARY][SYNC_SKIP] total_chars=%d < min=%d — document has too little text to summarize",
            total_chars, _MIN_SUMMARY_CHARS,
        )
        return (
            "This document doesn't contain enough readable text to generate a summary. "
            "If it's a scanned image or PDF, try re-uploading with OCR enabled."
        )

    # ── MAP ── (only when content genuinely exceeds the one-shot threshold)
    if total_chars > SUMMARY_MAX_CONTEXT_CHARS:
        logger.info(
            "[SUMMARY][SYNC_MAP] total_chars=%d > threshold=%d — running MAP",
            total_chars, SUMMARY_MAX_CONTEXT_CHARS,
        )
        mapped = generate_map_summaries(
            chunks, language, difficulty, timeout, retries,
            max_chunks=MAP_MAX_CHUNKS,
            summary_mode=summary_mode,
        )
        if mapped:
            chunks = mapped
    else:
        logger.info(
            "[SUMMARY][SYNC_MAP_SKIP] total_chars=%d <= threshold=%d — using one-shot path",
            total_chars, SUMMARY_MAX_CONTEXT_CHARS,
        )

    # ── REDUCE ──
    context = _build_summary_context(chunks)
    prompt = build_summary_prompt(context, language, difficulty, topic, summary_mode)

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
            dynamic_timeout = get_dynamic_timeout(0)
            start = time.perf_counter()
            text = _stream_ollama_generate(payload, timeout=dynamic_timeout, material_type="summary")
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

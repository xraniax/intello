import asyncio
import json
import logging
import os
import time
from typing import AsyncGenerator, AsyncIterator

logger = logging.getLogger("engine-stream-core")

# ── Batching configuration ───────────────────────────────────────────────────
# Tokens accumulate in an in-memory buffer and are flushed as a single SSE
# event when EITHER condition is met.  This reduces SSE overhead from ~50
# events/sec (one per Ollama token) to ~15-20 events/sec without adding
# perceptible latency.
#
# BATCH_FLUSH_MS:    max time (ms) a token can sit in the buffer before flush.
# BATCH_FLUSH_CHARS: max chars that can accumulate before an immediate flush.
BATCH_FLUSH_MS = int(os.getenv("SSE_BATCH_FLUSH_MS", "60"))
BATCH_FLUSH_CHARS = int(os.getenv("SSE_BATCH_FLUSH_CHARS", "40"))


def _sse(payload: dict) -> str:
    # SSE spec requires actual newline characters (0x0A), not the escape sequence \n
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def stream_llm_response(generator: AsyncIterator[str], *, source: str) -> AsyncGenerator[str, None]:
    """Normalize raw text chunks into a unified SSE contract.

    Contract:
    - delta: {"type": "delta", "data": "..."}
    - final: {"type": "final", "done": true}
    - error: {"type": "error", "message": "..."}

    Batching:
    Individual token yields from the upstream generator are accumulated in a
    buffer.  The buffer is flushed as a single combined ``delta`` event when
    either ``BATCH_FLUSH_MS`` (default 60 ms) has elapsed since the last
    flush, or the buffer reaches ``BATCH_FLUSH_CHARS`` (default 40 chars).
    Non-delta payloads (progress markers, errors) trigger an immediate flush
    of any pending delta buffer before being emitted themselves.
    """
    started_at = time.perf_counter()
    chunk_count = 0
    sse_event_count = 0
    keepalive_count = 0
    first_delta_logged = False
    total_chars = 0

    # ── Batching state ───────────────────────────────────────────────────
    batch_buf: list[str] = []
    batch_chars = 0
    batch_deadline = 0.0  # perf_counter timestamp for next forced flush
    flush_interval = BATCH_FLUSH_MS / 1000.0  # convert ms → seconds

    iterator = generator.__aiter__()
    pending_task = None

    async def _get_next():
        return await iterator.__anext__()

    def _start_batch_timer():
        """Reset the batch deadline to now + flush_interval."""
        nonlocal batch_deadline
        batch_deadline = time.perf_counter() + flush_interval

    def _build_flush() -> str | None:
        """Drain the buffer into a single SSE delta event (or None if empty)."""
        nonlocal batch_buf, batch_chars, sse_event_count
        if not batch_buf:
            return None
        combined = "".join(batch_buf)
        batch_buf.clear()
        batch_chars = 0
        sse_event_count += 1
        return _sse({"type": "delta", "data": combined})

    try:
        while True:
            # ── Determine how long we can wait for the next token ─────────
            # If the buffer has pending data, we wait only until the batch
            # deadline so we can flush on time.  If the buffer is empty we
            # use the normal 15 s keepalive timeout.
            if batch_buf:
                remaining = max(batch_deadline - time.perf_counter(), 0)
                wait_timeout = remaining if remaining > 0 else 0.001
            else:
                wait_timeout = 15  # keepalive timeout

            if pending_task is None:
                pending_task = asyncio.create_task(_get_next())

            try:
                raw = await asyncio.wait_for(asyncio.shield(pending_task), timeout=wait_timeout)
                pending_task = None
            except asyncio.TimeoutError:
                # Two cases: batch timer expired, or keepalive timeout.
                flush_payload = _build_flush()
                if flush_payload:
                    yield flush_payload
                    continue

                # No pending batch — this is a true keepalive timeout.
                keepalive_count += 1
                elapsed_ms = int((time.perf_counter() - started_at) * 1000)
                if keepalive_count <= 3 or keepalive_count % 10 == 0:
                    logger.info(
                        "[TRACE][STREAM_CORE_KEEPALIVE] source=%s keepalive_count=%d elapsed_ms=%d",
                        source, keepalive_count, elapsed_ms,
                    )
                yield ": keep-alive\n\n"
                continue
            except StopAsyncIteration:
                break

            if raw is None:
                continue

            text = str(raw)
            if text == "":
                continue

            # Progress markers from the pipeline are emitted as a separate SSE
            # event type that the frontend can safely ignore (it only processes
            # type="delta").  This keeps the connection active with real events
            # during long-running stages like MAP instead of relying solely on
            # keep-alive comments.
            if text.startswith("[PROGRESS]"):
                # Flush any pending delta buffer before the non-delta event.
                flush_payload = _build_flush()
                if flush_payload:
                    yield flush_payload
                progress_msg = text[10:].strip()
                yield _sse({"type": "progress", "stage": progress_msg or "processing"})
                continue

            # ── Accumulate delta token into the batch buffer ─────────────
            chunk_count += 1
            total_chars += len(text)

            if not first_delta_logged:
                first_delta_ms = int((time.perf_counter() - started_at) * 1000)
                logger.info(
                    "[TRACE][STREAM_CORE_FIRST_DELTA] source=%s time_to_first_delta_ms=%d",
                    source, first_delta_ms,
                )
                first_delta_logged = True

            batch_buf.append(text)
            batch_chars += len(text)

            # Start timer on first token entering an empty buffer.
            if len(batch_buf) == 1:
                _start_batch_timer()

            # Flush immediately if buffer exceeds char threshold.
            if batch_chars >= BATCH_FLUSH_CHARS:
                flush_payload = _build_flush()
                if flush_payload:
                    yield flush_payload

    except asyncio.CancelledError:
        logger.info("[TRACE][STREAM_CORE_CANCELLED] source=%s stream cancelled by client", source)
        raise
    except Exception as e:
        logger.exception(
            "[TRACE][STREAM_CORE_ERROR] source=%s stream error=%s elapsed_ms=%d",
            source, e, int((time.perf_counter() - started_at) * 1000),
        )
        # Flush pending buffer before emitting the error.
        flush_payload = _build_flush()
        if flush_payload:
            yield flush_payload
        yield _sse({"type": "error", "message": str(e)})
    finally:
        # Check if we are inside an active exception that prevents yielding (like CancelledError)
        import sys
        exc_type, _, _ = sys.exc_info()
        is_closing = exc_type is GeneratorExit or exc_type is asyncio.CancelledError

        if pending_task and not pending_task.done():
            pending_task.cancel()

        if not is_closing:
            # Flush any remaining buffered tokens.
            flush_payload = _build_flush()
            if flush_payload:
                yield flush_payload

        duration_ms = int((time.perf_counter() - started_at) * 1000)
        logger.info(
            "[TRACE][STREAM_CORE_END] source=%s tokens=%d sse_events=%d chars=%d keepalives=%d duration_ms=%d",
            source,
            chunk_count,
            sse_event_count,
            total_chars,
            keepalive_count,
            duration_ms,
        )

        try:
            if hasattr(iterator, "aclose"):
                await iterator.aclose()  # type: ignore[attr-defined]
        except Exception:
            logger.debug("[STREAM_CORE] source=%s iterator close failed", source)

        if not is_closing:
            yield _sse({"type": "final", "done": True})

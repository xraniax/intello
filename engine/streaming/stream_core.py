import asyncio
import json
import logging
import time
from typing import AsyncGenerator, AsyncIterator

logger = logging.getLogger("engine-stream-core")


def _sse(payload: dict) -> str:
    # SSE spec requires actual newline characters (0x0A), not the escape sequence \n
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def stream_llm_response(generator: AsyncIterator[str], *, source: str) -> AsyncGenerator[str, None]:
    """Normalize raw text chunks into a unified SSE contract.

    Contract:
    - delta: {"type": "delta", "data": "..."}
    - final: {"type": "final", "done": true}
    - error: {"type": "error", "message": "..."}
    """
    started_at = time.perf_counter()
    chunk_count = 0
    keepalive_count = 0
    first_delta_logged = False
    total_chars = 0

    iterator = generator.__aiter__()

    try:
        while True:
            try:
                raw = await asyncio.wait_for(iterator.__anext__(), timeout=15)
            except asyncio.TimeoutError:
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

            chunk_count += 1
            total_chars += len(text)
            if not first_delta_logged:
                first_delta_ms = int((time.perf_counter() - started_at) * 1000)
                logger.info(
                    "[TRACE][STREAM_CORE_FIRST_DELTA] source=%s time_to_first_delta_ms=%d",
                    source, first_delta_ms,
                )
                first_delta_logged = True
            yield _sse({"type": "delta", "data": text})
    except Exception as e:
        logger.exception("[TRACE][STREAM_CORE_ERROR] source=%s stream error=%s elapsed_ms=%d", source, e, int((time.perf_counter() - started_at) * 1000))
        yield _sse({"type": "error", "message": str(e)})
    finally:
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        logger.info(
            "[TRACE][STREAM_CORE_END] source=%s chunks=%d chars=%d keepalives=%d duration_ms=%d",
            source,
            chunk_count,
            total_chars,
            keepalive_count,
            duration_ms,
        )

        try:
            if hasattr(iterator, "aclose"):
                await iterator.aclose()  # type: ignore[attr-defined]
        except Exception:
            logger.debug("[STREAM_CORE] source=%s iterator close failed", source)

        yield _sse({"type": "final", "done": True})

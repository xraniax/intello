"""Chat and retrieval routes."""
import json
import logging
import time
from uuid import uuid4, UUID

import httpx
import requests
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .._route_utils import _stage_error_response, get_db
from ..generation import (
    OLLAMA_CHAT_TIMEOUT,
    OLLAMA_GENERATE_URL,
    OLLAMA_GENERATION_MODEL,
    OLLAMA_BASE_URL,
    condense_question,
    generate_structured_chat,
)
from ..retrieval import retrieve_chunks_by_topic
from ..schemas import ChatRequest, ChatSource, RetrieveRequest, UnifiedChatRequest, UnifiedChatResponse
from models import Document, Chunk

router = APIRouter()
logger = logging.getLogger("engine-api")

SIMILARITY_THRESHOLD = 0.50


@router.post("/retrieve")
async def retrieve_route(body: RetrieveRequest, db: Session = Depends(get_db)):
    """Retrieve top-k relevant chunks for a given topic and subject."""
    logger.info("Retrieve request for subject: %s, topic: %s", body.subject_id, body.topic)
    try:
        chunks = retrieve_chunks_by_topic(db, str(body.subject_id), body.topic, body.top_k)
        return {
            "status": "success", "stage": "retrieval", "count": len(chunks),
            "chunks": [{"id": c.id, "content": c.content, "document_id": c.document_id} for c in chunks],
        }
    except Exception as e:
        logger.exception("Retrieval failed")
        return _stage_error_response("retrieval", "Retrieval failed", details=str(e), status_code=500)


@router.post("/chat", response_model=UnifiedChatResponse)
async def chat_route(body: UnifiedChatRequest, db: Session = Depends(get_db)):
    """Grounded conversational QA with retrieval, generation, and source attribution."""
    t_start = time.perf_counter()
    request_id = str(uuid4())
    logger.info("[CHAT] request_id=%s subject_id=%s question_len=%d history_turns=%d",
                request_id, body.subject_id, len(body.question), len(body.conversation_history))

    try:
        subject_uuid = body.subject_id
        if isinstance(subject_uuid, str):
            try:
                subject_uuid = UUID(subject_uuid)
            except ValueError:
                pass

        total_doc_count = db.query(Document).filter(Document.subject_id == subject_uuid).count()
        if total_doc_count == 0:
            return UnifiedChatResponse(
                answer="You haven't uploaded any documents to this workspace yet. Please upload some materials to start chatting!",
                sources=[], confidence=0.0,
                latency_ms=round((time.perf_counter() - t_start) * 1000, 2),
            )

        processed_doc_count = db.query(Document).join(Chunk).filter(Document.subject_id == subject_uuid).distinct().count()
        if processed_doc_count == 0:
            return UnifiedChatResponse(
                answer="I see you have uploads, but they are still being processed. Please wait a moment until they are ready for chat.",
                sources=[], confidence=0.0,
                latency_ms=round((time.perf_counter() - t_start) * 1000, 2),
            )
    except Exception as e:
        logger.error("[CHAT] request_id=%s failed to check document states: %s", request_id, e)

    try:
        history_dicts = [{"role": msg.role, "content": msg.content} for msg in body.conversation_history]
        retrieval_topic = await condense_question(question=body.question, history=history_dicts, language=body.language)

        chunks_with_scores = retrieve_chunks_by_topic(
            db, body.subject_id, retrieval_topic,
            material_ids=body.material_ids, top_k=body.top_k
        )

        def _history_fallback_topic():
            return " ".join([msg["content"] for msg in history_dicts[-4:]] + [body.question])

        if history_dicts:
            if not chunks_with_scores:
                fallback_topic = _history_fallback_topic()
                logger.info("[CHAT] request_id=%s no chunks found for condensed topic, retrying retrieval with history-aware fallback", request_id)
                chunks_with_scores = retrieve_chunks_by_topic(
                    db, body.subject_id, fallback_topic,
                    material_ids=body.material_ids, top_k=body.top_k
                )

        if not chunks_with_scores:
            msg = ("I couldn't find any relevant information in the selected materials. "
                   "Try selecting different documents or asking from all uploads."
                   if body.material_ids else
                   "I couldn't find any relevant information in your uploaded documents for this question.")
            return UnifiedChatResponse(
                answer=msg, sources=[], confidence=0.0,
                latency_ms=round((time.perf_counter() - t_start) * 1000, 2),
            )

        max_similarity = max(score for _, score in chunks_with_scores)

        if max_similarity < SIMILARITY_THRESHOLD and history_dicts:
            fallback_topic = _history_fallback_topic()
            logger.info("[CHAT] request_id=%s low similarity (%.4f) for condensed topic, retrying retrieval with history-aware fallback", request_id, max_similarity)
            fallback_results = retrieve_chunks_by_topic(
                db, body.subject_id, fallback_topic,
                material_ids=body.material_ids, top_k=body.top_k
            )
            if fallback_results:
                fallback_max_similarity = max(score for _, score in fallback_results)
                if fallback_max_similarity > max_similarity:
                    logger.info("[CHAT] request_id=%s fallback retrieval improved similarity from %.4f to %.4f", request_id, max_similarity, fallback_max_similarity)
                    chunks_with_scores = fallback_results
                    max_similarity = fallback_max_similarity

        for c, score in chunks_with_scores:
            logger.debug("[CHAT] request_id=%s chunk_id=%d similarity=%.4f", request_id, c.id, score)
        logger.info("[CHAT] request_id=%s max_similarity=%.4f threshold=%.2f",
                    request_id, max_similarity, SIMILARITY_THRESHOLD)

        if max_similarity < SIMILARITY_THRESHOLD:
            # If there's conversation history, be more lenient since follow-up questions
            # may not directly match documents but are contextually related.
            if history_dicts and max_similarity > (SIMILARITY_THRESHOLD * 0.6):
                logger.info("[CHAT] request_id=%s Accepting follow-up question with reduced threshold: %.4f",
                            request_id, max_similarity)
            else:
                return UnifiedChatResponse(
                    answer="That question appears unrelated to the selected material.",
                    sources=[], confidence=max_similarity,
                    latency_ms=round((time.perf_counter() - t_start) * 1000, 2),
                )

        chunk_dicts = [
            {"id": c.id, "document_id": c.document_id,
             "page_number": getattr(c, "page_number", None),
             "content": c.content or "", "similarity": score}
            for c, score in chunks_with_scores
        ]

        result = await generate_structured_chat(
            chunks=chunk_dicts, question=body.question,
            history=history_dicts, language=body.language
        )
        t_elapsed_ms = round((time.perf_counter() - t_start) * 1000, 2)

        chunk_by_id = {c.id: c for c, _ in chunks_with_scores}
        cited_ids = result.get("cited_ids") or []
        sources = [
            ChatSource(
                chunk_id=cid, document_id=chunk_by_id[cid].document_id,
                material_id=str(chunk_by_id[cid].document.material_id)
                    if getattr(chunk_by_id[cid], "document", None)
                    and getattr(chunk_by_id[cid].document, "material_id", None) else None,
                page_number=getattr(chunk_by_id[cid], "page_number", None),
                excerpt=(chunk_by_id[cid].content or "")[:200],
            )
            for cid in cited_ids if cid in chunk_by_id
        ]

        logger.info("[CHAT] request_id=%s latency_ms=%.1f confidence=%.2f sources=%d",
                    request_id, t_elapsed_ms, result["confidence"], len(sources))

        return UnifiedChatResponse(
            answer=result["answer"], sources=sources,
            confidence=result["confidence"], latency_ms=t_elapsed_ms
        )

    except (ConnectionError, TimeoutError, requests.exceptions.ConnectionError, requests.exceptions.Timeout) as conn_err:
        logger.error("[CHAT] request_id=%s ollama_unavailable error=%s", request_id, conn_err)
        raise HTTPException(status_code=503,
                            detail="The AI engine is temporarily unavailable. Please try again in a moment.") from conn_err
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[CHAT] request_id=%s unhandled error", request_id)
        raise HTTPException(status_code=500, detail=f"Chat failed: {exc}") from exc


@router.post("/chat/stream")
async def chat_stream_route(body: UnifiedChatRequest, db: Session = Depends(get_db)):
    """SSE streaming chat — same RAG pipeline as /chat but streams tokens progressively.

    Event protocol:
      data: {"type": "token",   "text": "..."}        — each token as it arrives
      data: {"type": "done",    "sources": [...], "confidence": 0.9}  — final metadata
      data: {"type": "error",   "message": "..."}     — on failure
    """
    request_id = str(uuid4())
    logger.info("[CHAT/STREAM] request_id=%s subject_id=%s", request_id, body.subject_id)

    async def event_stream():
        try:
            # ── 1. Document state checks ───────────────────────────────────────
            try:
                subject_uuid = body.subject_id
                if isinstance(subject_uuid, str):
                    try:
                        subject_uuid = UUID(subject_uuid)
                    except ValueError:
                        pass

                total_doc_count = db.query(Document).filter(Document.subject_id == subject_uuid).count()
                if total_doc_count == 0:
                    no_docs_msg = "You haven't uploaded any documents yet. Please upload some materials to start chatting!"
                    yield f'data: {json.dumps({"type": "token", "text": no_docs_msg})}\n\n'
                    yield f'data: {json.dumps({"type": "done", "sources": [], "confidence": 0.0})}\n\n'
                    return

                processed_doc_count = (
                    db.query(Document).join(Chunk)
                    .filter(Document.subject_id == subject_uuid).distinct().count()
                )
                if processed_doc_count == 0:
                    yield f'data: {json.dumps({"type": "token", "text": "Your uploads are still being processed. Please wait a moment and try again."})}\n\n'
                    yield f'data: {json.dumps({"type": "done", "sources": [], "confidence": 0.0})}\n\n'
                    return
            except Exception as e:
                logger.warning("[CHAT/STREAM] request_id=%s doc-check failed: %s", request_id, e)

            # ── 2. Retrieve chunks (use original question — skip condense to avoid
            #       a blocking Ollama round-trip before any tokens are streamed) ─
            history_dicts = [{"role": m.role, "content": m.content} for m in body.conversation_history]
            chunks_with_scores = retrieve_chunks_by_topic(
                db, body.subject_id, body.question,
                material_ids=body.material_ids, top_k=min(body.top_k, 4)
            )

            if not chunks_with_scores:
                msg = ("I couldn't find relevant information in the selected materials."
                       if body.material_ids else
                       "I couldn't find relevant information in your uploaded documents for this question.")
                yield f'data: {json.dumps({"type": "token", "text": msg})}\n\n'
                yield f'data: {json.dumps({"type": "done", "sources": [], "confidence": 0.0})}\n\n'
                return

            max_similarity = max(score for _, score in chunks_with_scores)
            logger.info("[CHAT/STREAM] request_id=%s max_similarity=%.4f", request_id, max_similarity)

            if max_similarity < SIMILARITY_THRESHOLD:
                msg = "That question appears unrelated to the selected material."
                yield f'data: {json.dumps({"type": "token", "text": msg})}\n\n'
                yield f'data: {json.dumps({"type": "done", "sources": [], "confidence": max_similarity})}\n\n'
                return

            # ── 4. Build streaming prompt ─────────────────────────────────────
            context_parts = []
            for c, _ in chunks_with_scores:
                page = getattr(c, "page_number", None)
                page_str = f" p.{page}" if page is not None else ""
                # Cap each chunk at 300 chars to keep total context small
                snippet = (c.content or "").strip()[:300]
                context_parts.append(f"[{c.id}{page_str}] {snippet}")
            context_block = "\n".join(context_parts)

            # Only include the last 4 turns of history
            history_lines = []
            for msg in history_dicts[-4:]:
                role = str(msg.get("role", "user")).capitalize()
                content = str(msg.get("content", "")).strip()[:200]
                if content:
                    history_lines.append(f"{role}: {content}")
            history_block = "\n".join(history_lines) if history_lines else ""

            prompt = (
                f"You are a study assistant. Answer based ONLY on the context below. "
                f"Respond in {body.language}. Be concise.\n\n"
                f"Context:\n{context_block}\n\n"
            )
            if history_block:
                prompt += f"History:\n{history_block}\n\n"
            prompt += f"Question: {body.question}\nAnswer:"

            ollama_payload = {
                "model": OLLAMA_GENERATION_MODEL,
                "prompt": prompt,
                "stream": True,
                "options": {
                    "num_ctx": 2048,
                    "num_predict": 512,
                    "temperature": 0.7,
                },
            }

            # ── 5. Stream tokens from Ollama ──────────────────────────────────
            timeout = httpx.Timeout(OLLAMA_CHAT_TIMEOUT)
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("POST", OLLAMA_GENERATE_URL, json=ollama_payload) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk_data = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        piece = chunk_data.get("response")
                        if isinstance(piece, str) and piece:
                            yield f'data: {json.dumps({"type": "token", "text": piece})}\n\n'
                        if chunk_data.get("done") is True:
                            break

            # ── 6. Final done event with sources ─────────────────────────────
            chunk_by_id = {c.id: c for c, _ in chunks_with_scores}
            sources_payload = []
            for c, score in chunks_with_scores[:5]:  # Top 5 sources
                doc = getattr(c, "document", None)
                material_id = str(doc.material_id) if doc and getattr(doc, "material_id", None) else None
                sources_payload.append({
                    "chunk_id": c.id,
                    "document_id": c.document_id,
                    "material_id": material_id,
                    "page_number": getattr(c, "page_number", None),
                    "excerpt": (c.content or "")[:200],
                })

            yield f'data: {json.dumps({"type": "done", "sources": sources_payload, "confidence": round(max_similarity, 3)})}\n\n'

        except Exception as exc:
            logger.exception("[CHAT/STREAM] request_id=%s unhandled error", request_id)
            yield f'data: {json.dumps({"type": "error", "message": "An error occurred while generating the response."})}\n\n'

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

"""Chat and retrieval routes."""
import json
import logging
import time
from uuid import uuid4

import httpx
import requests
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from streaming.stream_core import stream_llm_response
from .._route_utils import _stage_error_response, get_db
from ..generation import (
    OLLAMA_CHAT_TIMEOUT,
    OLLAMA_GENERATE_URL,
    OLLAMA_GENERATION_MODEL,
    condense_question,
    generate_structured_chat,
)
from ..retrieval import retrieve_chunks_by_topic
from ..schemas import ChatRequest, ChatSource, RetrieveRequest, UnifiedChatRequest, UnifiedChatResponse

router = APIRouter()
logger = logging.getLogger("engine-api")


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
        history_dicts = [{"role": msg.role, "content": msg.content} for msg in body.conversation_history]
        retrieval_topic = await condense_question(question=body.question, history=history_dicts, language=body.language)
        
        # Now returns List[(Chunk, similarity)]
        chunks_with_scores = retrieve_chunks_by_topic(db, body.subject_id, retrieval_topic, body.top_k)

        if not chunks_with_scores:
            logger.warning("[CHAT] request_id=%s no chunks found for subject_id=%s topic=%s",
                           request_id, body.subject_id, retrieval_topic)
            return UnifiedChatResponse(
                answer="I couldn't find that in this document.",
                sources=[], confidence=0.0,
                latency_ms=round((time.perf_counter() - t_start) * 1000, 2),
            )

        # Confidence Gating: check max similarity
        max_similarity = max(score for _, score in chunks_with_scores)
        SIMILARITY_THRESHOLD = 0.65
        
        if max_similarity < SIMILARITY_THRESHOLD:
            logger.info("[CHAT] request_id=%s similarity below threshold (%.2f < %.2f)",
                        request_id, max_similarity, SIMILARITY_THRESHOLD)
            return UnifiedChatResponse(
                answer="That question appears unrelated to the selected material.",
                sources=[], confidence=max_similarity,
                latency_ms=round((time.perf_counter() - t_start) * 1000, 2),
            )

        chunk_dicts = [
            {
                "id": c.id, 
                "document_id": c.document_id, 
                "page_number": getattr(c, "page_number", None), 
                "content": c.content or "",
                "similarity": score
            }
            for c, score in chunks_with_scores
        ]

        result = await generate_structured_chat(chunks=chunk_dicts, question=body.question,
                                          history=history_dicts, language=body.language)
        t_elapsed_ms = round((time.perf_counter() - t_start) * 1000, 2)

        chunk_by_id = {c.id: c for c, _ in chunks_with_scores}
        cited_ids = result.get("cited_ids") or []
        sources = [
            ChatSource(
                chunk_id=cid, document_id=chunk_by_id[cid].document_id,
                page_number=getattr(chunk_by_id[cid], "page_number", None),
                excerpt=(chunk_by_id[cid].content or "")[:200],
            )
            for cid in cited_ids if cid in chunk_by_id
        ]

        logger.info("[CHAT] request_id=%s latency_ms=%.1f confidence=%.2f sources=%d",
                    request_id, t_elapsed_ms, result["confidence"], len(sources))
        
        return UnifiedChatResponse(answer=result["answer"], sources=sources,
                                   confidence=result["confidence"], latency_ms=t_elapsed_ms)

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
async def chat_stream_route(body: ChatRequest, db: Session = Depends(get_db)):
    """SSE chat endpoint that streams model output progressively."""
    logger.info("Chat stream request: subject=%s, query=%s", body.subject_id, body.question)
    try:
        # returns List[(Chunk, similarity)]
        chunks_with_scores = retrieve_chunks_by_topic(db, str(body.subject_id), None, body.top_k)
        chunk_texts = [c.content for c, _ in chunks_with_scores if c.content]
        context = "\n\n".join(chunk_texts)

        if not context.strip():
            async def empty_stream_error():
                raise ValueError("No context found for this subject.")
                yield ""
            return StreamingResponse(stream_llm_response(empty_stream_error(), source="chat"),
                                     media_type="text/event-stream",
                                     headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})

        prompt = (
            f"System instructions: Answer the user's question clearly and concisely based on the provided context in {body.language}. "
            f"If the answer is not in the context, say you don't know based on the provided material.\n\n"
            f"Context:\n---\n{context}\n---\n\n"
            f"User Question: {body.question}\n"
            f"Response:"
        )
        payload = {"model": OLLAMA_GENERATION_MODEL, "prompt": prompt, "stream": True}

        async def chat_generator():
            timeout = httpx.Timeout(OLLAMA_CHAT_TIMEOUT)
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("POST", OLLAMA_GENERATE_URL, json=payload) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        piece = chunk.get("response")
                        if isinstance(piece, str) and piece:
                            yield piece
                        if chunk.get("done") is True:
                            break

        return StreamingResponse(stream_llm_response(chat_generator(), source="chat"),
                                 media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})
    except Exception as e:
        logger.exception("Chat stream setup failed")
        return _stage_error_response("chat_stream", "Chat stream failed", details=str(e), status_code=500)

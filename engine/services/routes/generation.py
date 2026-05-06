"""Generation routes: async Celery dispatch and real-time SSE streaming."""
import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from core.normalization.input_normalizer import SUPPORTED_MATERIAL_TYPES, normalize_material_type
from streaming.stream_core import stream_llm_response
from tasks import task_generate_material
from .._route_utils import _stage_error_response, get_db
from ..generation import generate_study_material_stream
from ..summary_pipeline import generate_summary_stream, MAP_MAX_CHUNKS
from ..retrieval import retrieve_chunks_by_topic, retrieve_sequential_chunks
from ..schemas import GenerateRequest

router = APIRouter()
logger = logging.getLogger("engine-api")


@router.post("/generate")
async def generate_route(body: GenerateRequest, db: Session = Depends(get_db)):
    """Generate study materials asynchronously via Celery. Returns job_id immediately."""
    logger.info("Generate request (async): subject=%s, type=%s, topic=%s",
                body.subject_id, body.material_type, body.topic)
    try:
        request_options = body.generation_options if isinstance(body.generation_options, dict) else {}
        topic = body.topic or request_options.get("topic")
        language = body.language or request_options.get("language") or "en"

        requested_type = (body.material_type or "").strip().lower()
        material_type = normalize_material_type(body.material_type)
        if material_type not in SUPPORTED_MATERIAL_TYPES:
            return _stage_error_response("generation", f"Unsupported material type '{requested_type}'", status_code=400)
        if body.subject_id is None:
            return _stage_error_response("generation", "Missing subject_id for async generation", status_code=400)

        task = task_generate_material.apply_async(kwargs={
            "subject_id": str(body.subject_id) if body.subject_id else "",
            "material_type": material_type,
            "topic": topic,
            "language": language,
            "top_k": body.top_k,
            "user_id": str(body.user_id) if body.user_id else None,
            "options": request_options,
            "chunks": body.chunks,
            "source_filenames": body.source_filenames,
            "material_ids": [str(mid) for mid in body.material_ids] if body.material_ids else None,
        })
        return {
            "status": "SUCCESS", "stage": "generation", "job_id": task.id,
            "message": f"Study material generation for {body.material_type} started in background",
        }
    except Exception as e:
        logger.exception("Generation trigger failed")
        return _stage_error_response("generation", "Study material generation failed to queue",
                                     details=str(e), status_code=500)


@router.post("/generate/stream")
async def generate_stream_route(body: GenerateRequest, db: Session = Depends(get_db)):
    """Generate study materials as real-time SSE chunks, bypassing Celery."""
    logger.info("Generate stream request: subject=%s, type=%s, topic=%s",
                body.subject_id, body.material_type, body.topic)

    request_options = body.generation_options if isinstance(body.generation_options, dict) else {}
    topic = body.topic or request_options.get("topic")
    language = body.language or request_options.get("language") or "en"

    requested_type = (body.material_type or "").strip().lower()
    material_type = normalize_material_type(body.material_type)
    if material_type not in SUPPORTED_MATERIAL_TYPES:
        return _stage_error_response("generation_stream", f"Unsupported material type '{requested_type}'", status_code=400)
    if body.subject_id is None:
        return _stage_error_response("generation_stream", "Missing subject_id for generation stream", status_code=400)

    try:
        if body.chunks and isinstance(body.chunks, list) and len(body.chunks) > 0:
            chunk_texts = body.chunks
        elif material_type == "summary":
            # Direct alignment with task_generate_material logic (S-1 fix)
            chunks_with_scores = retrieve_sequential_chunks(
                db, body.subject_id, limit=MAP_MAX_CHUNKS,
                source_filenames=body.source_filenames or [],
                material_ids=body.material_ids
            )
            chunk_texts = [c.content for c in chunks_with_scores if c.content]
        else:
            chunks_with_scores = retrieve_chunks_by_topic(
                db, str(body.subject_id), topic, body.top_k, 
                source_filenames=body.source_filenames,
                material_ids=body.material_ids
            )
            chunk_texts = [c.content for c, _ in chunks_with_scores if c.content]
    except Exception as e:
        logger.exception("Generation stream retrieval failed")
        return _stage_error_response("generation_stream", "Failed to retrieve context", details=str(e), status_code=500)

    if not chunk_texts:
        return _stage_error_response("generation_stream",
                                     "No document chunks found for the given subject or topic.", status_code=404)

    async def generation_async_generator():
        if material_type == "summary":
            # Direct alignment with task_generate_material logic (S-2)
            # Passes summary_mode from request_options to the dedicated pipeline
            summary_mode = body.summary_mode or request_options.get("summary_mode")
            # difficulty = body.generation_options.get("difficulty", "intermediate") if body.generation_options else "intermediate"
            # Using body.generation_options.get("difficulty") can be redundant since we have difficulty-like options in request_options
            difficulty = request_options.get("difficulty") or "intermediate"
            
            async for piece in generate_summary_stream(
                chunk_texts, topic, language, difficulty, summary_mode
            ):
                if piece is None:
                    continue
                text = str(piece)
                if text.startswith("[ERROR]"):
                    raise RuntimeError(text[7:].strip() or "Summary stream failed")
                yield text
                await asyncio.sleep(0)
        else:
            async for piece in generate_study_material_stream(chunk_texts, material_type, topic, language, options=request_options):
                if piece is None:
                    continue
                text = str(piece)
                if text.startswith("[ERROR]"):
                    raise RuntimeError(text[7:].strip() or "Generation stream failed")
                yield text
                await asyncio.sleep(0)

    return StreamingResponse(
        stream_llm_response(generation_async_generator(), source="generation"),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )

"""Job management routes: status polling, cancellation, SSE streaming."""
import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, Optional
from uuid import uuid4

from celery.result import AsyncResult
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

import celery_app
from .._route_utils import _stage_error_response
from ..document_processor import process_text_pipeline
from ..exam_utils import normalize_exam, wrap_normalized_exam

router = APIRouter()
logger = logging.getLogger("engine-api")

TEXT_JOB_TERMINAL_STATES = {"SUCCESS", "FAILURE", "REVOKED"}
_TEXT_JOBS: Dict[str, Dict[str, Any]] = {}
_TEXT_JOBS_LOCK = asyncio.Lock()


def _normalize_exam_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict) or payload.get("type") != "exam":
        return payload
    
    normalized = normalize_exam(payload)
    return wrap_normalized_exam(payload, normalized)


def _extract_stream_text_from_generation_result(result: Dict[str, Any]) -> Optional[str]:
    """Extract stream-safe text from normalized generation payload only."""
    if not isinstance(result, dict):
        return None
    has_legacy_content = "content" in result
    has_new_payload = "ai_generated_content" in result
    if has_legacy_content and has_new_payload:
        raise ValueError("Mixed contract detected - legacy content leak")
    payload = result.get("ai_generated_content")
    if not isinstance(payload, dict):
        return None
    payload = _normalize_exam_payload(payload)
    content = payload.get("content")
    if content is None:
        return None
    if isinstance(content, str):
        return content
    return json.dumps(content, ensure_ascii=False)


async def _text_job_create(metadata: Optional[Dict[str, Any]] = None) -> str:
    job_id = str(uuid4())
    now = time.time()
    job_entry = {
        "job_id": job_id,
        "status": "PENDING",
        "result": None,
        "error": None,
        "meta": metadata or {},
        "created_at": now,
        "updated_at": now,
        "source": "text",
    }
    async with _TEXT_JOBS_LOCK:
        _TEXT_JOBS[job_id] = job_entry
    return job_id


async def _text_job_get(job_id: str) -> Optional[Dict[str, Any]]:
    async with _TEXT_JOBS_LOCK:
        job = _TEXT_JOBS.get(job_id)
        return dict(job) if job else None


async def _text_job_update(job_id: str, **updates: Any) -> Optional[Dict[str, Any]]:
    async with _TEXT_JOBS_LOCK:
        job = _TEXT_JOBS.get(job_id)
        if not job:
            return None
        job.update(updates)
        job["updated_at"] = time.time()
        return dict(job)


async def _resolve_job(job_id: str) -> Dict[str, Any]:
    text_job = await _text_job_get(job_id)
    if text_job:
        logger.info("[JOB_RESOLVE] job_id=%s kind=text status=%s", job_id, text_job.get("status", "UNKNOWN"))
        return {"kind": "text", "entry": text_job}
    try:
        task_result = AsyncResult(job_id, app=celery_app.celery_app)
        logger.info("[JOB_RESOLVE] job_id=%s kind=celery status=%s", job_id, task_result.status)
        return {"kind": "celery", "entry": task_result}
    except Exception as e:
        logger.exception("[JOB_RESOLVE] job_id=%s kind=unknown error=%s", job_id, e)
        return {"kind": "unknown", "entry": None, "error": str(e)}


async def _run_text_job(
    job_id: str,
    raw_text: str,
    *,
    subject_id: Optional[str],
    document_id: Optional[str],
    user_id: Optional[str],
) -> None:
    await _text_job_update(job_id, status="STARTED")
    try:
        result = await asyncio.to_thread(
            process_text_pipeline,
            raw_text,
            max_chunk_chars=1500,
            chunk_overlap=200,
            include_embeddings=True,
        )
        extracted_text = (result.get("cleaned_text") or raw_text).strip()
        job_result = {
            "status": "SUCCESS",
            "source": "text",
            "document_id": document_id,
            "subject_id": subject_id,
            "user_id": user_id,
            "extracted_text": extracted_text,
            "chunk_count": int(result.get("num_chunks") or 0),
            "provider": "ollama",
            "model": os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text"),
        }
        job_state = await _text_job_get(job_id)
        if job_state and job_state.get("status") == "REVOKED":
            logger.info("Text job %s was cancelled before completion", job_id)
            return
        await _text_job_update(job_id, status="SUCCESS", result=job_result, error=None)
    except Exception as e:
        logger.exception("Text processing job failed for job_id=%s", job_id)
        job_state = await _text_job_get(job_id)
        if job_state and job_state.get("status") == "REVOKED":
            logger.info("Cancelled text job %s exited after revoke", job_id)
            return
        await _text_job_update(job_id, status="FAILURE", error=str(e), result=None)


@router.get("/job/{job_id}")
async def get_job_status(job_id: str):
    """Check the status of a background task."""
    resolved = await _resolve_job(job_id)
    logger.info("[JOB_STATUS] job_id=%s resolved_kind=%s", job_id, resolved.get("kind"))
    if resolved["kind"] == "text":
        text_job = resolved["entry"]
        response = {
            "job_id": job_id,
            "status": text_job.get("status", "UNKNOWN"),
            "result": text_job.get("result"),
            "error": text_job.get("error"),
        }
        if text_job.get("status") == "STARTED":
            response["meta"] = text_job.get("meta") or {}
        return response

    if resolved["kind"] == "unknown":
        return {
            "job_id": job_id,
            "status": "UNKNOWN",
            "error": resolved.get("error") or "Celery not configured properly",
        }

    task_result = resolved["entry"]
    response = {
        "job_id": job_id,
        "status": task_result.status,
        "result": None,
        "error": None,
    }
    if task_result.status == "FAILURE":
        response["error"] = str(task_result.result)
    elif task_result.status == "SUCCESS":
        response["result"] = task_result.result
    elif task_result.status == "STARTED":
        response["meta"] = task_result.info
    return response


@router.post("/job/cancel")
async def cancel_job(payload: dict):
    """Request cancellation of a background Celery task by job id."""
    job_id = (payload or {}).get("job_id")
    if not job_id:
        return _stage_error_response("job_cancel", "Missing job_id", status_code=400)

    text_job = await _text_job_get(job_id)
    if text_job:
        if text_job.get("status") in TEXT_JOB_TERMINAL_STATES:
            return {"status": "success", "stage": "job_cancel", "job_id": job_id, "message": "Job already finished"}
        await _text_job_update(job_id, status="REVOKED", error="Cancelled by user")
        return {"status": "success", "stage": "job_cancel", "job_id": job_id, "message": "Cancellation requested"}

    try:
        celery_app.celery_app.control.revoke(job_id, terminate=False)
        return {"status": "success", "stage": "job_cancel", "job_id": job_id, "message": "Cancellation requested"}
    except Exception as e:
        logger.exception("Job cancellation failed")
        return _stage_error_response("job_cancel", "Failed to cancel job", details=str(e), status_code=500)


@router.get("/job/{job_id}/stream")
async def stream_job_status(job_id: str):
    """SSE stream for task status updates compatible with backend stream proxy."""

    async def event_generator():
        terminal_states = {"SUCCESS", "FAILURE", "REVOKED"}
        iteration = 0
        unknown_iterations = 0
        last_status = None

        while True:
            iteration += 1
            try:
                resolved = await _resolve_job(job_id)

                if resolved["kind"] == "text":
                    unknown_iterations = 0
                    text_job = resolved["entry"]
                    status = text_job.get("status", "UNKNOWN")
                    result = text_job.get("result") if status == "SUCCESS" else None
                    error = text_job.get("error") if status in {"FAILURE", "REVOKED"} else None
                    if status == "SUCCESS" and isinstance(result, dict):
                        chunk_text = result.get("extracted_text") or result.get("status") or "SUCCESS"
                    elif status in {"FAILURE", "REVOKED"}:
                        chunk_text = error or status
                    else:
                        chunk_text = status
                elif resolved["kind"] == "unknown":
                    unknown_iterations += 1
                    status = "UNKNOWN"
                    chunk_text = resolved.get("error") or "Celery not configured properly"
                else:
                    unknown_iterations = 0
                    task_result = resolved["entry"]
                    status = task_result.status
                    result = task_result.result if status == "SUCCESS" else None
                    error = str(task_result.result) if status == "FAILURE" else None

                    if status == "SUCCESS" and isinstance(result, dict):
                        try:
                            generation_stream = _extract_stream_text_from_generation_result(result)
                        except ValueError as contract_error:
                            payload = {"chunk": str(contract_error), "status": "FAILURE", "is_final": True}
                            yield f"data: {json.dumps(payload)}\n\n"
                            break
                        chunk_text = generation_stream or result.get("extracted_text") or result.get("status") or "SUCCESS"
                    elif status == "FAILURE":
                        chunk_text = error or "FAILURE"
                    elif status == "RETRY":
                        # RETRY is a transient Celery state — the task will re-execute
                        # after its countdown. Keep polling; do NOT treat as terminal.
                        # Celery will transition to SUCCESS or FAILURE on its own.
                        chunk_text = "Retrying generation..."
                    else:
                        chunk_text = status

                logger.info(
                    "[JOB_STREAM] job_id=%s iteration=%d kind=%s status=%s unknown_iterations=%d",
                    job_id, iteration, resolved.get("kind"), status, unknown_iterations,
                )
                if status != last_status:
                    logger.info("[JOB_STREAM] job_id=%s state_change %s -> %s", job_id, last_status, status)
                    last_status = status

                is_final = status in terminal_states
                if status == "UNKNOWN":
                    is_final = False

                payload = {"chunk": str(chunk_text), "status": status, "is_final": is_final}
                yield f"data: {json.dumps(payload)}\n\n"

                if payload["is_final"]:
                    break

            except Exception as e:
                logger.exception("[JOB_STREAM] job_id=%s iteration=%d stream_error=%s", job_id, iteration, e)
                payload = {"chunk": f"stream iteration error: {e}", "status": "UNKNOWN", "is_final": False}
                yield f"data: {json.dumps(payload)}\n\n"

            yield ": keep-alive\n\n"
            await asyncio.sleep(1)

        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )

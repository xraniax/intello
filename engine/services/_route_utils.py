"""Shared utilities for all API route modules."""
import logging
import os
import tempfile
from typing import List, Optional

from fastapi import UploadFile
from fastapi.responses import JSONResponse

import database

logger = logging.getLogger("engine-api")

ALLOWED_UPLOAD_SUFFIXES = frozenset({".pdf", ".png", ".jpg", ".jpeg"})


def _stage_error_response(
    stage: str,
    message: str,
    *,
    details: Optional[str] = None,
    status_code: int = 500,
) -> JSONResponse:
    payload = {"status": "error", "stage": stage, "message": message}
    if details:
        payload["details"] = details
    logger.error("[%s] %s%s", stage, message, f" — {details}" if details else "")
    return JSONResponse(status_code=status_code, content=payload)


async def _save_upload_to_temp(file: UploadFile) -> str:
    suffix = os.path.splitext(file.filename or "")[1].lower() or ".pdf"
    if suffix not in ALLOWED_UPLOAD_SUFFIXES:
        raise ValueError(
            "Only PDF and image files are supported (.pdf, .png, .jpg, .jpeg)."
        )
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, mode="wb") as tmp:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            tmp.write(chunk)
        return tmp.name


def _safe_remove(path: Optional[str]) -> None:
    if not path or not os.path.exists(path):
        return
    try:
        os.remove(path)
        logger.info("Cleaned up temporary file: %s", path)
    except OSError as e:
        logger.error("Cleanup failed for %s: %s", path, e)


def _all_embeddings_failed(embeddings: List[Optional[List[float]]]) -> bool:
    return bool(embeddings) and all(e is None for e in embeddings)


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

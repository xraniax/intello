import os
import tempfile
import logging
import traceback
from typing import List, Optional
from uuid import UUID

import requests
from fastapi import FastAPI, File, HTTPException, UploadFile, Request, Depends, Form, BackgroundTasks
from sqlalchemy.orm import Session
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from .preprocessing import DEFAULT_UPLOADS_DIR, preprocess_document, preprocess_uploads_folder
from .document_processor import process_document, process_text_pipeline
from .embeddings import embed_step, ollama_tags_url
from .processor import process_subject
from .retrieval import retrieve_chunks_by_topic
from .generation import generate_study_material, evaluate_quiz, generate_chat_response
from .schemas import (
    EmbedRequest, ProcessTextRequest, RetrieveRequest, GenerateRequest,
    ChatRequest, QuizEvaluateRequest, QuizEvaluateResponse
)
from .google_drive import upload_file_to_drive_from_bytes

try:
    import database
    import models
    SessionLocal = database.SessionLocal
    Document = models.Document
    Chunk = models.Chunk
except ImportError:
    from ..database import SessionLocal
    from ..models import Document, Chunk

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("engine-api")

ALLOWED_UPLOAD_SUFFIXES = frozenset({".pdf", ".png", ".jpg", ".jpeg"})

app = FastAPI(
    title="Cognify Engine API",
    description="Document preprocessing, chunking, embeddings (Ollama), and subject processing.",
    version="0.2.0",
)


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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=jsonable_encoder({"status": "error", "stage": "api", "detail": exc.detail}),
        )
    logger.error("Global error: %s", exc)
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "stage": "api",
            "message": "Internal Server Error",
            "details": str(exc),
        },
    )


@app.get("/")
async def root():
    return {
        "service": "Cognify Engine",
        "docs": "/docs",
        "endpoints": {
            "preprocess": "POST /preprocess — upload file → raw_text, cleaned_text, chunks",
            "embed": "POST /embed — JSON body with text or chunks → embeddings",
            "process_text": "POST /process-text — JSON raw text → full pipeline (optional embeddings)",
            "process_document": "POST /process-document — upload → preprocess → chunk → embed",
            "process_uploads_folder": "GET /process-uploads — batch preprocess files in uploads dir",
            "process_subject": "GET /subjects/{subject_id}/process — DB-backed subject pipeline",
        },
    }


@app.get("/health")
async def health():
    try:
        ollama_response = requests.get(ollama_tags_url(), timeout=5)
        ollama_healthy = ollama_response.status_code == 200
    except Exception as e:
        logger.warning("Ollama health check failed: %s", e)
        ollama_healthy = False

    return {
        "status": "ok" if ollama_healthy else "degraded",
        "ollama": "healthy" if ollama_healthy else "unreachable",
        "engine": "healthy",
    }


@app.post("/preprocess")
async def preprocess_route(file: UploadFile = File(..., description="PDF or image file")):
    """
    Upload a file, run extract + clean + chunk only (no Ollama).
    Returns raw_text, cleaned_text, chunks, num_chunks, and document type.
    """
    logger.info("Preprocess request for: %s", file.filename)
    tmp_path: Optional[str] = None
    try:
        try:
            tmp_path = await _save_upload_to_temp(file)
        except ValueError as e:
            return _stage_error_response(
                "preprocess",
                "Invalid or unsupported upload",
                details=str(e),
                status_code=400,
            )
        logger.info("Saved temporary file to: %s", tmp_path)
        result = preprocess_document(tmp_path)
        return {
            "status": "success",
            "stage": "preprocess",
            "filename": file.filename,
            **result,
        }
    except ValueError as e:
        return _stage_error_response(
            "preprocess",
            "Text extraction or validation failed",
            details=str(e),
            status_code=422,
        )
    except FileNotFoundError as e:
        return _stage_error_response(
            "preprocess",
            "Uploaded file missing on disk",
            details=str(e),
            status_code=400,
        )
    except Exception as e:
        logger.exception("Preprocess failed for %s", file.filename)
        return _stage_error_response(
            "preprocess",
            "Preprocessing failed",
            details=str(e),
            status_code=500,
        )
    finally:
        _safe_remove(tmp_path)


@app.post("/embed")
async def embed_route(body: EmbedRequest):
    """
    Generate embeddings using the same Ollama path as the full document pipeline.
    Send either `text` (one string) or `chunks` (list of strings).
    """
    if body.chunks is not None and len(body.chunks) > 0:
        texts = body.chunks
    else:
        texts = [body.text.strip()]
    logger.info("Embed request: %d text(s)", len(texts))
    try:
        embeddings = embed_step(texts)
    except Exception as e:
        logger.exception("Embedding stage failed")
        return _stage_error_response(
            "embedding",
            "Embedding service error",
            details=str(e),
            status_code=502,
        )

    if _all_embeddings_failed(embeddings):
        return _stage_error_response(
            "embedding",
            "All embedding requests failed (check Ollama and OLLAMA_BASE_URL)",
            status_code=502,
        )

    return {
        "status": "success",
        "stage": "embedding",
        "count": len(embeddings),
        "embeddings": embeddings,
    }


@app.post("/process-text")
async def process_text_route(body: ProcessTextRequest):
    """Run clean → chunk → optional embed on raw text (no file upload)."""
    logger.info("Process-text request, include_embeddings=%s", body.include_embeddings)
    try:
        result = process_text_pipeline(
            body.text,
            max_chunk_chars=body.max_chunk_chars,
            chunk_overlap=body.chunk_overlap,
            include_embeddings=body.include_embeddings,
        )
        out = {
            "status": "success",
            "stage": "processing",
            "message": "Text pipeline completed",
            **result,
        }
        if body.include_embeddings and _all_embeddings_failed(result.get("embeddings") or []):
            out["embedding_warning"] = (
                "all_embedding_requests_failed; check Ollama and OLLAMA_BASE_URL"
            )
            logger.error("[%s] %s", "embedding", out["embedding_warning"])
        return out
    except Exception as e:
        logger.exception("Process-text pipeline failed")
        return _stage_error_response(
            "processing",
            "Text pipeline failed",
            details=str(e),
            status_code=500,
        )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def background_process_document(tmp_path: str, filename: str, original_filename: str, subject_id: Optional[UUID], google_file_id: Optional[str] = None):
    """Background worker for document extraction, chunking, embedding, and DB persistence."""
    # We must create a new DB session because the HTTP request's session is already closed!
    db = SessionLocal()
    try:
        logger.info("Background processing started for: %s (subject_id: %s)", filename, subject_id)
        result = process_document(tmp_path, include_embeddings=True)
        
        # Persistence Logic
        if subject_id:
            try:
                # 1. Create Document record
                new_doc = Document(
                    subject_id=subject_id,
                    filename=original_filename,
                    # Store Google Drive file_id
                    file_path=f"https://drive.google.com/file/d/{google_file_id}/view" if google_file_id else tmp_path 
                )
                db.add(new_doc)
                db.commit()
                db.refresh(new_doc)
                
                # 2. Persist Chunks
                chunks = result.get("chunks", [])
                embeddings = result.get("embeddings", [])
                
                for i, content in enumerate(chunks):
                    emb = embeddings[i] if i < len(embeddings) else None
                    new_chunk = Chunk(
                        document_id=new_doc.id,
                        content=content,
                        embedding=emb,
                        chunk_index=i
                    )
                    db.add(new_chunk)
                
                db.commit()
                logger.info("Successfully persisted document %d and %d chunks to DB", new_doc.id, len(chunks))
            except Exception as e:
                db.rollback()
                logger.error("Failed to persist document/chunks to DB: %s", e)

        if _all_embeddings_failed(result.get("embeddings") or []):
            logger.error("[%s] all_embedding_requests_failed; check Ollama via background task", "embedding")

    except Exception as e:
        logger.exception("Background pipeline crashed for %s", filename)
    finally:
        _safe_remove(tmp_path)
        db.close()


@app.post("/process-document")
async def process_document_route(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    subject_id: Optional[UUID] = Form(None)
):
    """
    Upload a single file, save it to disk, and deploy the processing pipeline 
    to a background task. Returns immediately to prevent HTTP timeouts.
    """
    import uuid
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    logger.info("Received file for background processing: %s (subject_id: %s)", file.filename, subject_id)
    try:
        # Read file content once to avoid double reading
        content = await file.read()
        
        # Validate file type
        suffix = os.path.splitext(file.filename or "")[1].lower() or ".pdf"
        if suffix not in ALLOWED_UPLOAD_SUFFIXES:
            raise ValueError("Only PDF and image files are supported (.pdf, .png, .jpg, .jpeg).")
        
        # Save temp file from content (processor still requires local file path)
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, mode="wb") as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        # Upload to Google Drive from bytes
        google_file_id = await upload_file_to_drive_from_bytes(content, unique_filename)
        
    except ValueError as e:
        return _stage_error_response(
            "preprocess", "Invalid or unsupported upload", details=str(e), status_code=400
        )
    except Exception as e:
        return _stage_error_response(
            "preprocess", "Failed to upload file to Google Drive", details=str(e), status_code=500
        )

    # Queue the background task!
    background_tasks.add_task(background_process_document, tmp_path, unique_filename, file.filename, subject_id, google_file_id)

    return {
        "status": "success",
        "stage": "processing",
        "filename": file.filename,
        "message": "Document uploaded successfully. AI processing and embedding generation has started in the background."
    }


@app.get("/process-uploads")
async def process_uploads_route(uploads_dir: Optional[str] = None):
    try:
        results = preprocess_uploads_folder(uploads_dir=uploads_dir)
        return {
            "message": f"Processed {len(results)} file(s) from uploads.",
            "uploads_dir": uploads_dir or DEFAULT_UPLOADS_DIR,
            "results": results,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@app.get("/subjects/{subject_id}/process")
async def process_subject_route(
    subject_id: UUID,
    uploads_dir: Optional[str] = None,
    topic: Optional[str] = None,
):
    result = process_subject(
        subject_id,
        uploads_dir=uploads_dir,
        topic=topic,
    )
    return result

@app.post("/retrieve")
async def retrieve_route(body: RetrieveRequest, db: Session = Depends(get_db)):
    """Retrieve top-k relevant chunks for a given topic and subject."""
    logger.info("Retrieve request for subject: %s, topic: %s", body.subject_id, body.topic)
    try:
        chunks = retrieve_chunks_by_topic(db, str(body.subject_id), body.topic, body.top_k)
        return {
            "status": "success",
            "stage": "retrieval",
            "count": len(chunks),
            "chunks": [{"id": c.id, "content": c.content, "document_id": c.document_id} for c in chunks]
        }
    except Exception as e:
        logger.exception("Retrieval failed")
        return _stage_error_response(
            "retrieval",
            "Retrieval failed",
            details=str(e),
            status_code=500,
        )

@app.post("/chat")
async def chat_route(body: ChatRequest, db: Session = Depends(get_db)):
    """Conversational chat grounded in retrieved context."""
    logger.info("Chat request: subject=%s, query=%s", body.subject_id, body.question)
    try:
        # 1. Retrieve context chunks
        chunks = retrieve_chunks_by_topic(db, body.subject_id, None, body.top_k)
        chunk_texts = [c.content for c in chunks if c.content]
        
        # 2. Generate response
        context = "\n\n".join(chunk_texts)
        response = generate_chat_response(context, body.question, body.language)
        
        return {
            "status": "success",
            "stage": "chat",
            "response": response
        }
    except Exception as e:
        logger.exception("Chat failed")
        return _stage_error_response(
            "chat",
            "Chat failed",
            details=str(e),
            status_code=500,
        )

@app.post("/generate")
async def generate_route(body: GenerateRequest, db: Session = Depends(get_db)):
    """Generate study materials using LLM based on retrieved context."""
    logger.info("Generate request: subject=%s, type=%s, topic=%s", body.subject_id, body.material_type, body.topic)
    try:
        # 1. Retrieve context chunks
        chunks = retrieve_chunks_by_topic(db, body.subject_id, body.topic, body.top_k)
        chunk_texts = [c.content for c in chunks if c.content]
        
        # DEBUGGING CHECKS
        logger.info(f"DEBUG: Retrieved {len(chunks)} raw rows from DB for subject {body.subject_id}")
        logger.info(f"DEBUG: Filtered down to {len(chunk_texts)} non-empty chunk texts")
        total_chars = sum(len(t) for t in chunk_texts)
        logger.info(f"DEBUG: Total payload character length being sent to Ollama: {total_chars}")
        
        # 2. Generate material
        material = generate_study_material(chunk_texts, body.material_type, body.topic, body.language)
        
        # material can be a string (summary) or a dict (structured modes)
        return {
            "status": "success",
            "stage": "generation",
            "material_type": body.material_type,
            "content": material
        }
    except Exception as e:
        logger.exception("Generation failed")
        return _stage_error_response(
            "generation",
            "Study material generation failed",
            details=str(e),
            status_code=500,
        )

@app.post("/evaluate-quiz", response_model=QuizEvaluateResponse)
async def evaluate_quiz_route(body: QuizEvaluateRequest):
    """
    Evaluate user answers for a quiz.
    The request includes the original questions (with correct answers) 
    and the user submissions.
    """
    logger.info("Evaluate quiz request: %d submissions", len(body.submissions))
    try:
        # Convert Pydantic models to dicts for the helper
        questions_dict = [q.model_dump() for q in body.questions]
        submissions_dict = [s.model_dump() for s in body.submissions]
        
        result = evaluate_quiz(questions_dict, submissions_dict)
        return result
    except Exception as e:
        logger.exception("Quiz evaluation failed")
        return _stage_error_response(
            "evaluation",
            "Quiz evaluation failed",
            details=str(e),
            status_code=500,
        )


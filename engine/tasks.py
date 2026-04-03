import os
import logging
from typing import Optional, Any
from celery_app import celery_app
import traceback

# Import services required for tasks
try:
    from database import SessionLocal
    from models import Document, Chunk
    from services.document_processor import process_document
    from services.preprocessing import _all_embeddings_failed
    from services.retrieval import retrieve_chunks_by_topic
    from services.generation import generate_study_material
    from services.google_drive import download_file_from_drive
except ImportError:
    # Ensure correct sys path if not run directly
    import sys
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from database import SessionLocal
    from models import Document, Chunk
    from services.document_processor import process_document
    from services.retrieval import retrieve_chunks_by_topic
    from services.generation import generate_study_material
    from services.google_drive import download_file_from_drive

logger = logging.getLogger("celery-tasks")

def _safe_remove(path: Optional[str]) -> None:
    if not path or not os.path.exists(path):
        return
    try:
        os.remove(path)
        logger.info("Cleaned up temporary file: %s", path)
    except OSError as e:
        logger.error("Cleanup failed for %s: %s", path, e)

@celery_app.task(bind=True, max_retries=3)
def task_process_document(self, drive_file_id: str, original_filename: str, subject_id: Optional[str] = None):
    """Background celery task for document extraction, chunking, embedding, and DB persistence."""
    logger.info("Celery processing started for Drive ID: %s (filename: %s, subject_id: %s)", drive_file_id, original_filename, subject_id)
    
    tmp_path = None
    db = SessionLocal()
    try:
        logger.info("Downloading file from Drive: %s", drive_file_id)
        try:
            tmp_path = download_file_from_drive(drive_file_id)
            if not os.path.exists(tmp_path) or os.path.getsize(tmp_path) == 0:
                logger.warning("Downloaded file is empty: %s", tmp_path)
            logger.info("Saved to temp path: %s", tmp_path)
        except Exception as e:
            logger.error("Drive download error: %s", e)
            raise self.retry(exc=e, countdown=15)
            
        logger.info("Starting preprocessing")
        try:
            result = process_document(tmp_path, include_embeddings=True)
        except Exception as e:
            logger.error("Preprocessing/Embedding error for %s: %s", original_filename, e)
            raise
        
        # Persistence Logic
        if subject_id:
            try:
                # 1. Create Document record
                new_doc = Document(
                    subject_id=subject_id,
                    filename=original_filename,
                    file_path=f"https://drive.google.com/file/d/{drive_file_id}/view" 
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
                raise self.retry(exc=e, countdown=10) # Simple retry on DB lock

        return {"status": "success", "subject_id": subject_id, "document": original_filename, "chunks": len(result.get("chunks", []))}

    except Exception as e:
        logger.error(f"Task crashed for {original_filename}: {e}")
        logger.error(traceback.format_exc())
        raise self.retry(exc=e, countdown=10)
    finally:
        logger.info("Cleaning up temp file")
        _safe_remove(tmp_path)
        db.close()


@celery_app.task(bind=True, max_retries=3)
def task_generate_material(self, subject_id: str, material_type: str, topic: Optional[str] = None, language: str = "en", top_k: int = 5, user_id: Optional[str] = None):
    """Background celery task for executing Retrieval-Augmented LLM generation."""
    logger.info("Celery task_generate_material started: subject=%s, type=%s, topic=%s", subject_id, material_type, topic)
    db = SessionLocal()
    try:
        # 1. Retrieve context chunks
        chunks = retrieve_chunks_by_topic(db, subject_id, topic, top_k)
        chunk_texts = [c.content for c in chunks if c.content]
        
        logger.info(f"Retrieved {len(chunk_texts)} chunk texts for generation.")
        
        if not chunk_texts:
            return {"status": "error", "message": "No document chunks found for the given subject or topic."}
            
        # 2. Generate material (this handles its own LLM retries)
        material = generate_study_material(chunk_texts, material_type, topic, language)
        
        return {
            "status": "success",
            "material_type": material_type,
            "content": material
        }
    except Exception as e:
        logger.exception("Task Generation failed")
        # Retry with exponential backoff on failure (likely Ollama timeout)
        raise self.retry(exc=e, countdown=2 ** self.request.retries * 15)
    finally:
        db.close()

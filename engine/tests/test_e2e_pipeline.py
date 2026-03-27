import os
import sys
import logging
from sqlalchemy import text, select

# Add engine to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    import database
    import models
    from services.processor import process_subject
    from utils.embeddings import get_embedder
    from pgvector.sqlalchemy import Vector
except ImportError as e:
    print(f"Import failed: {e}")
    sys.exit(1)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("e2e-test")

def run_e2e_test():
    db = database.SessionLocal()
    try:
        # 1. Setup Test Subject
        subject_id = 999
        logger.info(f"Setting up test subject_id={subject_id}")
        
        # Clean up previous test runs
        db.execute(text("DELETE FROM chunks WHERE document_id IN (SELECT id FROM documents WHERE subject_id = :s_id)"), {"s_id": subject_id})
        db.execute(text("DELETE FROM documents WHERE subject_id = :s_id"), {"s_id": subject_id})
        db.commit()

        # 2. Find a Valid Test Document
        logger.info("Searching for a valid PDF in backend/uploads...")
        uploads_dir = os.path.join(os.path.dirname(__file__), "..", "..", "backend", "uploads")
        if not os.path.isdir(uploads_dir):
             # Fallback to engine-relative path
             uploads_dir = os.path.join(os.path.dirname(__file__), "..", "backend", "uploads")
        
        pdf_files = [f for f in os.listdir(uploads_dir) if f.lower().endswith(".pdf")]
        if not pdf_files:
            logger.error(f"No PDF files found in {uploads_dir}")
            return False
            
        filename = pdf_files[0]
        file_path = os.path.join(uploads_dir, filename)
        logger.info(f"Using test file: {file_path}")
            
        doc = models.Document(subject_id=subject_id, filename=filename)
        db.add(doc)
        db.commit()
        db.refresh(doc)
        doc_id = doc.id
        logger.info(f"Created test document id={doc_id}")

        # 3. Run Pipeline (Processing + Persistence)
        logger.info("Running process_subject pipeline with real LocalEmbedder...")
        # uses default EMBEDDING_PROVIDER (local)
        result = process_subject(subject_id, uploads_dir=uploads_dir)
        
        if result.get("errors"):
            logger.error(f"Pipeline errors: {result['errors']}")
            return False

        # 4. Verify Persistence
        logger.info("Verifying persistence in DB...")
        db_chunks = db.query(models.Chunk).filter(models.Chunk.document_id == doc_id).all()
        logger.info(f"Found {len(db_chunks)} chunks in database.")
        
        if not db_chunks:
            logger.error("No chunks found in database!")
            return False
            
        has_embeddings = any(c.embedding is not None for c in db_chunks)
        if not has_embeddings:
            logger.error("Chunks found but NO embeddings stored!")
            return False
        
        logger.info("SUCCESS: Chunks and embeddings persisted correctly.")

        # 5. Semantic Search Test
        logger.info("Testing semantic similarity search...")
        embedder = get_embedder()
        query_text = "What is artificial intelligence?"
        # Ensure we have a query vector
        query_vector = embedder.get_embeddings([query_text])[0]
        
        # Use pgvector l2_distance
        # SQLAlchemy 2.0 style select
        stmt = select(models.Chunk).order_by(
            models.Chunk.embedding.l2_distance(query_vector)
        ).limit(3)
        
        similar_chunks = db.scalars(stmt).all()
        
        logger.info(f"Search results for: '{query_text}'")
        for i, chunk in enumerate(similar_chunks):
            # Calculate distance for logging
            dist_stmt = select(models.Chunk.embedding.l2_distance(query_vector)).where(models.Chunk.id == chunk.id)
            distance = db.scalar(dist_stmt)
            logger.info(f"  [{i+1}] (Dist: {distance:.4f}) Content: {chunk.content[:100]}...")

        return True

    except Exception as e:
        logger.error(f"E2E Test Failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = run_e2e_test()
    if success:
        print("\n=== E2E TEST PASSED ===")
        sys.exit(0)
    else:
        print("\n=== E2E TEST FAILED ===")
        sys.exit(1)

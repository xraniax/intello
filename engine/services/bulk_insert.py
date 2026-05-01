"""PostgreSQL COPY-based bulk insert for high-performance chunk loading.

COPY is 10-100x faster than row-by-row INSERT for large batches.
This module provides bulk insert wrappers for Document and Chunk tables.
"""

import logging
import io
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from models import Chunk

logger = logging.getLogger("engine-bulk-insert")


def bulk_insert_chunks(
    session: Session,
    document_id: int,
    chunks_data: List[Dict[str, Any]],
    batch_size: int = 1000
) -> int:
    """Insert multiple chunks using PostgreSQL COPY (much faster than ORM inserts).
    
    Args:
        session: SQLAlchemy session
        document_id: ID of parent document
        chunks_data: List of chunk dicts with keys: content, embedding (optional), chunk_index, page_number
        batch_size: How many chunks to insert per COPY operation
    
    Returns:
        Total number of chunks inserted
    
    Example:
        chunks_data = [
            {"content": "...", "embedding": [0.1, 0.2, ...], "chunk_index": 0, "page_number": 1},
            {"content": "...", "embedding": [0.3, 0.4, ...], "chunk_index": 1, "page_number": 1},
        ]
        count = bulk_insert_chunks(session, doc_id, chunks_data)
    """
    if not chunks_data:
        return 0
    
    total_inserted = 0
    
    # Process in batches to avoid memory issues with very large documents
    for i in range(0, len(chunks_data), batch_size):
        batch = chunks_data[i:i + batch_size]
        inserted = _bulk_insert_batch(session, document_id, batch)
        total_inserted += inserted
        logger.info(f"Bulk insert batch: {i}-{i+len(batch)}/{len(chunks_data)} ({inserted} rows)")
    
    logger.info(f"✓ Bulk insert complete: {total_inserted} chunks inserted")
    return total_inserted


def _bulk_insert_batch(session: Session, document_id: int, chunks_batch: List[Dict[str, Any]]) -> int:
    """Insert a single batch of chunks using COPY.
    
    Args:
        session: SQLAlchemy session
        document_id: ID of parent document
        chunks_batch: List of chunk dicts for this batch
    
    Returns:
        Number of rows inserted
    """
    if not chunks_batch:
        return 0
    
    try:
        # Get raw psycopg2 connection from SQLAlchemy engine
        connection = session.connection()
        
        # Build CSV data for COPY
        buffer = io.StringIO()
        
        for chunk in chunks_batch:
            document_id_col = document_id
            content = chunk.get("content", "").replace("\t", "\\t").replace("\n", "\\n").replace("\\", "\\\\")
            embedding_col = chunk.get("embedding")  # Will be handled as NULL or binary
            chunk_index = chunk.get("chunk_index", 0)
            page_number = chunk.get("page_number")
            
            # Format: document_id, content, embedding, chunk_index, page_number, created_at
            # Note: embedding must be in pgvector format or NULL
            if embedding_col:
                # Convert list to pgvector string format: "[0.1,0.2,0.3,...]"
                embedding_str = "[" + ",".join(str(x) for x in embedding_col) + "]"
            else:
                embedding_str = "NULL"
            
            page_str = str(page_number) if page_number is not None else "NULL"
            timestamp = datetime.utcnow().isoformat()
            
            # Tab-separated values (TSV format for COPY)
            buffer.write(f"{document_id_col}\t{content}\t{embedding_str}\t{chunk_index}\t{page_str}\t{timestamp}\n")
        
        buffer.seek(0)
        
        # Execute COPY command
        # Using COPY ... FROM STDIN for in-memory data transfer
        copy_sql = """
            COPY chunks (document_id, content, embedding, chunk_index, page_number, created_at)
            FROM STDIN
            WITH (FORMAT CSV, DELIMITER E'\\t', NULL 'NULL')
        """
        
        try:
            # Use psycopg2's copy_expert for raw COPY protocol
            cursor = connection.connection.cursor()
            cursor.copy_expert(copy_sql, buffer)
            connection.connection.commit()
            
            rows_inserted = cursor.rowcount
            logger.debug(f"COPY inserted {rows_inserted} rows")
            
            return rows_inserted if rows_inserted >= 0 else len(chunks_batch)
            
        except Exception as copy_err:
            logger.warning(f"COPY failed: {copy_err}, falling back to ORM insert...")
            connection.connection.rollback()
            
            # Fallback to ORM if COPY fails
            return _fallback_orm_insert(session, document_id, chunks_batch)
    
    except Exception as e:
        logger.error(f"Bulk insert error: {e}")
        return _fallback_orm_insert(session, document_id, chunks_batch)


def _fallback_orm_insert(session: Session, document_id: int, chunks_batch: List[Dict[str, Any]]) -> int:
    """Fallback to SQLAlchemy ORM insert if COPY fails.
    
    Much slower than COPY but compatible with all databases.
    """
    logger.info(f"Using ORM fallback for {len(chunks_batch)} chunks...")
    
    for chunk in chunks_batch:
        new_chunk = Chunk(
            document_id=document_id,
            content=chunk.get("content", ""),
            embedding=chunk.get("embedding"),
            chunk_index=chunk.get("chunk_index"),
            page_number=chunk.get("page_number")
        )
        session.add(new_chunk)
    
    try:
        session.commit()
        logger.info(f"ORM fallback: {len(chunks_batch)} chunks inserted")
        return len(chunks_batch)
    except SQLAlchemyError as e:
        logger.error(f"ORM insert failed: {e}")
        session.rollback()
        return 0


if __name__ == "__main__":
    # Test bulk insert
    logging.basicConfig(level=logging.DEBUG)
    
    # Example usage (requires working database)
    test_chunks = [
        {
            "content": f"This is test chunk {i}",
            "embedding": [0.1 * j for j in range(768)],
            "chunk_index": i,
            "page_number": i // 5 + 1
        }
        for i in range(10)
    ]
    
    print(f"Generated {len(test_chunks)} test chunks")
    print("Example chunk structure:")
    import json
    print(json.dumps({k: v if k != "embedding" else f"[{len(v)} dims]" for k, v in test_chunks[0].items()}, indent=2))

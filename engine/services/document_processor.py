import os
import logging
from typing import Dict, Any, List, Optional

from services.preprocessing import preprocess_document, DEFAULT_UPLOADS_DIR, SUPPORTED_EXTENSIONS
from utils.embeddings import get_embedder

logger = logging.getLogger("engine-document-processor")

def process_document(
    file_path: str,
    *,
    max_chunk_tokens: int = 500,
    chunk_overlap_tokens: int = 50
) -> Dict[str, Any]:
    """
    Complete document processing pipeline:
    1. Extraction & Chunking (LangChain-based)
    2. Embedding (Modular Provider: OpenAI or Mock)
    3. Metadata Aggregation
    """
    logger.info(f"Starting processing for file: {file_path}")

    # 1. Preprocessing (Extraction, Cleaning, Chunking)
    # Why: We use LangChain's RecursiveCharacterTextSplitter for semantic coherence.
    prep_result = preprocess_document(
        file_path,
        max_chunk_tokens=max_chunk_tokens,
        chunk_overlap_tokens=chunk_overlap_tokens
    )
    
    chunks = prep_result.get("chunks", [])
    if not chunks:
        logger.warning(f"No chunks extracted from {file_path}")
        return {**prep_result, "embeddings": [], "provider": None, "model": None}

    # 2. Embedding Generation
    # Why: We use a factory pattern to avoid vendor lock-in and allow mock fallbacks for dev/CI.
    try:
        embedder = get_embedder()
        logger.info(f"Generating embeddings using provider: {embedder.provider_name}, model: {embedder.model_name}")
        
        embeddings = embedder.get_embeddings(chunks)
        
        logger.info(f"Successfully generated {len(embeddings)} embeddings.")
        
        return {
            **prep_result,
            "embeddings": embeddings,
            "provider": embedder.provider_name,
            "model": embedder.model_name
        }
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        # Production Safety: We still return the chunks even if embedding fails, 
        # allowing the system to have partial functionality (text-only).
        return {
            **prep_result,
            "embeddings": [],
            "error_detail": f"Embedding failed: {str(e)}",
            "provider": "failed",
            "model": "failed"
        }


def process_uploads_folder(
    uploads_dir: Optional[str] = None,
    *,
    max_chunk_tokens: int = 500,
    chunk_overlap_tokens: int = 50,
) -> Dict[str, Dict]:
    """
    Process all supported documents in the uploads folder.
    Leverages the full process_document pipeline (extraction + embeddings).
    """
    directory = uploads_dir if uploads_dir is not None else DEFAULT_UPLOADS_DIR
    if not os.path.isdir(directory):
        raise FileNotFoundError(f"Uploads directory not found: {directory}")

    results: Dict[str, Dict] = {}
    for entry in os.scandir(directory):
        if not entry.is_file():
            continue
        
        _, ext = os.path.splitext(entry.name)
        if ext.lower() not in SUPPORTED_EXTENSIONS:
            continue

        try:
            results[entry.name] = process_document(
                entry.path,
                max_chunk_tokens=max_chunk_tokens,
                chunk_overlap_tokens=chunk_overlap_tokens,
            )
        except Exception as e:
            results[entry.name] = {"error": str(e)}

    return results

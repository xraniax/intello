"""Document pipeline: preprocess → chunk → embed (reused by FastAPI routes)."""
from typing import Any, Dict, List, Optional

from .embeddings import embed_step
from .preprocessing import chunk_step, clean_text_step, preprocess_step


def process_document(
    file_path: str,
    *,
    max_chunk_chars: int = 1500,
    chunk_overlap: int = 200,
    include_embeddings: bool = True,
) -> Dict[str, Any]:
    """
    Full file pipeline: extract, clean, chunk, optionally embed.
    Backward compatible fields: type, raw_text, cleaned_text, chunks, num_chunks.
    When include_embeddings is True, adds `embeddings` (same length as chunks).
    """
    pre = preprocess_step(file_path)
    chunks = chunk_step(
        pre["cleaned_text"],
        max_chunk_chars=max_chunk_chars,
        chunk_overlap=chunk_overlap,
    )
    out: Dict[str, Any] = {
        "type": pre["type"],
        "raw_text": pre["raw_text"],
        "cleaned_text": pre["cleaned_text"],
        "chunks": chunks,
        "num_chunks": len(chunks),
    }
    if include_embeddings:
        out["embeddings"] = embed_step(chunks)
    return out


def process_text_pipeline(
    raw_text: str,
    *,
    max_chunk_chars: int = 1500,
    chunk_overlap: int = 200,
    include_embeddings: bool = True,
) -> Dict[str, Any]:
    """Full pipeline from raw text (no file): clean → chunk → optional embed."""
    cleaned_text = clean_text_step(raw_text)
    chunks = chunk_step(
        cleaned_text,
        max_chunk_chars=max_chunk_chars,
        chunk_overlap=chunk_overlap,
    )
    out: Dict[str, Any] = {
        "type": "Text",
        "raw_text": raw_text,
        "cleaned_text": cleaned_text,
        "chunks": chunks,
        "num_chunks": len(chunks),
    }
    if include_embeddings:
        out["embeddings"] = embed_step(chunks)
    return out

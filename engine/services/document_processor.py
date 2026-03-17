"""Thin wrapper for the /process-document API; uses preprocessing pipeline."""
from .preprocessing import preprocess_document


def process_document(file_path: str):
    """Process a single document (PDF) and return chunks and metadata."""
    return preprocess_document(file_path)

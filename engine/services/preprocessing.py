import os
import logging
from typing import List, Dict, Optional

try:
    from typing import Literal  
except ImportError:
    from typing_extensions import Literal  

from PyPDF2 import PdfReader
from pdf2image import convert_from_path
from pytesseract import image_to_string

logger = logging.getLogger("engine-preprocessing")

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_UPLOADS_DIR = "/app/uploads"
# PDF is the only currently supported extension; extensible in the future
SUPPORTED_EXTENSIONS = {".pdf"}
DocumentType = Literal["PDF", "ScannedDoc"]


def _extract_text_from_digital_pdf(file_path: str, max_pages: Optional[int] = None) -> str:
    #extract text using PyPDF2
    reader = PdfReader(file_path)
    texts: List[str] = []

    pages = reader.pages
    #if max pages is not none we limit the number of pages to the max pages
    if max_pages is not None:
        pages = pages[:max_pages]

    for page in pages:
        text = page.extract_text() or ""
        if text:
            texts.append(text)

    return "\n\n".join(texts).strip()

#extract text using OCR(pdf2image + pytesseract) for scanned PDFs
def _extract_text_from_scanned_pdf(file_path: str, dpi: int = 300) -> str:
    images = convert_from_path(file_path, dpi=dpi)
    texts: List[str] = []

    for image in images:
        text = image_to_string(image)
        if text:
            texts.append(text)

    return "\n\n".join(texts).strip()

#we try to extract text from the first 3 pages of the digital pdf if it fails we assume its a scanned pdf
def _detect_document_type(file_path: str, text_sample_chars_threshold: int = 100) -> DocumentType:
    try:
        sample_text = _extract_text_from_digital_pdf(file_path, max_pages=3)
    except Exception:
        # If PyPDF2 cannot read it properly, assume scanned
        return "ScannedDoc"

    if len(sample_text) < text_sample_chars_threshold:
        return "ScannedDoc"

    return "PDF"


def _clean_text(text: str) -> str:
    # Normalize newlines and strip leading/trailing whitespace
    cleaned = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.strip() for line in cleaned.split("\n")]
    # Drop empty lines that are just whitespace
    lines = [line for line in lines if line]
    return "\n".join(lines).strip()

#split the text into chunks to be used for embedding
def _chunk_text(text: str, max_tokens: int = 500, overlap_tokens: int = 50) -> List[str]:
    if not text or not text.strip():
        return []

    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        # Semantic chunking that respects paragraph and sentence boundaries, bound by token limits
        splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            model_name="gpt-4",
            chunk_size=max_tokens,
            chunk_overlap=overlap_tokens,
        )
        return splitter.split_text(text)
    except Exception as e:
        logger.warning(f"Semantic chunking failed, falling back to naive char split: {e}")
        if max_tokens <= 0:
            return [text]

        if overlap_tokens < 0:
            overlap_tokens = 0

        chunks: List[str] = []
        start = 0
        length = len(text)
        # Approximate 4 chars per token for naive fallback
        max_chars = max_tokens * 4
        overlap_chars = overlap_tokens * 4

        # Prevent infinite loop if overlap equals or exceeds chunk size
        if overlap_chars >= max_chars:
            overlap_chars = max_chars - 1

        while start < length:
            end = min(start + max_chars, length)
            chunk = text[start:end]
            chunks.append(chunk)

            if end == length:
                break

            start = max(0, end - overlap_chars)

        return chunks

#high level preprocessing function
def extract_text_from_pdf(file_path: str) -> str:
    """Detect type and extract text from either digital or scanned PDF."""
    doc_type = _detect_document_type(file_path)
    if doc_type == "PDF":
        return _extract_text_from_digital_pdf(file_path)
    else:
        return _extract_text_from_scanned_pdf(file_path)


def preprocess_document(
    file_path: str,
    *,
    forced_type: Optional[DocumentType] = None,
    max_chunk_tokens: int = 500,
    chunk_overlap_tokens: int = 50,
) -> Dict:
    logger.info(f"Preprocessing document: {file_path}")
    if not os.path.isfile(file_path):
        logger.error(f"File not found: {file_path}")
        raise FileNotFoundError(f"File not found: {file_path}")

    doc_type: DocumentType
    if forced_type is not None:
        doc_type = forced_type
        logger.info(f"Using forced document type: {doc_type}")
    else:
        try:
            doc_type = _detect_document_type(file_path)
            logger.info(f"Detected document type: {doc_type}")
        except Exception as e:
            logger.warning(f"Type detection failed for {file_path}: {e}. Falling back to 'PDF'")
            doc_type = "PDF"

    try:
        if doc_type == "PDF":
            logger.info("Extracting text from digital PDF...")
            raw_text = _extract_text_from_digital_pdf(file_path)
        else:
            logger.info("Extracting text from scanned PDF (OCR)...")
            raw_text = _extract_text_from_scanned_pdf(file_path)
        
        if not raw_text.strip():
            logger.warning(f"No text extracted from {file_path}")
    except Exception as e:
        logger.error(f"Text extraction failed for {file_path}: {e}")
        raise ValueError(f"Failed to extract text: {str(e)}")

    logger.info("Cleaning and chunking text...")
    cleaned_text = _clean_text(raw_text)
    chunks = _chunk_text(cleaned_text, max_tokens=max_chunk_tokens, overlap_tokens=chunk_overlap_tokens)

    logger.info(f"Finished preprocessing. Extracted {len(chunks)} chunks.")
    return {
        "type": doc_type,
        "raw_text": raw_text,
        "cleaned_text": cleaned_text,
        "chunks": chunks,
        "num_chunks": len(chunks),
    }

# preprocess_uploads_folder moved to document_processor.py


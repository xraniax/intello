import os
from typing import List, Dict, Optional

try:
   
    from typing import Literal  
except ImportError:
    
    from typing_extensions import Literal  

from PyPDF2 import PdfReader

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_UPLOADS_DIR = os.path.join(_REPO_ROOT, "backend", "uploads")
SUPPORTED_EXTENSIONS = {".pdf"}
from pdf2image import convert_from_path
from pytesseract import image_to_string
import logging

logger = logging.getLogger("engine-preprocessing")


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
def _chunk_text(text: str, max_chars: int = 1500, overlap: int = 200) -> List[str]:
    if not text:
        return []

    if max_chars <= 0:
        return [text]

    if overlap < 0:
        overlap = 0

    chunks: List[str] = []
    start = 0
    length = len(text)

    while start < length:
        end = min(start + max_chars, length)
        chunk = text[start:end]
        chunks.append(chunk)

        if end == length:
            break

        start = max(0, end - overlap)

    return chunks

#high level preprocessing function
def preprocess_document(
    file_path: str,
    *,
    forced_type: Optional[DocumentType] = None,
    max_chunk_chars: int = 1500,
    chunk_overlap: int = 200,
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
    chunks = _chunk_text(cleaned_text, max_chars=max_chunk_chars, overlap=chunk_overlap)

    logger.info(f"Finished preprocessing. Extracted {len(chunks)} chunks.")
    return {
        "type": doc_type,
        "raw_text": raw_text,
        "cleaned_text": cleaned_text,
        "chunks": chunks,
        "num_chunks": len(chunks),
    }

#preprocess all the docs in the uploads folder
def preprocess_uploads_folder(
    uploads_dir: Optional[str] = None,
    *,
    forced_type: Optional[DocumentType] = None,
    max_chunk_chars: int = 1500,
    chunk_overlap: int = 200,
) -> Dict[str, Dict]:

    directory = uploads_dir if uploads_dir is not None else DEFAULT_UPLOADS_DIR
    if not os.path.isdir(directory):
        raise FileNotFoundError(f"Uploads directory not found: {directory}")

    results: Dict[str, Dict] = {}
    for entry in os.scandir(directory):
        if not entry.is_file():
            continue
        base, ext = os.path.splitext(entry.name)
        if ext.lower() not in SUPPORTED_EXTENSIONS:
            continue
        try:
            results[entry.name] = preprocess_document(
                entry.path,
                forced_type=forced_type,
                max_chunk_chars=max_chunk_chars,
                chunk_overlap=chunk_overlap,
            )
        except Exception as e:
            results[entry.name] = {"error": str(e)}

    return results


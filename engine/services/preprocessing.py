import os
from typing import List, Dict, Optional

try:
   
    from typing import Literal  
except ImportError:
    
    from typing_extensions import Literal  

from PyPDF2 import PdfReader

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_DEFAULT_UPLOADS = os.path.join(_REPO_ROOT, "backend", "uploads")
# In Docker, mount uploads here (e.g. ./backend/uploads:/data/uploads) and set COGNIFY_UPLOADS_DIR=/data/uploads
_DEFAULT_DOCKER_UPLOADS = "/data/uploads"
DEFAULT_UPLOADS_DIR = os.getenv(
    "COGNIFY_UPLOADS_DIR",
    _DEFAULT_DOCKER_UPLOADS if os.path.isdir(_DEFAULT_DOCKER_UPLOADS) else _DEFAULT_UPLOADS,
)
SUPPORTED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
from pdf2image import convert_from_path
from pytesseract import image_to_string
from PIL import Image
import logging

logger = logging.getLogger("engine-preprocessing")


DocumentType = Literal["PDF", "ScannedDoc", "Image"]


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
        try:
            text = image_to_string(image)
        except Exception as e:
            # Make OCR failures clearer when tesseract isn't installed/misconfigured.
            msg = str(e).lower()
            if "tesseract" in msg and ("not found" in msg or "missing" in msg or "no such" in msg):
                raise RuntimeError(
                    "Tesseract OCR is not available in the engine container. "
                    "Ensure `tesseract-ocr` is installed and configured."
                ) from e
            raise
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

# extract text from image files via OCR
def _extract_text_from_image(file_path: str) -> str:
    try:
        with Image.open(file_path) as image:
            text = image_to_string(image)
            return (text or "").strip()
    except Exception as e:
        msg = str(e).lower()
        if "tesseract" in msg and ("not found" in msg or "missing" in msg or "no such" in msg):
            logger.error("Tesseract OCR is not available: %s", e)
            raise RuntimeError(
                "Tesseract OCR is not available in the engine container. "
                "Ensure `tesseract-ocr` is installed and configured."
            ) from e
        logger.error(f"Failed OCR for image {file_path}: {e}")
        raise

# token-based chunking for LLM compatibility
def _chunk_text_by_tokens(text: str, max_tokens: int = 300, overlap: int = 50) -> List[str]:
    if not text:
        return []

    if max_tokens <= 0:
        return [text]

    if overlap < 0:
        overlap = 0

    # Prevent overlap >= max_tokens which can stall progress on some inputs.
    if max_tokens > 0 and overlap >= max_tokens:
        overlap = max(0, max_tokens - 1)

    try:
        import tiktoken
    except ImportError as e:
        logger.warning(f"tiktoken unavailable, fallback to charset chunking: {e}")
        raise

    try:
        try:
            encoder = tiktoken.encoding_for_model("gpt-4")
        except Exception:
            encoder = tiktoken.get_encoding("cl100k_base")

        tokens = encoder.encode(text)
        chunks: List[str] = []
        length = len(tokens)
        start = 0

        while start < length:
            end = min(start + max_tokens, length)
            chunk_tokens = tokens[start:end]
            chunk = encoder.decode(chunk_tokens, errors="replace")
            chunks.append(chunk)

            if end == length:
                break

            start = max(0, end - overlap)

        return chunks
    except Exception as e:
        logger.warning(f"Token-based chunking failed: {e}")
        raise

# chunk by tokens with char fallback
def _chunk_text(text: str, max_chars: int = 1500, overlap: int = 200) -> List[str]:
    if not text:
        return []

    if max_chars <= 0:
        return [text]

    if overlap < 0:
        overlap = 0

    # Token chunking is preferred when available, but the public API uses "max_chunk_chars".
    # For token chunking, convert chars -> tokens approximately so the parameter means the same thing.
    try:
        approx_chars_per_token = 4  # heuristic for cl100k_base-like tokenizers
        max_tokens = max(1, int(max_chars / approx_chars_per_token))
        overlap_tokens = max(0, int(overlap / approx_chars_per_token))
        return _chunk_text_by_tokens(text, max_tokens=max_tokens, overlap=overlap_tokens)
    except Exception:
        logger.warning("Falling back to character-based chunking.")

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


def clean_text_step(raw_text: str) -> str:
    """Normalize and clean raw extracted text (reusable pipeline step)."""
    return _clean_text(raw_text)


def preprocess_step(
    file_path: str,
    *,
    forced_type: Optional[DocumentType] = None,
) -> Dict:
    """
    Extract and clean text from a file (no chunking).
    Returns type, raw_text, cleaned_text.
    """
    logger.info(f"Preprocess step (extract+clean): {file_path}")
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

    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext in {".png", ".jpg", ".jpeg"}:
            doc_type = "Image"
            logger.info("Extracting text from image (OCR)...")
            raw_text = _extract_text_from_image(file_path)
        elif ext == ".pdf":
            if doc_type == "PDF":
                logger.info("Extracting text from digital PDF...")
                raw_text = _extract_text_from_digital_pdf(file_path)
            else:
                logger.info("Extracting text from scanned PDF (OCR)...")
                raw_text = _extract_text_from_scanned_pdf(file_path)
        else:
            logger.error(f"Unsupported file extension: {ext}")
            raise ValueError(f"Unsupported document extension: {ext}")

        if not raw_text.strip():
            logger.warning(f"No text extracted from {file_path}")
    except Exception as e:
        logger.error(f"Text extraction failed for {file_path}: {e}")
        raise ValueError(f"Failed to extract text: {str(e)}")

    cleaned_text = _clean_text(raw_text)
    return {
        "type": doc_type,
        "raw_text": raw_text,
        "cleaned_text": cleaned_text,
    }


def chunk_step(
    text: str,
    *,
    max_chunk_chars: int = 1500,
    chunk_overlap: int = 200,
) -> List[str]:
    """Split cleaned text into chunks (reusable pipeline step)."""
    return _chunk_text(text, max_chars=max_chunk_chars, overlap=chunk_overlap)


#high level preprocessing function
def preprocess_document(
    file_path: str,
    *,
    forced_type: Optional[DocumentType] = None,
    max_chunk_chars: int = 1500,
    chunk_overlap: int = 200,
) -> Dict:
    logger.info(f"Preprocessing document: {file_path}")
    extracted = preprocess_step(file_path, forced_type=forced_type)
    chunks = chunk_step(
        extracted["cleaned_text"],
        max_chunk_chars=max_chunk_chars,
        chunk_overlap=chunk_overlap,
    )
    logger.info(f"Finished preprocessing. Extracted {len(chunks)} chunks.")
    for i, chunk in enumerate(chunks):
        logger.debug(f"Chunk {i}: {len(chunk)} characters")
    return {
        **extracted,
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


from fastapi import APIRouter, File, UploadFile, Form
from fastapi.responses import JSONResponse
from typing import Optional
import fitz  # PyMuPDF
from models.process import GenerateRequest, ChatRequest

router = APIRouter()

def _generate_task_content(content: str, task_type: str) -> str:
    """Core logic to generate AI tasks based on content"""
    if task_type == "summary":
        return f"Summary of the selected content (Context: {len(content)} chars): \nThis material covers the core concepts of the subject, focusing on the provided sources."
    elif task_type == "quiz":
        return f"AI Generated Quiz based on {len(content)} chars of context:\n1. Question based on provided material?\n2. Second concept lookup?"
    elif task_type == "flashcards":
        return f"AI Generated Flashcards:\nFront: Concept X | Back: Definition Y\nFront: Key Term Z | Back: Explanation W"
    elif task_type == "mock_exam":
        return f"AI Generated Mock Exam (20 mins):\nSection A: Multiple Choice\n1. What is the primary focus of the source material?\nSection B: Short Answer\nExplain the central thesis of the provided documents."
    elif task_type == "upload":
        return f"Successfully processed uploaded document ({len(content)} chars)."
    else:
        return f"AI Generated {task_type} based on provided context."

@router.post("/generate")
def generate(request: GenerateRequest):
    result = _generate_task_content(request.content, request.task_type)
    return {"status": "success", "result": result}

@router.post("/process-document")
async def process_document(
    file: Optional[UploadFile] = File(None),
    content: str = Form(""),
    task_type: str = Form("upload")
):
    extracted_text = ""
    
    if file and file.filename.endswith(".pdf"):
        try:
            pdf_bytes = await file.read()
            doc = fitz.open("pdf", pdf_bytes)
            for page in doc:
                extracted_text += page.get_text() + "\n\n"
            doc.close()
        except Exception as e:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": f"Failed to parse PDF: {str(e)}"}
            )
            
    final_content = (content + "\n\n" + extracted_text).strip()
    
    if not final_content:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "No content could be extracted or provided."}
        )

    chunks = [final_content[i:i+500] for i in range(0, len(final_content), 500)]
    embeddings = [{"chunk_index": i, "vector_size": 1536} for i in range(len(chunks))]
    result = _generate_task_content(final_content, task_type)
    
    return {
        "status": "success",
        "data": {
            "extracted_text": final_content,
            "chunks": chunks,
            "embeddings": embeddings,
            "result": result
        }
    }

@router.post("/chat")
def chat(request: ChatRequest):
    result = f"I've analyzed your selected resources ({len(request.context)} chars). Regarding your question '{request.question}': Based on the sources, the answer involves the key themes discussed in the uploaded materials."
    return {"status": "success", "result": result}

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field, constr
from typing import Literal

app = FastAPI()

class GenerateRequest(BaseModel):
    content: constr(min_length=1) = Field(..., description="The content to process")
    task_type: Literal["summary", "quiz", "notes", "flashcards"]

class ChatRequest(BaseModel):
    context: constr(min_length=1) = Field(..., description="The context text")
    question: constr(min_length=1) = Field(..., description="The user's question")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = {}
    for error in exc.errors():
        # Build field path string from loc tuple (skipping 'body')
        field = ".".join([str(x) for x in error["loc"] if x != "body"])
        errors[field] = error["msg"]
        
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"status": "error", "code": "VALIDATION_ERROR", "message": "Engine validation failed", "errors": errors},
    )

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/generate")
def generate(request: GenerateRequest):
    # Mock implementation for generation
    if request.task_type == "summary":
        result = f"Summary of the selected content (Context: {len(request.content)} chars): \nThis material covers the core concepts of the subject, focusing on the provided sources."
    elif request.task_type == "quiz":
        result = f"AI Generated Quiz based on {len(request.content)} chars of context:\n1. Question based on provided material?\n2. Second concept lookup?"
    else:
        result = f"AI Generated {request.task_type} based on provided context."
        
    return {"status": "success", "result": result}

@app.post("/chat")
def chat(request: ChatRequest):
    # Mock implementation for chat
    # In a real scenario, this would use a RAG pipeline
    result = f"I've analyzed your selected resources ({len(request.context)} chars). Regarding your question '{request.question}': Based on the sources, the answer involves the key themes discussed in the uploaded materials."
    
    return {"status": "success", "result": result}

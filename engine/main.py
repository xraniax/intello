from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class GenerateRequest(BaseModel):
    content: str
    task_type: str

@app.get("/")
def read_root():
    return {"message": "Hello from Cognify AI Engine!"}

@app.post("/generate")
def generate(request: GenerateRequest):
    # This is a mock implementation
    # In a real scenario, this would involve NLP models (e.g., GPT, BERT)
    if request.task_type == "summary":
        result = f"Summary of the course content: {request.content[:50]}... (AI generated brief summary)"
    elif request.task_type == "quiz":
        result = [
            {"question": "What is the main topic?", "answer": "The provided content"},
            {"question": "How many pages?", "answer": "1"}
        ]
    else:
        result = "Default AI response"
        
    return {"status": "success", "result": result}

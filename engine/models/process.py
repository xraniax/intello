from pydantic import BaseModel, Field, constr
from typing import Literal

class GenerateRequest(BaseModel):
    content: constr(min_length=1) = Field(..., description="The content to process")
    task_type: Literal["summary", "quiz", "flashcards", "mock_exam", "upload"]

class ChatRequest(BaseModel):
    context: constr(min_length=1) = Field(..., description="The context text")
    question: constr(min_length=1) = Field(..., description="The user's question")

from typing import List, Optional
try:
    from typing import Literal
except ImportError:
    from typing_extensions import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class EmbedRequest(BaseModel):
    """Embed either one string (`text`) or many (`chunks`), not both."""

    text: Optional[str] = Field(
        default=None,
        description="Single string; response contains one embedding (index 0).",
    )
    chunks: Optional[List[str]] = Field(
        default=None,
        description="List of strings; one embedding per item (may be null if a chunk failed).",
    )

    @model_validator(mode="after")
    def exactly_one_source(self) -> "EmbedRequest":
        has_text = self.text is not None and str(self.text).strip() != ""
        has_chunks = self.chunks is not None and len(self.chunks) > 0
        if has_text and has_chunks:
            raise ValueError("Provide only one of 'text' or 'chunks'")
        if not has_text and not has_chunks:
            raise ValueError("Provide non-empty 'text' or a non-empty 'chunks' list")
        return self


class ProcessTextRequest(BaseModel):
    """Run clean → chunk → (optional) embed on raw text without a file upload."""

    text: str = Field(..., min_length=1, description="Raw document text")
    max_chunk_chars: int = Field(default=1500, ge=50, le=32000)
    chunk_overlap: int = Field(default=200, ge=0, le=8000)
    include_embeddings: bool = Field(
        default=True,
        description="If false, returns chunks only (no calls to Ollama).",
    )

class RetrieveRequest(BaseModel):
    subject_id: UUID
    topic: Optional[str] = None
    top_k: int = Field(default=5, ge=1, le=50)

class QuestionTypePreference(BaseModel):
    type: Literal["mcq", "fill_blank", "matching", "essay"]
    count: Optional[int] = None
    percentage: Optional[int] = None
    id_range: Optional[List[int]] = None

class GenerationPolicy(BaseModel):
    version: str = "1.1"
    total_count: int = Field(default=10, ge=1, le=50)
    difficulty: Literal["introductory", "intermediate", "advanced"]
    distribution: List[QuestionTypePreference]

class GenerateRequest(BaseModel):
    subject_id: Optional[UUID] = None
    topic: Optional[str] = None
    material_type: Literal["summary", "quiz", "flashcards", "exam"]
    top_k: int = Field(default=20, ge=1, le=50)
    language: str = Field(default="en")
    user_id: Optional[str] = None
    generation_options: Optional[dict] = None

class ChatRequest(BaseModel):
    subject_id: UUID
    context: Optional[str] = None
    question: str
    top_k: int = Field(default=5, ge=1, le=50)
    language: str = Field(default="en")
    user_id: Optional[str] = None

# --- Structured Output Models ---

class ExamQuestion(BaseModel):
    id: int
    type: Literal["single_choice", "multiple_select", "short_answer", "fill_blank", "matching", "problem", "scenario", "mcq", "essay"] = "single_choice"
    question: str
    answer_space: str = "__________"

class ExamAnswerSheetItem(BaseModel):
    question_id: int
    answer: str
    explanation: str

class GenerationMetadata(BaseModel):
    difficulty: str
    count: Optional[int] = None
    telemetry: Optional[dict] = None
    version: str = "v1"

class ExamContent(BaseModel):
    questions: List[ExamQuestion]
    answer_sheet: List[ExamAnswerSheetItem]

class ExamOutput(BaseModel):
    type: Literal["exam"] = "exam"
    content: ExamContent
    metadata: GenerationMetadata

class QuizQuestion(BaseModel):
    id: int
    question: str
    options: Optional[List[str]] = None
    correct_answer: str
    explanation: str

class QuizContent(BaseModel):
    questions: List[QuizQuestion]

class QuizOutput(BaseModel):
    type: Literal["quiz"] = "quiz"
    content: QuizContent
    metadata: GenerationMetadata

class Flashcard(BaseModel):
    front: str
    back: str

class FlashcardsContent(BaseModel):
    cards: List[Flashcard]

class FlashcardsOutput(BaseModel):
    type: Literal["flashcards"] = "flashcards"
    content: FlashcardsContent
    metadata: GenerationMetadata

class SummarySection(BaseModel):
    heading: str
    body: str

class SummaryContent(BaseModel):
    title: str
    sections: List[SummarySection]

class SummaryOutput(BaseModel):
    type: Literal["summary"] = "summary"
    content: SummaryContent
    metadata: GenerationMetadata

# --- Evaluation Models ---

class QuizSubmission(BaseModel):
    question_id: int
    user_answer: str

class QuizEvaluateRequest(BaseModel):
    # Questions (with correct answers) are passed back for stateless evaluation
    questions: List[QuizQuestion]
    submissions: List[QuizSubmission]

class QuizResultItem(BaseModel):
    question_id: int
    status: Literal["correct", "wrong"]
    color: Literal["green", "red"]
    explanation: Optional[str] = None

class QuizEvaluateResponse(BaseModel):
    type: Literal["quiz_result"] = "quiz_result"
    results: List[QuizResultItem]


# --- Adaptive Quiz Schemas ---

class QuizNextRequest(BaseModel):
    user_id: str
    subject_id: str
    topic: Optional[str] = None
    language: str = Field(default="en")
    top_k: int = Field(default=5, ge=1, le=50)


class QuizSubmitAnswerRequest(BaseModel):
    user_id: str
    subject_id: str
    topic: Optional[str] = None
    is_correct: bool
    response_time: float = Field(default=0.0, ge=0.0)
    language: str = Field(default="en")
    top_k: int = Field(default=5, ge=1, le=50)

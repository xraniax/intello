from typing import List, Optional, Literal, Dict, Any
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
    total_count: int = Field(default=10, ge=1, le=10)
    difficulty: Literal["introductory", "intermediate", "advanced"]
    distribution: List[QuestionTypePreference]

class GenerateRequest(BaseModel):
    subject_id: Optional[UUID] = None
    topic: Optional[str] = None
    material_type: Literal["summary", "quiz", "flashcards", "exam"]
    top_k: int = Field(default=20, ge=1, le=50)
    language: str = Field(default="en")
    user_id: Optional[str] = None
    summary_mode: Optional[str] = None
    generation_options: Optional[dict] = None
    chunks: Optional[List[str]] = None
    # Filenames (basename of stored file path) used to scope retrieval to selected documents.
    # Maps to engine documents.filename via subject_id+filename lookup — NOT to documents.id (Integer).
    source_filenames: Optional[List[str]] = None
    # Material UUIDs (from backend) to restrict retrieval context.
    material_ids: Optional[List[UUID]] = None

class ChatRequest(BaseModel):
    subject_id: UUID
    context: Optional[str] = None
    question: str
    top_k: int = Field(default=5, ge=1, le=50)
    language: str = Field(default="en")
    user_id: Optional[str] = None
    chunks: Optional[List[str]] = None


class ChatMessage(BaseModel):
    """A single turn in a conversation (user or assistant)."""
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1)


class UnifiedChatRequest(BaseModel):
    """Structured payload for the unified POST /chat endpoint."""
    subject_id: str = Field(
        ...,
        description="Subject UUID or integer ID. Accepts both UUID strings and numeric IDs.",
    )
    question: str = Field(..., min_length=1, max_length=2000, description="The student's question.")
    conversation_history: List[ChatMessage] = Field(
        default_factory=list,
        max_length=50,
        description="Prior turns in the conversation for context-aware answering.",
    )
    material_ids: Optional[List[UUID]] = Field(
        default=None,
        description="Optional list of material UUIDs to restrict context retrieval."
    )
    top_k: int = Field(default=8, ge=1, le=50, description="Number of context chunks to retrieve.")

    language: str = Field(default="en", description="Language for the AI response.")

    @model_validator(mode="after")
    def sanitize_subject_id(self) -> "UnifiedChatRequest":
        val = str(self.subject_id).strip()
        if not val:
            raise ValueError("subject_id must not be empty")
        self.subject_id = val
        return self


class ChatSource(BaseModel):
    """A retrieved chunk that contributed to the answer."""
    chunk_id: int
    document_id: int
    material_id: Optional[str] = None
    page_number: Optional[int] = None
    excerpt: str = Field(..., description="First 200 chars of the chunk content used as context.")


class UnifiedChatResponse(BaseModel):
    """Structured response from the unified /chat endpoint."""
    answer: str
    sources: List[ChatSource]
    confidence: float = Field(..., ge=0.0, le=1.0)
    latency_ms: float

# --- Structured Output Models ---

class ExamQuestion(BaseModel):
    id: str
    question: str
    options: List[str] = Field(default_factory=list)
    answer: Optional[str] = None
    answer_space: Optional[str] = None
    difficulty: Optional[str] = "intermediate"

class ExamAnswerSheetItem(BaseModel):
    question_id: str
    answer: str
    explanation: Optional[str] = None

class GenerationMetadata(BaseModel):
    model: str
    provider: str = "ollama"
    difficulty: str = "intermediate"
    count: Optional[int] = None
    version: str = "v1"
    additional_info: Dict[str, Any] = Field(default_factory=dict)

class ExamContent(BaseModel):
    questions: List[ExamQuestion]
    answer_sheet: List[ExamAnswerSheetItem]

class ExamOutput(BaseModel):
    type: Literal["exam"] = "exam"
    content: ExamContent
    metadata: GenerationMetadata = Field(default_factory=GenerationMetadata)

class QuizQuestion(BaseModel):
    id: int
    question: str
    options: Optional[List[str]] = None
    correct_answer: str
    explanation: Optional[str] = None

class QuizContent(BaseModel):
    questions: List[QuizQuestion]

class QuizOutput(BaseModel):
    type: Literal["quiz"] = "quiz"
    content: QuizContent
    metadata: GenerationMetadata = Field(default_factory=GenerationMetadata)

class Flashcard(BaseModel):
    front: str
    back: str

class FlashcardsContent(BaseModel):
    cards: List[Flashcard]

class FlashcardsOutput(BaseModel):
    type: Literal["flashcards"] = "flashcards"
    content: FlashcardsContent
    metadata: GenerationMetadata = Field(default_factory=GenerationMetadata)

class SummarySection(BaseModel):
    heading: str
    body: str

class SummaryContent(BaseModel):
    title: str
    sections: List[SummarySection]

class SummaryOutput(BaseModel):
    type: Literal["summary"] = "summary"
    content: SummaryContent
    metadata: GenerationMetadata = Field(default_factory=GenerationMetadata)

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


# --- Study Plan Generation Models ---

class GoalInput(BaseModel):
    id: str
    title: str
    type: str
    target: int
    period: str
    subject: Optional[str] = None

class PlanGenerateRequest(BaseModel):
    goals: List[GoalInput]
    days_per_week: int = Field(default=5)
    hours_per_day: float = Field(default=2.0)

class PlanSession(BaseModel):
    day_of_week: Literal["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    duration_minutes: int
    focus_topic: str
    goal_id: Optional[str]

class StudyPlanContent(BaseModel):
    summary: str
    sessions: List[PlanSession]

class StudyPlanOutput(BaseModel):
    type: Literal["study_plan"] = "study_plan"
    content: StudyPlanContent
    metadata: GenerationMetadata


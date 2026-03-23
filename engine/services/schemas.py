from typing import List, Optional

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

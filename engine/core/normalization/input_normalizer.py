"""Canonical input normalization helpers for engine endpoints."""

from typing import Optional
from uuid import UUID


MATERIAL_TYPE_ALIASES = {
    "note": "summary",
    "notes": "summary",
    "flashcard": "flashcards",
}

SUPPORTED_MATERIAL_TYPES = frozenset({"summary", "quiz", "flashcards", "exam"})

# Frontend sends abbreviated codes; pipeline functions expect canonical strings.
_DIFFICULTY_ALIASES = {
    "intro": "beginner",
    "inter": "intermediate",
    "adv": "advanced",
}


def normalize_difficulty(value: Optional[str]) -> str:
    """Map frontend difficulty codes to canonical pipeline strings.

    'Intro' → 'beginner', 'Inter' → 'intermediate', 'Adv' → 'advanced'.
    Unknown values pass through unchanged so the pipeline's else-branch default applies.
    """
    raw = str(value or "").strip().lower()
    return _DIFFICULTY_ALIASES.get(raw, raw)


def normalize_material_type(value: Optional[str]) -> str:
    """Normalize material type with alias mapping and case/whitespace cleanup."""
    requested_type = str(value or "").strip().lower()
    return MATERIAL_TYPE_ALIASES.get(requested_type, requested_type)


def parse_optional_uuid(value: Optional[str], field_name: str) -> Optional[str]:
    """Parse a UUID-like field, preserving previous API validation behavior."""
    normalized = normalize_text(value)
    if normalized is None:
        return None
    try:
        return str(UUID(normalized))
    except (TypeError, ValueError) as e:
        raise ValueError(f"Invalid {field_name}: must be a UUID") from e


def normalize_text(value: Optional[str]) -> Optional[str]:
    """Trim and coerce text; return None for empty input."""
    if value is None:
        return None
    stripped = str(value).strip()
    return stripped if stripped else None


def coalesce_text(content: Optional[str], text: Optional[str]) -> Optional[str]:
    """Select the first available text source and normalize it."""
    candidate = content if content is not None else text
    return normalize_text(candidate)

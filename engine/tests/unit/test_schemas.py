"""
Unit tests for Pydantic schemas in services/schemas.py.

These validate that request/response models enforce their constraints correctly.
"""
import pytest
from pydantic import ValidationError
from services.schemas import (
    EmbedRequest,
    ProcessTextRequest,
    RetrieveRequest,
    GenerationPolicy,
    QuestionTypePreference,
)
import uuid


# ─── EmbedRequest ─────────────────────────────────────────────────────────────

@pytest.mark.unit
class TestEmbedRequest:
    def test_accepts_text_only(self):
        req = EmbedRequest(text="hello world")
        assert req.text == "hello world"

    def test_accepts_chunks_only(self):
        req = EmbedRequest(chunks=["chunk a", "chunk b"])
        assert len(req.chunks) == 2

    def test_rejects_both_text_and_chunks(self):
        with pytest.raises(ValidationError, match="only one"):
            EmbedRequest(text="hello", chunks=["also hello"])

    def test_rejects_neither_text_nor_chunks(self):
        with pytest.raises(ValidationError):
            EmbedRequest()

    def test_rejects_whitespace_only_text(self):
        with pytest.raises(ValidationError):
            EmbedRequest(text="   ")

    def test_rejects_empty_chunks_list(self):
        with pytest.raises(ValidationError):
            EmbedRequest(chunks=[])


# ─── ProcessTextRequest ───────────────────────────────────────────────────────

@pytest.mark.unit
class TestProcessTextRequest:
    def test_accepts_minimal_valid_input(self):
        req = ProcessTextRequest(text="some content")
        assert req.text == "some content"
        assert req.max_chunk_chars == 1500  # default
        assert req.include_embeddings is True  # default

    def test_rejects_empty_text(self):
        with pytest.raises(ValidationError):
            ProcessTextRequest(text="")

    def test_rejects_max_chunk_chars_below_50(self):
        with pytest.raises(ValidationError):
            ProcessTextRequest(text="content", max_chunk_chars=10)

    def test_rejects_max_chunk_chars_above_32000(self):
        with pytest.raises(ValidationError):
            ProcessTextRequest(text="content", max_chunk_chars=99999)

    def test_accepts_custom_chunk_parameters(self):
        req = ProcessTextRequest(text="data", max_chunk_chars=2000, chunk_overlap=300)
        assert req.max_chunk_chars == 2000
        assert req.chunk_overlap == 300


# ─── GenerationPolicy ─────────────────────────────────────────────────────────

@pytest.mark.unit
class TestGenerationPolicy:
    def _valid_policy(self, **kwargs):
        defaults = dict(
            total_count=10,
            difficulty="intermediate",
            distribution=[QuestionTypePreference(type="mcq", percentage=100)],
        )
        defaults.update(kwargs)
        return GenerationPolicy(**defaults)

    def test_accepts_valid_policy(self):
        policy = self._valid_policy()
        assert policy.total_count == 10
        assert policy.difficulty == "intermediate"

    def test_rejects_total_count_below_1(self):
        with pytest.raises(ValidationError):
            self._valid_policy(total_count=0)

    def test_rejects_total_count_above_50(self):
        with pytest.raises(ValidationError):
            self._valid_policy(total_count=51)

    def test_rejects_invalid_difficulty(self):
        with pytest.raises(ValidationError):
            self._valid_policy(difficulty="ultra_hard")

    def test_accepts_all_valid_difficulty_levels(self):
        for level in ("introductory", "intermediate", "advanced"):
            policy = self._valid_policy(difficulty=level)
            assert policy.difficulty == level

    def test_default_version_is_set(self):
        policy = self._valid_policy()
        assert policy.version == "1.1"


# ─── QuestionTypePreference ───────────────────────────────────────────────────

@pytest.mark.unit
class TestQuestionTypePreference:
    def test_accepts_mcq(self):
        q = QuestionTypePreference(type="mcq", count=5)
        assert q.type == "mcq"

    def test_accepts_all_valid_types(self):
        for t in ("mcq", "fill_blank", "matching", "essay"):
            q = QuestionTypePreference(type=t, count=1)
            assert q.type == t

    def test_rejects_unknown_type(self):
        with pytest.raises(ValidationError):
            QuestionTypePreference(type="true_false", count=1)

    def test_count_and_percentage_are_both_optional(self):
        q = QuestionTypePreference(type="essay")
        assert q.count is None
        assert q.percentage is None


# ─── RetrieveRequest ──────────────────────────────────────────────────────────

@pytest.mark.unit
class TestRetrieveRequest:
    def test_accepts_valid_uuid_subject_id(self):
        req = RetrieveRequest(subject_id=uuid.uuid4())
        assert req.top_k == 5  # default

    def test_rejects_invalid_uuid(self):
        with pytest.raises(ValidationError):
            RetrieveRequest(subject_id="not-a-uuid")

    def test_rejects_top_k_below_1(self):
        with pytest.raises(ValidationError):
            RetrieveRequest(subject_id=uuid.uuid4(), top_k=0)

    def test_rejects_top_k_above_50(self):
        with pytest.raises(ValidationError):
            RetrieveRequest(subject_id=uuid.uuid4(), top_k=51)

    def test_accepts_boundary_top_k_values(self):
        req1 = RetrieveRequest(subject_id=uuid.uuid4(), top_k=1)
        req2 = RetrieveRequest(subject_id=uuid.uuid4(), top_k=50)
        assert req1.top_k == 1
        assert req2.top_k == 50

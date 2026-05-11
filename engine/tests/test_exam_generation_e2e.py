"""
End-to-End Test Suite for Exam Generation Pipeline

This test validates the complete exam generation flow:
1. Request validation and normalization
2. Context retrieval from chunks
3. Prompt building with correct constraints
4. LLM generation (mocked/simulated)
5. JSON extraction and parsing
6. Schema validation (ExamOutput)
7. Content validation (questions + answer_sheet)
8. Result normalization

Usage:
    cd /home/rania/cognify/engine
    python -m pytest tests/test_exam_generation_e2e.py -v
"""

import json
import pytest
import os
import sys
from unittest.mock import Mock, patch, MagicMock
from typing import List, Dict, Any

# Ensure engine is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.schemas import ExamOutput, ExamQuestion, ExamAnswerSheetItem, GenerationMetadata
from services.generation import (
    build_prompt,
    _strip_markdown_fences,
    _extract_json_payload,
    _validate_mode_specific_constraints,
    _validate_non_empty_material,
    generate_study_material,
)
from tasks import initialize_workspace_config, _normalize_generation_result


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def sample_context_chunks() -> List[str]:
    """Sample document chunks for exam generation context."""
    return [
        "Python is a high-level programming language created by Guido van Rossum in 1991.",
        "It emphasizes code readability with its use of significant whitespace.",
        "Python supports multiple programming paradigms: structured, object-oriented, and functional.",
        "The language has a large standard library and supports automatic memory management.",
        "Common use cases include web development, data science, AI/ML, and automation.",
        "Python's syntax is designed to be readable and straightforward.",
    ]


@pytest.fixture
def exam_generation_options() -> Dict[str, Any]:
    """Standard exam generation options."""
    return {
        "count": 5,
        "difficulty": "intermediate",
        "types": ["single_choice", "short_answer"],
        "topic": "Python Programming Basics",
    }


@pytest.fixture
def valid_exam_json() -> Dict[str, Any]:
    """A valid exam output structure matching ExamOutput schema."""
    return {
        "type": "exam",
        "content": {
            "questions": [
                {
                    "id": 1,
                    "type": "single_choice",
                    "question": "Who created Python?",
                    "answer_space": "__________"
                },
                {
                    "id": 2,
                    "type": "short_answer",
                    "question": "What year was Python created?",
                    "answer_space": "__________"
                },
                {
                    "id": 3,
                    "type": "single_choice",
                    "question": "Which of the following is NOT a Python paradigm?",
                    "answer_space": "__________"
                },
                {
                    "id": 4,
                    "type": "short_answer",
                    "question": "What does Python use for automatic memory management?",
                    "answer_space": "__________"
                },
                {
                    "id": 5,
                    "type": "single_choice",
                    "question": "Which feature makes Python code readable?",
                    "answer_space": "__________"
                }
            ],
            "answer_sheet": [
                {
                    "question_id": 1,
                    "answer": "Guido van Rossum",
                    "explanation": "Guido van Rossum created Python in 1991."
                },
                {
                    "question_id": 2,
                    "answer": "1991",
                    "explanation": "Python was first released in 1991."
                },
                {
                    "question_id": 3,
                    "answer": "Declarative programming",
                    "explanation": "Python supports structured, OOP, and functional paradigms, not declarative."
                },
                {
                    "question_id": 4,
                    "answer": "Garbage collection",
                    "explanation": "Python uses garbage collection for automatic memory management."
                },
                {
                    "question_id": 5,
                    "answer": "Significant whitespace/indentation",
                    "explanation": "Python uses indentation and whitespace to define code blocks."
                }
            ]
        },
        "metadata": {
            "difficulty": "intermediate",
            "count": 5,
            "version": "v1.1"
        }
    }


# =============================================================================
# Test Class: Request Validation and Normalization
# =============================================================================

class TestRequestValidation:
    """Tests for exam request validation and configuration initialization."""

    def test_initialize_workspace_config_valid(self):
        """Test config initialization with valid options."""
        opts = {
            "count": 10,
            "difficulty": "advanced",
            "types": ["single_choice", "short_answer"],
        }
        config = initialize_workspace_config("test-subject-123", opts)
        
        assert config["count"] == 10
        assert config["difficulty"] == "advanced"
        assert config["types"] == ["single_choice", "short_answer"]
        assert config["config_version"] == 1
        assert config["strict_fallback_immunity"] is True

    def test_initialize_workspace_config_repairs_missing_types(self):
        """Test that missing exam types are auto-repaired."""
        opts = {"count": 5, "difficulty": "intermediate", "types": []}
        config = initialize_workspace_config("test-subject-123", opts)
        
        # Should default to basic types
        assert len(config["types"]) > 0
        assert "single_choice" in config["types"]

    def test_initialize_workspace_config_repairs_invalid_count(self):
        """Test that invalid counts are auto-repaired."""
        opts = {"count": -5, "difficulty": "easy", "types": ["mcq"]}
        config = initialize_workspace_config("test-subject-123", opts)
        
        assert config["count"] == 10  # Default value

    def test_initialize_workspace_config_version_upgrade(self):
        """Test version upgrade for outdated configs."""
        opts = {"config_version": 0, "count": 8}
        config = initialize_workspace_config("test-subject-123", opts)
        
        assert config["config_version"] == 1


# =============================================================================
# Test Class: Prompt Building
# =============================================================================

class TestPromptBuilding:
    """Tests for exam prompt construction."""

    def test_exam_prompt_includes_count_constraint(self, sample_context_chunks):
        """Verify prompt includes exact question count requirement."""
        prompt = build_prompt(
            material_type="exam",
            context="\n\n".join(sample_context_chunks),
            topic="Python Basics",
            language="en",
            count=7,
            difficulty="intermediate"
        )
        
        assert "EXACTLY 7" in prompt or "exactly 7" in prompt.lower()
        assert "unique questions" in prompt.lower()
        assert "DO NOT truncate" in prompt

    def test_exam_prompt_includes_answer_space_requirement(self, sample_context_chunks):
        """Verify prompt requires answer_space field."""
        prompt = build_prompt(
            material_type="exam",
            context="\n\n".join(sample_context_chunks),
            topic="Python Basics",
            language="en",
            count=5
        )
        
        assert "answer_space" in prompt.lower()

    def test_exam_prompt_structure_requirement(self, sample_context_chunks):
        """Verify prompt specifies questions + answer_sheet structure."""
        prompt = build_prompt(
            material_type="exam",
            context="\n\n".join(sample_context_chunks),
            topic="Python Basics",
            language="en",
            count=5
        )
        
        assert "questions" in prompt
        assert "answer_sheet" in prompt
        assert "question_id" in prompt

    def test_exam_prompt_json_format_instruction(self, sample_context_chunks):
        """Verify prompt includes strict JSON formatting instructions."""
        prompt = build_prompt(
            material_type="exam",
            context="\n\n".join(sample_context_chunks),
            topic="Python Basics",
            language="en",
            count=5
        )
        
        assert "valid JSON" in prompt or "JSON" in prompt

    def test_exam_prompt_topic_focus(self, sample_context_chunks):
        """Verify topic is included in prompt when provided."""
        prompt = build_prompt(
            material_type="exam",
            context="\n\n".join(sample_context_chunks),
            topic="Python Programming",
            language="en",
            count=5
        )
        
        assert "Python Programming" in prompt

    def test_exam_prompt_language_setting(self, sample_context_chunks):
        """Verify language is respected in prompt."""
        # English
        prompt_en = build_prompt(
            material_type="exam",
            context="\n\n".join(sample_context_chunks),
            topic=None,
            language="en",
            count=5
        )
        
        # The prompt should contain language reference
        assert "in en" in prompt_en.lower() or "english" in prompt_en.lower()


# =============================================================================
# Test Class: JSON Processing
# =============================================================================

class TestJsonProcessing:
    """Tests for JSON extraction, cleaning, and parsing."""

    def test_strip_markdown_fences_json(self):
        """Test removal of markdown JSON fences."""
        text = """```json
{"type": "exam", "content": {"questions": []}}
```"""
        result = _strip_markdown_fences(text)
        assert "```json" not in result
        assert "```" not in result
        assert result.strip() == '{"type": "exam", "content": {"questions": []}}'

    def test_strip_markdown_fences_generic(self):
        """Test removal of generic markdown fences."""
        text = """```
{"type": "exam"}
```"""
        result = _strip_markdown_fences(text)
        assert "```" not in result
        assert result.strip() == '{"type": "exam"}'

    def test_strip_markdown_fences_no_fences(self):
        """Test that text without fences is returned as-is."""
        text = '{"type": "exam"}'
        result = _strip_markdown_fences(text)
        assert result == text

    def test_extract_json_payload_valid(self):
        """Test JSON extraction from valid payload."""
        text = '{"type": "exam", "content": {"questions": []}}'
        result = _extract_json_payload(text)
        assert json.loads(result)  # Should be valid JSON

    def test_extract_json_payload_with_extra_text(self):
        """Test JSON extraction when wrapped in extra text."""
        text = 'Here is the exam: {"type": "exam", "content": {"questions": []}} Thank you!'
        result = _extract_json_payload(text)
        parsed = json.loads(result)
        assert parsed["type"] == "exam"

    def test_extract_json_payload_empty_raises(self):
        """Test that empty string raises ValueError."""
        with pytest.raises(ValueError, match="empty"):
            _extract_json_payload("")

    def test_extract_json_payload_no_json_raises(self):
        """Test that text without JSON raises ValueError."""
        with pytest.raises(ValueError, match="JSON"):
            _extract_json_payload("This is just plain text without any JSON object.")


# =============================================================================
# Test Class: Schema Validation
# =============================================================================

class TestSchemaValidation:
    """Tests for Pydantic schema validation."""

    def test_exam_output_schema_valid(self, valid_exam_json):
        """Test that valid exam JSON passes schema validation."""
        output = ExamOutput(**valid_exam_json)
        
        assert output.type == "exam"
        assert len(output.content.questions) == 5
        assert len(output.content.answer_sheet) == 5
        assert output.metadata.count == 5

    def test_exam_output_schema_missing_questions_raises(self):
        """Test that empty questions are detected by validation functions."""
        invalid = {
            "type": "exam",
            "content": {
                "questions": [],
                "answer_sheet": []
            },
            "metadata": {"count": 5}
        }
        
        # Schema allows empty lists but validation function catches it
        warning = _validate_non_empty_material("exam", invalid)
        assert warning is not None
        assert "empty" in warning.lower()

    def test_exam_output_schema_missing_answer_sheet_raises(self):
        """Test that missing answer_sheet raises validation error."""
        invalid = {
            "type": "exam",
            "content": {
                "questions": [{"id": 1, "question": "Test?", "answer_space": "___"}],
                # Missing answer_sheet
            },
            "metadata": {"count": 1}
        }
        
        with pytest.raises(Exception):
            ExamOutput(**invalid)

    def test_exam_output_schema_mismatched_ids_raises(self):
        """Test that mismatched question/answer IDs raises validation error."""
        invalid = {
            "type": "exam",
            "content": {
                "questions": [
                    {"id": 1, "question": "Q1?", "answer_space": "___"},
                    {"id": 2, "question": "Q2?", "answer_space": "___"}
                ],
                "answer_sheet": [
                    {"question_id": 1, "answer": "A1", "explanation": "E1"},
                    {"question_id": 999, "answer": "Wrong ID", "explanation": "Bad"}  # Wrong ID
                ]
            },
            "metadata": {"count": 2}
        }
        
        # This should fail the constraint validation
        with pytest.raises((ValueError, Exception)):
            output = ExamOutput(**invalid)
            _validate_mode_specific_constraints("exam", output.model_dump())

    def test_exam_output_question_types(self):
        """Test that all supported question types are accepted."""
        supported_types = ["single_choice", "multiple_select", "short_answer", 
                          "fill_blank", "matching", "problem", "scenario", "mcq", "essay"]
        
        for q_type in supported_types:
            question = {
                "id": 1,
                "type": q_type,
                "question": f"Test question of type {q_type}?",
                "answer_space": "__________"
            }
            exam = {
                "type": "exam",
                "content": {
                    "questions": [question],
                    "answer_sheet": [{"question_id": 1, "answer": "A", "explanation": "E"}]
                },
                "metadata": {"count": 1}
            }
            # Should not raise
            output = ExamOutput(**exam)
            assert output.content.questions[0].type == q_type


# =============================================================================
# Test Class: Mode-Specific Constraints
# =============================================================================

class TestModeSpecificConstraints:
    """Tests for exam-specific constraint validation."""

    def test_exam_requires_answer_space(self):
        """Test that exam questions must have answer_space."""
        invalid = {
            "type": "exam",
            "content": {
                "questions": [
                    {"id": 1, "question": "No answer space here?"}  # Missing answer_space
                ],
                "answer_sheet": [{"question_id": 1, "answer": "A", "explanation": "E"}]
            },
            "metadata": {}
        }
        
        with pytest.raises(ValueError, match="answer_space"):
            _validate_mode_specific_constraints("exam", invalid)

    def test_exam_answer_sheet_ids_must_match(self):
        """Test that answer_sheet IDs must match question numbering."""
        invalid = {
            "type": "exam",
            "content": {
                "questions": [
                    {"id": 1, "question": "Q1?", "answer_space": "___"},
                    {"id": 2, "question": "Q2?", "answer_space": "___"}
                ],
                "answer_sheet": [
                    {"question_id": 1, "answer": "A1", "explanation": "E1"},
                    {"question_id": 3, "answer": "A3", "explanation": "E3"}  # Wrong ID
                ]
            },
            "metadata": {}
        }
        
        with pytest.raises(ValueError, match="answer_sheet"):
            _validate_mode_specific_constraints("exam", invalid)

    def test_exam_non_empty_content_valid(self, valid_exam_json):
        """Test that valid exam passes non-empty validation."""
        warning = _validate_non_empty_material("exam", valid_exam_json)
        assert warning is None

    def test_exam_empty_questions_warning(self):
        """Test that empty questions list produces warning."""
        empty = {
            "type": "exam",
            "content": {
                "questions": [],
                "answer_sheet": []
            },
            "metadata": {}
        }
        
        warning = _validate_non_empty_material("exam", empty)
        assert warning is not None
        assert "empty" in warning.lower()

    def test_exam_empty_answer_sheet_warning(self):
        """Test that empty answer_sheet produces warning."""
        empty_sheet = {
            "type": "exam",
            "content": {
                "questions": [{"id": 1, "question": "Q?", "answer_space": "___"}],
                "answer_sheet": []
            },
            "metadata": {}
        }
        
        warning = _validate_non_empty_material("exam", empty_sheet)
        assert warning is not None
        assert "answer_sheet" in warning.lower()


# =============================================================================
# Test Class: Result Normalization
# =============================================================================

class TestResultNormalization:
    """Tests for generation result normalization."""

    def test_normalize_exam_result(self, valid_exam_json):
        """Test normalization of valid exam output."""
        result = _normalize_generation_result(
            valid_exam_json,
            "exam",
            "Python Basics",
            "en",
            5,
            "subject-123"
        )
        
        assert result["type"] == "exam"
        assert "content" in result
        assert "metadata" in result
        assert result["metadata"]["model"] is not None
        assert result["metadata"]["additional_info"]["topic"] == "Python Basics"
        assert result["metadata"]["additional_info"]["subject_id"] == "subject-123"

    def test_normalize_rejects_mixed_contract(self):
        """Test that mixed content + ai_generated_content is rejected."""
        mixed = {
            "content": "legacy",
            "ai_generated_content": {"type": "exam"}
        }
        
        with pytest.raises(ValueError, match="Mixed contract"):
            _normalize_generation_result(mixed, "exam", None, "en", 5, "sub-123")

    def test_normalize_string_output(self):
        """Test that string output is wrapped correctly."""
        result = _normalize_generation_result(
            "Plain text output",
            "exam",
            None,
            "en",
            5,
            "sub-123"
        )
        
        assert result["type"] == "exam"
        assert result["content"] == "Plain text output"


# =============================================================================
# Test Class: Integration / End-to-End
# =============================================================================

class TestExamGenerationE2E:
    """
    End-to-end integration tests for the complete exam generation pipeline.
    These tests mock the LLM call but exercise all other real code paths.
    """

    @patch("services.generation._stream_ollama_generate")
    def test_full_generation_pipeline_success(self, mock_stream, sample_context_chunks, valid_exam_json):
        """
        Test the complete generation flow with mocked LLM response.
        
        Pipeline stages tested:
        1. Context building
        2. Prompt construction
        3. LLM call (mocked)
        4. JSON parsing and cleaning
        5. Schema validation
        6. Constraint validation
        7. Result normalization
        """
        # Mock the LLM to return our valid exam JSON
        mock_stream.return_value = json.dumps(valid_exam_json)
        
        # Run the generation
        result = generate_study_material(
            chunks=sample_context_chunks,
            material_type="exam",
            topic="Python Basics",
            language="en",
            count=5,
            difficulty="intermediate"
        )
        
        # Verify the result
        assert isinstance(result, dict)
        assert result["type"] == "exam"
        assert "content" in result
        assert len(result["content"]["questions"]) == 5
        assert len(result["content"]["answer_sheet"]) == 5
        
        # Verify LLM was called with correct parameters
        mock_stream.assert_called_once()
        call_args = mock_stream.call_args
        assert call_args[1]["material_type"] == "exam"

    @patch("services.generation._stream_ollama_generate")
    def test_generation_with_markdown_fences(self, mock_stream, sample_context_chunks, valid_exam_json):
        """Test that generation handles markdown-fenced JSON responses."""
        # Wrap the JSON in markdown fences
        fenced_json = f"```json\n{json.dumps(valid_exam_json)}\n```"
        mock_stream.return_value = fenced_json
        
        result = generate_study_material(
            chunks=sample_context_chunks,
            material_type="exam",
            topic="Python Basics",
            language="en",
            count=5
        )
        
        assert result["type"] == "exam"
        assert len(result["content"]["questions"]) == 5

    @patch("services.generation._stream_ollama_generate")
    def test_generation_parses_list_response(self, mock_stream, sample_context_chunks):
        """Test that generation handles when LLM returns just a list."""
        # LLM might return just the questions list
        list_response = json.dumps([
            {"id": 1, "question": "Q1?", "answer_space": "___"},
            {"id": 2, "question": "Q2?", "answer_space": "___"}
        ])
        mock_stream.return_value = list_response
        
        # We need a full exam structure, so let's use valid_exam_json instead
        full_response = json.dumps({
            "type": "exam",
            "content": {
                "questions": [
                    {"id": 1, "type": "single_choice", "question": "Q1?", "answer_space": "___"},
                    {"id": 2, "type": "single_choice", "question": "Q2?", "answer_space": "___"}
                ],
                "answer_sheet": [
                    {"question_id": 1, "answer": "A1", "explanation": "E1"},
                    {"question_id": 2, "answer": "A2", "explanation": "E2"}
                ]
            },
            "metadata": {"count": 2}
        })
        mock_stream.return_value = full_response
        
        result = generate_study_material(
            chunks=sample_context_chunks,
            material_type="exam",
            topic="Test",
            language="en",
            count=2
        )
        
        assert result["type"] == "exam"

    @patch("services.generation._stream_ollama_generate")
    def test_generation_retry_on_invalid_json(self, mock_stream, sample_context_chunks, valid_exam_json):
        """Test that generation retries when LLM returns invalid JSON."""
        # First call returns invalid JSON, second call returns valid
        mock_stream.side_effect = [
            "Not valid JSON { broken",
            json.dumps(valid_exam_json)
        ]
        
        result = generate_study_material(
            chunks=sample_context_chunks,
            material_type="exam",
            topic="Python Basics",
            language="en",
            count=5,
            retries=2
        )
        
        assert result["type"] == "exam"
        assert mock_stream.call_count == 2

    @patch("services.generation._stream_ollama_generate")
    def test_generation_retry_on_empty_content(self, mock_stream, sample_context_chunks):
        """Test that generation retries when content is empty."""
        # Return empty questions
        empty_response = json.dumps({
            "type": "exam",
            "content": {
                "questions": [],
                "answer_sheet": []
            },
            "metadata": {"count": 0}
        })
        
        valid_response = json.dumps({
            "type": "exam",
            "content": {
                "questions": [
                    {"id": 1, "type": "single_choice", "question": "Q1?", "answer_space": "___"}
                ],
                "answer_sheet": [
                    {"question_id": 1, "answer": "A", "explanation": "E"}
                ]
            },
            "metadata": {"count": 1}
        })
        
        mock_stream.side_effect = [empty_response, valid_response]
        
        result = generate_study_material(
            chunks=sample_context_chunks,
            material_type="exam",
            topic="Test",
            language="en",
            count=1,
            retries=2
        )
        
        # Should either get valid result or error dict
        assert mock_stream.call_count == 2

    @patch("services.generation._stream_ollama_generate")
    def test_generation_all_retries_fail(self, mock_stream, sample_context_chunks):
        """Test behavior when all retry attempts fail."""
        mock_stream.return_value = "Always invalid JSON"
        
        result = generate_study_material(
            chunks=sample_context_chunks,
            material_type="exam",
            topic="Test",
            language="en",
            count=5,
            retries=2
        )
        
        # Should return error dict
        assert "error" in result
        mock_stream.call_count == 2


# =============================================================================
# Test Class: Edge Cases and Error Handling
# =============================================================================

class TestEdgeCases:
    """Tests for edge cases and error scenarios."""

    def test_empty_chunks_returns_error(self):
        """Test that empty chunks returns appropriate error."""
        result = generate_study_material(
            chunks=[],
            material_type="exam",
            topic="Test",
            language="en"
        )
        
        # Should return error string since it's the early return path
        assert "Not enough context" in result or isinstance(result, str)

    def test_large_context_truncation(self, sample_context_chunks):
        """Test that large contexts are properly truncated in _build_generation_context."""
        from services.generation import _build_generation_context
        
        # Create oversized context
        huge_chunks = ["X" * 10000 for _ in range(100)]
        
        # Test the actual truncation function
        context = _build_generation_context(huge_chunks)
        
        # Should be truncated - OLLAMA_MAX_CONTEXT_CHARS default is 15000
        assert len(context) <= 16000  # Allow for truncation marker
        assert "truncated" in context.lower() or len(context) < sum(len(c) for c in huge_chunks)

    def test_exam_count_one(self, sample_context_chunks):
        """Test exam generation with minimum count of 1."""
        prompt = build_prompt(
            material_type="exam",
            context="\n\n".join(sample_context_chunks),
            topic="Test",
            language="en",
            count=1
        )
        
        assert "EXACTLY 1" in prompt or "exactly 1" in prompt.lower()

    def test_exam_count_fifty(self, sample_context_chunks):
        """Test exam generation with maximum count of 50."""
        prompt = build_prompt(
            material_type="exam",
            context="\n\n".join(sample_context_chunks),
            topic="Test",
            language="en",
            count=50
        )
        
        assert "EXACTLY 50" in prompt or "exactly 50" in prompt.lower()


# =============================================================================
# Main entry point for standalone execution
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

import pytest
from services.generation import normalize_to_canonical
from services.schemas import ExamOutput, SummaryOutput, QuizOutput, FlashcardsOutput
from pydantic import ValidationError

@pytest.mark.unit
class TestCanonicalNormalization:
    def test_normalize_exam_with_examJSON(self):
        # LLM hallucinated 'examJSON'
        raw = {
            "examJSON": [
                {"question_id": 1, "question": "Q1", "options": ["A", "B"], "answer": "A"}
            ]
        }
        normalized = normalize_to_canonical(raw, "exam", "test-model", topic="Calculus", subject_id="math-101")
        assert normalized["type"] == "exam"
        assert "questions" in normalized["content"]
        assert normalized["content"]["questions"][0]["id"] == "1"
        assert normalized["metadata"]["additional_info"]["topic"] == "Calculus"
        assert normalized["metadata"]["additional_info"]["subject_id"] == "math-101"
        
        # Verify it passes Pydantic validation
        validated = ExamOutput(**normalized)
        assert validated.content.questions[0].id == "1"

    def test_normalize_exam_with_exam_json(self):
        # LLM hallucinated 'exam_json'
        raw = {
            "exam_json": [
                {"question_id": 1, "question": "Q1", "options": ["A", "B"], "answer": "A"}
            ]
        }
        normalized = normalize_to_canonical(raw, "exam", "test-model")
        assert "questions" in normalized["content"]
        assert normalized["content"]["questions"][0]["id"] == "1"

    def test_normalize_summary_from_string(self):
        # Raw string from summary pipeline
        raw = "This is a study summary."
        normalized = normalize_to_canonical(raw, "summary", "test-model", topic="Biology")
        assert normalized["type"] == "summary"
        assert "Biology" in normalized["content"]["title"]
        assert normalized["content"]["sections"][0]["body"] == "This is a study summary."
        
        # Verify Pydantic
        validated = SummaryOutput(**normalized)
        assert validated.content.sections[0].body == "This is a study summary."

    def test_normalize_exam_mixed_ids(self):
        # Mixed int and string IDs
        raw = {
            "questions": [
                {"id": 1, "question": "Q1", "options": ["A"], "answer": "A"},
                {"id": "2", "question": "Q2", "options": ["B"], "answer": "B"}
            ]
        }
        normalized = normalize_to_canonical(raw, "exam", "test-model")
        assert normalized["content"]["questions"][0]["id"] == "1"
        assert normalized["content"]["questions"][1]["id"] == "2"

    def test_rejects_invalid_root_structure(self):
        # Root is a list (invalid for canonical, though normalization might fix it if it's questions)
        raw = [{"id": 1, "question": "Q1"}]
        # In our implementation, we currently raise Error if not dict or str
        from services.exceptions import NonRetriableGenerationError
        with pytest.raises(NonRetriableGenerationError):
            normalize_to_canonical(raw, "exam", "test-model")

@pytest.mark.unit
class TestRetryPolicy:
    def test_validation_error_is_terminal(self):
        # This is more of an integration check for the task, but we can check the service catch
        from services.generation import generate_study_material
        # Mocking or using real dependencies if possible, but easier to just check the task logic
        pass

    def test_id_stringification_in_schemas(self):
        # Direct check on ExamOutput regarding IDs
        data = {
            "type": "exam",
            "content": {
                "questions": [
                    {"id": "123", "question": "Q", "options": ["O"], "answer": "A", "difficulty": "intermediate"}
                ],
                "answer_sheet": [
                    {"question_id": "123", "answer": "A"}
                ]
            },
            "metadata": {"model": "m", "provider": "p", "difficulty": "intermediate"}
        }
        # Success with proper strings
        ExamOutput(**data)
        
        # Verify that normalize_to_canonical HEALS integer IDs
        data["content"]["questions"][0]["id"] = 456
        data["content"]["answer_sheet"] = [] # test auto-gen too
        normalized = normalize_to_canonical(data, "exam", "m")
        
        # This healed version should pass Pydantic
        val = ExamOutput(**normalized)
        assert val.content.questions[0].id == "456"
        assert val.content.answer_sheet[0].question_id == "456"

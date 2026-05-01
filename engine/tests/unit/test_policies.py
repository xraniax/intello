"""
Unit tests for PolicyEngine.

All tests are pure Python — no I/O, no fixtures required.
"""
import json
import pytest
from services.policies import PolicyEngine, GenerationSegment
from services.schemas import GenerationPolicy, QuestionTypePreference


# ─── Helpers ──────────────────────────────────────────────────────────────────

def make_policy(total=10, difficulty="intermediate", distribution=None):
    if distribution is None:
        distribution = [QuestionTypePreference(type="mcq", percentage=100)]
    return GenerationPolicy(
        total_count=total,
        difficulty=difficulty,
        distribution=distribution,
    )


# ─── PolicyEngine.create_plan ─────────────────────────────────────────────────

@pytest.mark.unit
class TestCreatePlan:
    def test_single_type_fills_total_count(self):
        policy = make_policy(total=5)
        plan = PolicyEngine.create_plan(policy)
        total = sum(s.count for s in plan)
        assert total == 5

    def test_fixed_count_distribution(self):
        policy = make_policy(
            total=6,
            distribution=[
                QuestionTypePreference(type="mcq", count=4),
                QuestionTypePreference(type="essay", count=2),
            ],
        )
        plan = PolicyEngine.create_plan(policy)
        counts = {s.q_type: s.count for s in plan}
        assert counts.get("mcq", 0) == 4
        assert counts.get("essay", 0) == 2

    def test_percentage_distribution_allocates_proportionally(self):
        policy = make_policy(
            total=10,
            distribution=[
                QuestionTypePreference(type="mcq", percentage=50),
                QuestionTypePreference(type="fill_blank", percentage=50),
            ],
        )
        plan = PolicyEngine.create_plan(policy)
        total = sum(s.count for s in plan)
        assert total == 10

    def test_plan_assigns_difficulty_from_policy(self):
        policy = make_policy(total=3, difficulty="advanced")
        plan = PolicyEngine.create_plan(policy)
        for segment in plan:
            assert segment.difficulty == "advanced"

    def test_plan_assigns_id_ranges(self):
        policy = make_policy(total=5)
        plan = PolicyEngine.create_plan(policy)
        assert hasattr(plan[0], "id_range")
        start, end = plan[0].id_range
        assert end - start + 1 == plan[0].count

    def test_empty_remaining_does_not_panic(self):
        """Fixed counts exactly exhaust total — no leftover to allocate."""
        policy = make_policy(
            total=3,
            distribution=[QuestionTypePreference(type="mcq", count=3)],
        )
        plan = PolicyEngine.create_plan(policy)
        assert sum(s.count for s in plan) == 3


# ─── PolicyEngine.validate_segment ───────────────────────────────────────────

@pytest.mark.unit
class TestValidateSegment:
    def test_accepts_well_formed_questions(self):
        questions = [
            {"id": 1, "type": "mcq", "question": "What is 2+2?", "options": ["3", "4"], "answer": "4"},
            {"id": 2, "type": "mcq", "question": "Capital of France?", "options": ["London", "Paris"], "answer": "Paris"},
        ]
        result = PolicyEngine.validate_segment(questions, "mcq", "some context")
        assert len(result) == 2

    def test_rejects_non_dict_entries(self):
        result = PolicyEngine.validate_segment(["not-a-dict", 42], "mcq", "ctx")
        assert result == []

    def test_rejects_entries_without_question_field(self):
        questions = [{"id": 1, "type": "mcq"}]  # missing "question"
        result = PolicyEngine.validate_segment(questions, "mcq", "ctx")
        assert result == []

    def test_returns_empty_list_for_non_list_input(self):
        result = PolicyEngine.validate_segment({"not": "a list"}, "mcq", "ctx")
        assert result == []


# ─── PolicyEngine.final_semantic_check ───────────────────────────────────────

@pytest.mark.unit
class TestFinalSemanticCheck:
    def test_removes_duplicate_questions(self):
        questions = [
            {"question": "What is AI?"},
            {"question": "What is AI?"},  # duplicate
            {"question": "Define ML."},
        ]
        result = PolicyEngine.final_semantic_check(questions)
        assert len(result) == 2

    def test_deduplication_is_case_insensitive(self):
        questions = [
            {"question": "what is ai?"},
            {"question": "WHAT IS AI?"},
        ]
        result = PolicyEngine.final_semantic_check(questions)
        assert len(result) == 1

    def test_preserves_unique_questions(self):
        questions = [{"question": f"Question {i}?"} for i in range(5)]
        result = PolicyEngine.final_semantic_check(questions)
        assert len(result) == 5


# ─── PolicyEngine.repair_json_content ────────────────────────────────────────

@pytest.mark.unit
class TestRepairJsonContent:
    def test_strips_markdown_json_fences(self):
        raw = "```json\n[{\"id\":1}]\n```"
        result = PolicyEngine.repair_json_content(raw)
        parsed = json.loads(result)
        assert parsed[0]["id"] == 1

    def test_strips_plain_code_fences(self):
        raw = "```\n[{\"id\":2}]\n```"
        result = PolicyEngine.repair_json_content(raw)
        parsed = json.loads(result)
        assert parsed[0]["id"] == 2

    def test_wraps_bare_object_in_array(self):
        raw = '{"id":1,"question":"Q?"}'
        result = PolicyEngine.repair_json_content(raw)
        parsed = json.loads(result)
        assert isinstance(parsed, list)
        assert parsed[0]["id"] == 1

    def test_removes_single_line_comments(self):
        raw = '[{"id":1} // a comment\n]'
        result = PolicyEngine.repair_json_content(raw)
        # After comment removal the JSON should be parseable
        parsed = json.loads(result)
        assert len(parsed) == 1

    def test_valid_json_passes_through_unchanged(self):
        valid = '[{"id":1,"question":"Clean question"}]'
        result = PolicyEngine.repair_json_content(valid)
        assert json.loads(result)[0]["id"] == 1


# ─── GenerationSegment.to_dict ───────────────────────────────────────────────

@pytest.mark.unit
class TestGenerationSegment:
    def test_to_dict_returns_expected_structure(self):
        seg = GenerationSegment("mcq", 5, "intermediate")
        d = seg.to_dict()
        assert d == {"type": "mcq", "count": 5, "difficulty": "intermediate"}

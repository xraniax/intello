#!/usr/bin/env python3
"""Unit tests for summary prompt building logic.

Validates that:
- build_prompt produces difficulty-aware depth instructions
- _build_summary_system_prompt returns style-focused guidance
- Difficulty parameter flows correctly through function signatures
- No "AI report tone" phrases leak into prompts
"""

import os
import sys
import unittest

# Ensure engine root is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.generation import build_prompt, _build_summary_system_prompt


class TestSummaryPromptBuilding(unittest.TestCase):
    """Verify prompt construction for summary material type."""

    SAMPLE_CONTEXT = (
        "Machine learning is a subfield of artificial intelligence that focuses on "
        "algorithms which learn patterns from data. Supervised, unsupervised, and "
        "reinforcement learning are key paradigms."
    )

    # ----- System prompt tests -----

    def test_system_prompt_exists_and_is_style_focused(self):
        """System prompt should guide tone/style, not just formatting rules."""
        sp = _build_summary_system_prompt()
        self.assertIsInstance(sp, str)
        self.assertGreater(len(sp), 50)

        # Should encourage natural human voice
        self.assertIn("natural", sp.lower())
        # Should discourage AI report narration
        self.assertIn("This text discusses", sp)
        self.assertIn("The document covers", sp)

    def test_system_prompt_allows_dynamic_structure(self):
        """System prompt must NOT force paragraphs-only or bullets-only."""
        sp = _build_summary_system_prompt()
        # Should NOT contain rigid paragraph-only rules
        self.assertNotIn("Write only in natural prose paragraphs", sp)
        self.assertNotIn("Never use bullet points", sp)
        # Should allow flexible structure
        self.assertIn("paragraph", sp.lower())
        self.assertIn("bullet", sp.lower())

    def test_system_prompt_no_headers_or_bold(self):
        """Headers and bold formatting should still be discouraged."""
        sp = _build_summary_system_prompt()
        self.assertIn("header", sp.lower())

    # ----- Difficulty-aware depth tests -----

    def test_beginner_prompt_is_short_and_focused(self):
        """Beginner/introductory should focus on 2-3 main ideas only."""
        for diff in ("introductory", "beginner", "easy"):
            prompt = build_prompt("summary", self.SAMPLE_CONTEXT, None, "en", difficulty=diff)
            self.assertIn("2-3", prompt, f"Beginner prompt ({diff}) should mention 2-3 ideas")
            self.assertIn("short", prompt.lower(), f"Beginner prompt ({diff}) should mention short")

    def test_intermediate_prompt_is_balanced(self):
        """Intermediate should cover major concepts with compression."""
        prompt = build_prompt("summary", self.SAMPLE_CONTEXT, None, "en", difficulty="intermediate")
        self.assertIn("major concepts", prompt.lower())
        self.assertIn("compress", prompt.lower())

    def test_advanced_prompt_is_comprehensive(self):
        """Advanced should cover nearly all ideas with synthesis."""
        for diff in ("advanced", "hard"):
            prompt = build_prompt("summary", self.SAMPLE_CONTEXT, None, "en", difficulty=diff)
            self.assertIn("nearly all", prompt.lower(), f"Advanced prompt ({diff}) should cover nearly all")
            self.assertIn("nuance", prompt.lower(), f"Advanced prompt ({diff}) should mention nuances")

    def test_default_difficulty_is_intermediate(self):
        """Calling without difficulty should use intermediate."""
        prompt_default = build_prompt("summary", self.SAMPLE_CONTEXT, None, "en")
        prompt_explicit = build_prompt("summary", self.SAMPLE_CONTEXT, None, "en", difficulty="intermediate")
        self.assertEqual(prompt_default, prompt_explicit)

    # ----- Anti-AI-report-tone tests -----

    def test_prompt_discourages_meta_narration(self):
        """Prompts should explicitly discourage 'This document covers...' style."""
        prompt = build_prompt("summary", self.SAMPLE_CONTEXT, None, "en")
        self.assertIn("This document covers", prompt)  # present as a negative example
        self.assertIn("Never open with", prompt)

    def test_prompt_encourages_prioritization(self):
        """Prompts should explicitly ask for prioritization over exhaustive listing."""
        prompt = build_prompt("summary", self.SAMPLE_CONTEXT, None, "en")
        self.assertIn("prioritize", prompt.lower())

    def test_prompt_allows_dynamic_structure(self):
        """Prompt should not force one format throughout."""
        prompt = build_prompt("summary", self.SAMPLE_CONTEXT, None, "en")
        self.assertIn("Do NOT force everything into one format", prompt)

    # ----- Non-summary types unaffected -----

    def test_quiz_prompt_unaffected_by_difficulty_param(self):
        """Quiz prompt should still work and ignore summary difficulty logic."""
        prompt = build_prompt("quiz", self.SAMPLE_CONTEXT, None, "en", difficulty="introductory")
        # Quiz should still contain JSON structure, not summary instructions
        self.assertIn("quiz", prompt.lower())
        self.assertIn("JSON", prompt)

    def test_flashcards_prompt_unaffected(self):
        """Flashcards prompt should be unaffected by our changes."""
        prompt = build_prompt("flashcards", self.SAMPLE_CONTEXT, None, "en")
        self.assertIn("flashcard", prompt.lower())
        self.assertIn("JSON", prompt)

    # ----- Language support -----

    def test_non_english_language_phrase_included(self):
        """Non-English language should add a language instruction."""
        prompt = build_prompt("summary", self.SAMPLE_CONTEXT, None, "fr", difficulty="intermediate")
        self.assertIn("Write in fr", prompt)

    def test_english_no_extra_language_phrase(self):
        """English should not add a redundant language phrase."""
        prompt = build_prompt("summary", self.SAMPLE_CONTEXT, None, "en", difficulty="intermediate")
        self.assertNotIn("Write in en", prompt)

    # ----- Difficulty distinctness -----

    def test_all_three_difficulties_produce_different_prompts(self):
        """Beginner, intermediate, and advanced should produce meaningfully different prompts."""
        p_beginner = build_prompt("summary", self.SAMPLE_CONTEXT, None, "en", difficulty="introductory")
        p_inter = build_prompt("summary", self.SAMPLE_CONTEXT, None, "en", difficulty="intermediate")
        p_adv = build_prompt("summary", self.SAMPLE_CONTEXT, None, "en", difficulty="advanced")

        # All three should be different
        self.assertNotEqual(p_beginner, p_inter)
        self.assertNotEqual(p_inter, p_adv)
        self.assertNotEqual(p_beginner, p_adv)


class TestDifficultyParameterSignatures(unittest.TestCase):
    """Verify that difficulty parameter is accepted by all relevant functions."""

    def test_build_prompt_accepts_difficulty(self):
        """build_prompt should accept difficulty as a keyword argument."""
        import inspect
        sig = inspect.signature(build_prompt)
        self.assertIn("difficulty", sig.parameters)
        # Default should be "intermediate"
        self.assertEqual(sig.parameters["difficulty"].default, "intermediate")

    def test_generate_study_material_accepts_difficulty(self):
        """generate_study_material should accept difficulty as a keyword argument."""
        import inspect
        from services.generation import generate_study_material
        sig = inspect.signature(generate_study_material)
        self.assertIn("difficulty", sig.parameters)
        self.assertEqual(sig.parameters["difficulty"].default, "intermediate")

    def test_generate_study_material_stream_accepts_difficulty(self):
        """generate_study_material_stream should accept difficulty as a keyword argument."""
        import inspect
        from services.generation import generate_study_material_stream
        sig = inspect.signature(generate_study_material_stream)
        self.assertIn("difficulty", sig.parameters)
        self.assertEqual(sig.parameters["difficulty"].default, "intermediate")


if __name__ == "__main__":
    unittest.main(verbosity=2)

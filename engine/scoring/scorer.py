"""
Main exam scorer implementation.

Integrates all scoring components:
    - Semantic similarity (Sentence-BERT)
    - Concept coverage detection
    - Keyword/terminology scoring
    - Anti-cheating analysis
    - Feedback generation

Provides deterministic, explainable, and fair grading for short-answer exam questions.
"""

import logging
from typing import Optional, Dict, Any, List

from .schemas import ExamRubric, StudentAnswer, ExamScoreResult, ScoreScale
from .core.similarity import semantic_similarity_score
from .core.concepts import evaluate_concept_coverage
from .core.keywords import calculate_keyword_score, detect_keyword_stuffing
from .utils.anti_cheating import analyze_answer_quality, calculate_anti_cheating_penalty
from .utils.feedback import (
    generate_student_feedback,
    generate_teacher_explanation,
    format_score_for_scale,
    FeedbackComponents
)

logger = logging.getLogger("engine.scoring")


class ExamScorer:
    """
    Production-ready exam scorer for short textual answers.
    
    Uses a multi-component scoring approach:
        1. Semantic similarity (40%): How well answer aligns with reference
        2. Concept coverage (40%): Presence of required concepts
        3. Keyword/terminology (20%): Use of important technical terms
    
    Anti-cheating measures:
        - Keyword stuffing detection
        - Irrelevant verbose text detection
        - Copied reference detection
        - Gibberish detection
    
    Example:
        scorer = ExamScorer()
        result = scorer.score(student_answer, rubric)
        print(result.final_score)  # Score on rubric's scale
        print(result.feedback)       # Student feedback
    """

    def __init__(
        self,
        semantic_threshold: float = 0.65,
        concept_semantic_threshold: float = 0.65,
        anti_cheating_max_penalty: float = 0.5
    ):
        """
        Initialize the exam scorer.
        
        Args:
            semantic_threshold: Minimum similarity for concept detection
            concept_semantic_threshold: Threshold for semantic concept detection
            anti_cheating_max_penalty: Max score penalty for cheating
        """
        self.semantic_threshold = semantic_threshold
        self.concept_semantic_threshold = concept_semantic_threshold
        self.anti_cheating_max_penalty = anti_cheating_max_penalty
        
        logger.info("ExamScorer initialized")

    def score(
        self,
        student_answer: StudentAnswer,
        rubric: ExamRubric
    ) -> ExamScoreResult:
        """
        Score a student answer against a rubric.
        
        This is the main entry point for exam scoring.
        
        Args:
            student_answer: Student's submitted answer
            rubric: Grading rubric with reference answer and criteria
            
        Returns:
            ExamScoreResult with all scores and feedback
        """
        logger.info(
            f"Scoring answer from student={student_answer.student_id} "
            f"for question={rubric.question_id}"
        )
        
        answer_text = student_answer.answer_text
        reference = rubric.reference_answer
        
        # Anti-cheating analysis (run first to inform scoring)
        anti_cheating_report = self._run_anti_cheating_analysis(
            answer_text, reference, rubric
        )
        
        # 1. Semantic similarity scoring
        raw_semantic_score = self._calculate_semantic_score(answer_text, reference)
        
        # 2. Concept coverage scoring
        concept_score, present_concepts, missing_concepts = self._calculate_concept_score(
            answer_text, rubric
        )
        
        # 3. Keyword/terminology scoring
        keyword_result = self._calculate_keyword_score(answer_text, rubric)
        keyword_score = keyword_result.score
        
        # Soft coupling: semantic score weighted by concept coverage
        # Prevents "fluent but empty" answers from high scores
        concept_coverage_ratio = len(present_concepts) / len(rubric.concepts) if rubric.concepts else 0
        semantic_score = raw_semantic_score * (0.6 + 0.4 * concept_coverage_ratio)
        
        # Combine component scores
        weights = rubric.weights
        combined_score = (
            semantic_score * weights["semantic"] +
            concept_score * weights["concept"] +
            keyword_score * weights["keyword"]
        )
        
        # Apply anti-cheating penalties
        final_normalized_score = calculate_anti_cheating_penalty(
            anti_cheating_report,
            combined_score,
            self.anti_cheating_max_penalty
        )
        
        # Convert to rubric's scale
        final_score = format_score_for_scale(
            final_normalized_score,
            rubric.score_scale.value
        )
        
        # Generate feedback
        components = FeedbackComponents(
            semantic_score=semantic_score,
            concept_score=concept_score,
            keyword_score=keyword_score,
            present_concepts=present_concepts,
            missing_concepts=missing_concepts,
            found_keywords=keyword_result.found_keywords,
            missing_keywords=keyword_result.missing_keywords,
            warnings=anti_cheating_report.warnings + keyword_result.warnings,
            answer_length=len(answer_text.split())
        )
        
        feedback = generate_student_feedback(components)
        explanation = generate_teacher_explanation(
            components,
            {"question_id": rubric.question_id},
            anti_cheating_report.details
        )
        
        # Build component breakdown
        component_breakdown = {
            "semantic": {
                "score": round(semantic_score, 3),
                "weight": weights["semantic"],
                "weighted_contribution": round(semantic_score * weights["semantic"], 3)
            },
            "concept": {
                "score": round(concept_score, 3),
                "detected": present_concepts,
                "missing": missing_concepts,
                "weight": weights["concept"],
                "weighted_contribution": round(concept_score * weights["concept"], 3)
            },
            "keyword": {
                "score": round(keyword_score, 3),
                "found": keyword_result.found_keywords,
                "missing": keyword_result.missing_keywords,
                "weight": weights["keyword"],
                "weighted_contribution": round(keyword_score * weights["keyword"], 3)
            },
            "anti_cheating": {
                "suspicion_score": round(anti_cheating_report.suspicion_score, 3),
                "is_suspicious": anti_cheating_report.is_suspicious,
                "findings": anti_cheating_report.details
            },
            "raw_combined_score": round(combined_score, 3),
            "penalty_applied": round(combined_score - final_normalized_score, 3)
        }
        
        result = ExamScoreResult(
            semantic_score=round(semantic_score, 3),
            concept_score=round(concept_score, 3),
            keyword_score=round(keyword_score, 3),
            final_score=final_score,
            normalized_score=round(final_normalized_score, 3),
            missing_concepts=missing_concepts,
            present_concepts=present_concepts,
            found_keywords=keyword_result.found_keywords,
            missing_keywords=keyword_result.missing_keywords,
            feedback=feedback,
            grading_explanation=explanation,
            warnings=anti_cheating_report.warnings,
            component_breakdown=component_breakdown
        )
        
        logger.info(
            f"Scoring complete: final={final_score:.2f} "
            f"(semantic={semantic_score:.2f}, concept={concept_score:.2f}, "
            f"keyword={keyword_score:.2f})"
        )
        
        return result

    def _calculate_semantic_score(self, answer: str, reference: str) -> float:
        """Calculate semantic similarity score."""
        score, _, _ = semantic_similarity_score(answer, reference)
        return score

    def _calculate_concept_score(
        self,
        answer: str,
        rubric: ExamRubric
    ) -> tuple[float, List[str], List[str]]:
        """Calculate concept coverage score."""
        if not rubric.concepts:
            return 1.0, [], []
        
        # Convert ConceptDefinition objects to dicts
        concept_dicts = [
            {
                "name": c.name,
                "description": c.description,
                "keywords": c.keywords,
                "weight": c.weight,
                "required": c.required
            }
            for c in rubric.concepts
        ]
        
        coverage, results, present, missing = evaluate_concept_coverage(
            answer,
            concept_dicts,
            semantic_threshold=self.concept_semantic_threshold
        )
        
        return coverage, present, missing

    def _calculate_keyword_score(
        self,
        answer: str,
        rubric: ExamRubric
    ):
        """Calculate keyword/terminology score."""
        if not rubric.important_keywords:
            # Return default result with score 1.0
            from .core.keywords import KeywordScoreResult
            return KeywordScoreResult(
                score=1.0,
                matches=[],
                found_keywords=[],
                missing_keywords=[],
                coverage_ratio=1.0,
                density_score=1.0,
                warnings=[]
            )
        
        return calculate_keyword_score(
            answer,
            rubric.important_keywords,
            rubric.keyword_weights
        )

    def _run_anti_cheating_analysis(
        self,
        answer: str,
        reference: str,
        rubric: ExamRubric
    ):
        """Run comprehensive anti-cheating analysis."""
        concept_names = [c.name for c in rubric.concepts]
        
        return analyze_answer_quality(
            answer,
            reference,
            rubric.important_keywords,
            concept_names
        )

    def batch_score(
        self,
        student_answers: List[StudentAnswer],
        rubrics: List[ExamRubric]
    ) -> List[ExamScoreResult]:
        """
        Score multiple answers efficiently.
        
        Args:
            student_answers: List of student answers
            rubrics: List of corresponding rubrics (must match length)
            
        Returns:
            List of ExamScoreResults
        """
        if len(student_answers) != len(rubrics):
            raise ValueError("student_answers and rubrics must have same length")
        
        results: List[ExamScoreResult] = []
        for answer, rubric in zip(student_answers, rubrics):
            result = self.score(answer, rubric)
            results.append(result)
        
        return results

    def explain_score(
        self,
        result: ExamScoreResult,
        detail_level: str = "standard"
    ) -> str:
        """
        Generate human-readable score explanation.
        
        Args:
            result: ExamScoreResult to explain
            detail_level: "brief", "standard", or "detailed"
            
        Returns:
            Human-readable explanation
        """
        if detail_level == "brief":
            return (
                f"Score: {result.final_score:.1f}/5. "
                f"{result.feedback[:100]}..."
            )
        
        elif detail_level == "detailed":
            lines = [
                "=== EXAM SCORE BREAKDOWN ===",
                f"Final Score: {result.final_score:.2f} (normalized: {result.normalized_score:.3f})",
                "",
                "Component Scores:",
                f"  - Semantic Similarity: {result.semantic_score:.3f}",
                f"  - Concept Coverage:    {result.concept_score:.3f}",
                f"  - Keyword Usage:       {result.keyword_score:.3f}",
                "",
                f"Detected Concepts: {', '.join(result.present_concepts) or 'None'}",
                f"Missing Concepts:  {', '.join(result.missing_concepts) or 'None'}",
                "",
                f"Found Keywords:    {', '.join(result.found_keywords) or 'None'}",
                f"Missing Keywords:  {', '.join(result.missing_keywords) or 'None'}",
                "",
                "Student Feedback:",
                f"  {result.feedback}",
                "",
                "Grading Explanation:",
                f"  {result.grading_explanation}",
            ]
            
            if result.warnings:
                lines.extend([
                    "",
                    "Warnings:",
                    *[f"  - {w}" for w in result.warnings]
                ])
            
            return "\n".join(lines)
        
        else:  # standard
            return result.grading_explanation

"""
Feedback generation utilities for exam scoring.

Generates educational, actionable feedback for students and
detailed explanations for teachers.
"""

import logging
from typing import List, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger("engine.scoring.feedback")


@dataclass
class FeedbackComponents:
    """Components for building feedback."""
    semantic_score: float
    concept_score: float
    keyword_score: float
    present_concepts: List[str]
    missing_concepts: List[str]
    found_keywords: List[str]
    missing_keywords: List[str]
    warnings: List[str]
    answer_length: int


def generate_student_feedback(components: FeedbackComponents) -> str:
    """
    Generate student-facing feedback.
    
    Focuses on:
        - Encouragement and constructive criticism
        - Specific areas for improvement
        - Actionable advice
    
    Args:
        components: FeedbackComponents with scoring details
        
    Returns:
        Student-friendly feedback string
    """
    feedback_parts: List[str] = []
    
    # Overall assessment
    avg_score = (
        components.semantic_score +
        components.concept_score +
        components.keyword_score
    ) / 3
    
    if avg_score >= 0.85:
        feedback_parts.append("Excellent work! Your answer demonstrates strong understanding.")
    elif avg_score >= 0.70:
        feedback_parts.append("Good job! Your answer covers the main points well.")
    elif avg_score >= 0.50:
        feedback_parts.append("Your answer shows partial understanding, but there's room for improvement.")
    else:
        feedback_parts.append("Your answer needs more development to fully address the question.")
    
    # Concept feedback
    if components.present_concepts:
        if len(components.present_concepts) == 1:
            feedback_parts.append(
                f"You correctly identified: {components.present_concepts[0]}."
            )
        else:
            concepts_str = ", ".join(components.present_concepts[:3])
            feedback_parts.append(f"Strong points in your answer: {concepts_str}.")
    
    # Missing concepts (educational hints)
    if components.missing_concepts:
        if len(components.missing_concepts) == 1:
            feedback_parts.append(
                f"Consider also discussing: {components.missing_concepts[0]}."
            )
        else:
            missing_str = ", ".join(components.missing_concepts[:2])
            feedback_parts.append(
                f"To strengthen your answer, consider addressing: {missing_str}."
            )
    
    # Keyword/terminology feedback
    if components.missing_keywords and components.keyword_score < 0.5:
        if len(components.missing_keywords) <= 2:
            feedback_parts.append(
                f"Include key terminology such as: {', '.join(components.missing_keywords[:2])}."
            )
    
    # Warnings (subtle hints, not accusations)
    if components.warnings:
        # Filter to give subtle hints without explicit cheating warnings
        length_warnings = [w for w in components.warnings if "length" in w.lower()]
        if length_warnings:
            feedback_parts.append(
                "Focus on concise, relevant content that directly addresses the question."
            )
    
    return " ".join(feedback_parts)


def generate_teacher_explanation(
    components: FeedbackComponents,
    rubric_info: Dict[str, Any],
    anti_cheating_details: Dict
) -> str:
    """
    Generate detailed explanation for teachers/auditors.
    
    Provides:
        - Clear scoring rationale
        - Component breakdown
        - Anti-cheating findings
        - Audit trail information
    
    Args:
        components: FeedbackComponents
        rubric_info: Dict with rubric details
        anti_cheating_details: Anti-cheating analysis details
        
    Returns:
        Detailed explanation for audit purposes
    """
    explanation_parts: List[str] = []
    
    # Component scores
    explanation_parts.append(
        f"Scoring breakdown: "
        f"Semantic={components.semantic_score:.2f}, "
        f"Concept={components.concept_score:.2f}, "
        f"Keyword={components.keyword_score:.2f}."
    )
    
    # Concepts analysis
    total_concepts = len(components.present_concepts) + len(components.missing_concepts)
    if total_concepts > 0:
        coverage_pct = len(components.present_concepts) / total_concepts * 100
        explanation_parts.append(
            f"Concept coverage: {len(components.present_concepts)}/{total_concepts} "
            f"({coverage_pct:.0f}%)."
        )
        
        if components.present_concepts:
            explanation_parts.append(
                f"Detected concepts: {', '.join(components.present_concepts)}."
            )
        if components.missing_concepts:
            explanation_parts.append(
                f"Missing concepts: {', '.join(components.missing_concepts)}."
            )
    
    # Keyword analysis
    total_keywords = len(components.found_keywords) + len(components.missing_keywords)
    if total_keywords > 0:
        keyword_pct = len(components.found_keywords) / total_keywords * 100
        explanation_parts.append(
            f"Terminology coverage: {len(components.found_keywords)}/{total_keywords} "
            f"keywords ({keyword_pct:.0f}%)."
        )
    
    # Anti-cheating findings
    if anti_cheating_details:
        copied = anti_cheating_details.get("copied_reference", {}).get("detected", False)
        if copied:
            sim = anti_cheating_details.get("copied_reference", {}).get("similarity", 0)
            explanation_parts.append(
                f"WARNING: Potential copying from reference (similarity: {sim:.2f})."
            )
        
        gibberish = anti_cheating_details.get("gibberish", {}).get("detected", False)
        if gibberish:
            explanation_parts.append("WARNING: Possible gibberish or nonsense content detected.")
        
        verbose = anti_cheating_details.get("verbose_padding", {}).get("detected", False)
        if verbose:
            explanation_parts.append("NOTE: Irrelevant verbose text detected.")
        
        off_topic = anti_cheating_details.get("off_topic", {}).get("detected", False)
        if off_topic:
            explanation_parts.append("NOTE: Answer may be off-topic.")
    
    # Length info
    explanation_parts.append(f"Answer length: {components.answer_length} words.")
    
    return " ".join(explanation_parts)


def format_score_for_scale(score: float, scale: str) -> float:
    """
    Convert normalized score (0.0-1.0) to target scale.
    
    Args:
        score: Normalized score 0.0-1.0
        scale: Target scale ("0-5", "0-100", "0-1")
        
    Returns:
        Score on target scale
    """
    if scale == "0-5":
        return round(score * 5, 2)
    elif scale == "0-100":
        return round(score * 100, 1)
    elif scale == "0-1":
        return round(score, 3)
    else:
        return round(score * 5, 2)  # Default to 0-5


def generate_improvement_suggestions(
    missing_concepts: List[str],
    missing_keywords: List[str],
    concept_descriptions: Dict[str, str]
) -> List[Dict[str, str]]:
    """
    Generate specific improvement suggestions.
    
    Args:
        missing_concepts: List of missing concept names
        missing_keywords: List of missing keywords
        concept_descriptions: Dict mapping concept name to description
        
    Returns:
        List of suggestion dicts with concept and suggestion text
    """
    suggestions: List[Dict[str, str]] = []
    
    for concept in missing_concepts[:3]:  # Top 3
        description = concept_descriptions.get(concept, "")
        if description:
            suggestions.append({
                "concept": concept,
                "suggestion": f"Include discussion of {concept}: {description}"
            })
        else:
            suggestions.append({
                "concept": concept,
                "suggestion": f"Address the concept of {concept} in your answer"
            })
    
    if missing_keywords:
        suggestions.append({
            "concept": "terminology",
            "suggestion": f"Use key terms: {', '.join(missing_keywords[:5])}"
        })
    
    return suggestions

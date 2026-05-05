"""
Utility modules for exam scoring.
"""

from .anti_cheating import (
    AntiCheatingReport,
    detect_irrelevant_verbose_text,
    detect_copied_reference,
    detect_gibberish,
    detect_off_topic_content,
    analyze_answer_quality,
    calculate_anti_cheating_penalty,
)
from .feedback import (
    FeedbackComponents,
    generate_student_feedback,
    generate_teacher_explanation,
    format_score_for_scale,
    generate_improvement_suggestions,
)

__all__ = [
    # Anti-cheating
    "AntiCheatingReport",
    "detect_irrelevant_verbose_text",
    "detect_copied_reference",
    "detect_gibberish",
    "detect_off_topic_content",
    "analyze_answer_quality",
    "calculate_anti_cheating_penalty",
    # Feedback
    "FeedbackComponents",
    "generate_student_feedback",
    "generate_teacher_explanation",
    "format_score_for_scale",
    "generate_improvement_suggestions",
]

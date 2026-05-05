"""
Adaptive learning integration - simple gap extraction.

Extracts learning gaps from scoring results for downstream recommendation system.
"""

from typing import Dict, Any, List

from scoring.schemas import ExamScoreResult


def extract_learning_gaps(
    score_result: ExamScoreResult,
    rubric_concepts: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Extract learning gaps from a scoring result.
    
    Simple function that identifies what the student missed and
    returns structured data for the adaptive learning system.
    
    Args:
        score_result: Result from ExamScorer
        rubric_concepts: Concepts from the rubric (as dicts)
    
    Returns:
        Dict with missing concepts, strengths, and simple recommendations
    """
    missing = score_result.missing_concepts
    present = score_result.present_concepts
    
    # Build concept lookup
    concept_map = {c["name"]: c for c in rubric_concepts}
    
    # Identify weak areas (required concepts that were missed)
    weak_areas = []
    for m in missing:
        if m in concept_map and concept_map[m].get("required", True):
            concept_data = concept_map[m]
            weak_areas.append({
                "concept": m,
                "weight": concept_data.get("weight", 1.0),
                "is_critical": concept_data.get("weight", 1.0) >= 1.5,
                "explanation": concept_data.get("description", "")[:120]  # Short explanation
            })
    
    # Identify strengths (present high-weight concepts)
    strengths = []
    for p in present:
        if p in concept_map and concept_map[p].get("weight", 1.0) >= 1.0:
            concept_data = concept_map[p]
            strengths.append({
                "concept": p,
                "weight": concept_data.get("weight", 1.0),
                "explanation": concept_data.get("description", "")[:120]
            })
    
    # Simple recommendation with explanations
    if weak_areas:
        critical = [w for w in weak_areas if w["is_critical"]]
        if critical:
            first = critical[0]
            recommendation = f"Priority: Study '{first['concept']}' — {first['explanation']}"
        else:
            first = weak_areas[0]
            recommendation = f"Review: {first['concept']} — {first['explanation']}"
    else:
        recommendation = "Good understanding demonstrated"
    
    return {
        "missing_concepts": missing,
        "present_concepts": present,
        "weak_areas": weak_areas,
        "strengths": strengths,
        "recommendation": recommendation,
        "overall_score": score_result.final_score,
        "semantic_score": score_result.semantic_score,
        "concept_score": score_result.concept_score,
        "requires_review": len(weak_areas) > 0
    }

"""
Feedback generation for educational assessment.
"""
import logging
import time
from typing import List, Dict, Optional

from .models import ScoringResult, ComponentScore

logger = logging.getLogger("scoring-feedback")


class FeedbackGenerator:
    """Generates personalized feedback for student answers."""
    
    def __init__(self):
        # Feedback templates for different score ranges
        self.templates = {
            "excellent": [
                "Excellent work! Your answer demonstrates strong understanding of the key concepts.",
                "Outstanding response! You've effectively covered all the important aspects.",
                "Perfect! Your answer shows comprehensive knowledge and clear understanding."
            ],
            "good": [
                "Good work! Your answer covers most important concepts with some room for improvement.",
                "Well done! You've demonstrated solid understanding with minor gaps.",
                "Nice work! Your answer is mostly correct and shows good comprehension."
            ],
            "adequate": [
                "Adequate response. You've covered some key concepts but missed others.",
                "Your answer is on the right track but needs more detail and accuracy.",
                "Fair attempt. Consider reviewing the missing concepts mentioned above."
            ],
            "needs_improvement": [
                "Your answer needs significant improvement. Please review the key concepts.",
                "This response lacks the necessary detail and accuracy. Consider studying the material again.",
                "Your answer misses several important concepts. Additional review is recommended."
            ]
        }
        
        # Component-specific feedback templates
        self.component_feedback = {
            "semantic_similarity": {
                "low": "Your answer differs significantly from the expected response in meaning and content.",
                "medium": "Your answer shares some similarity with the expected response but could be more aligned.",
                "high": "Your answer closely matches the expected meaning and content."
            },
            "concept_coverage": {
                "low": "You missed several important concepts in your answer.",
                "medium": "You covered some key concepts but missed others that are important.",
                "high": "You effectively covered the important concepts in this topic."
            },
            "keyword_matching": {
                "low": "Your answer lacks many of the key terms and vocabulary for this topic.",
                "medium": "You included some key terms but missed others that would strengthen your answer.",
                "high": "You effectively used the key terminology appropriate for this topic."
            }
        }
    
    def generate_feedback(
        self,
        scoring_result: ScoringResult,
        component_scores: List[ComponentScore],
        *,
        request_id: Optional[str] = None
    ) -> str:
        """
        Generate comprehensive feedback for a student's answer.
        
        Args:
            scoring_result: Complete scoring result
            component_scores: Individual component scores
            request_id: Optional request ID for logging
            
        Returns:
            Generated feedback string
        """
        start_time = time.time()
        
        feedback_parts = []
        
        # Add overall assessment
        overall_feedback = self._generate_overall_feedback(scoring_result.final_score)
        feedback_parts.append(overall_feedback)
        
        # Add component-specific feedback
        component_feedback = self._generate_component_feedback(component_scores)
        if component_feedback:
            feedback_parts.append(component_feedback)
        
        # Add specific suggestions based on missing elements
        suggestions = self._generate_suggestions(scoring_result)
        if suggestions:
            feedback_parts.append(suggestions)
        
        # Add positive reinforcement for good elements
        positive_feedback = self._generate_positive_feedback(scoring_result, component_scores)
        if positive_feedback:
            feedback_parts.append(positive_feedback)
        
        # Combine all feedback parts
        final_feedback = "\n\n".join(feedback_parts)
        
        processing_time = (time.time() - start_time) * 1000
        logger.debug(f"Generated feedback in {processing_time:.1f}ms")
        
        return final_feedback
    
    def _generate_overall_feedback(self, score: float) -> str:
        """Generate overall assessment based on final score."""
        if score >= 0.9:
            category = "excellent"
        elif score >= 0.7:
            category = "good"
        elif score >= 0.5:
            category = "adequate"
        else:
            category = "needs_improvement"
        
        import random
        return random.choice(self.templates[category])
    
    def _generate_component_feedback(self, component_scores: List[ComponentScore]) -> str:
        """Generate feedback for individual scoring components."""
        feedback_parts = []
        
        for component in component_scores:
            method_name = component.method.value
            score = component.score
            
            if method_name in self.component_feedback:
                if score < 0.5:
                    level = "low"
                elif score < 0.8:
                    level = "medium"
                else:
                    level = "high"
                
                feedback = self.component_feedback[method_name][level]
                feedback_parts.append(feedback)
        
        if feedback_parts:
            return "Specific areas:\n" + "\n".join(f"• {part}" for part in feedback_parts)
        
        return ""
    
    def _generate_suggestions(self, scoring_result: ScoringResult) -> str:
        """Generate specific suggestions for improvement."""
        suggestions = []
        
        # Suggestions based on missing concepts
        if scoring_result.missing_concepts:
            concept_list = ", ".join(scoring_result.missing_concepts[:3])  # Limit to top 3
            if len(scoring_result.missing_concepts) > 3:
                concept_list += f" and {len(scoring_result.missing_concepts) - 3} others"
            suggestions.append(f"Focus on understanding: {concept_list}")
        
        # Suggestions based on low component scores
        if scoring_result.final_score < 0.6:
            suggestions.append("Review the core concepts and try to include more specific details in your answer.")
            suggestions.append("Consider using the key terminology associated with this topic.")
        
        # Suggestions based on answer length (very short answers)
        if len(scoring_result.student_answer.split()) < 10:
            suggestions.append("Your answer is quite brief. Try to provide more detailed explanations.")
        
        if suggestions:
            return "Suggestions for improvement:\n" + "\n".join(f"• {suggestion}" for suggestion in suggestions)
        
        return ""
    
    def _generate_positive_feedback(
        self, 
        scoring_result: ScoringResult, 
        component_scores: List[ComponentScore]
    ) -> str:
        """Generate positive reinforcement for good performance."""
        positives = []
        
        # Praise for covered concepts
        if scoring_result.concepts_covered:
            positives.append(f"You correctly identified: {', '.join(scoring_result.concepts_covered[:3])}")
        
        # Praise for matched keywords
        if scoring_result.keywords_matched:
            positives.append(f"Good use of key terms: {', '.join(scoring_result.keywords_matched[:3])}")
        
        # Praise for high-scoring components
        high_components = [c for c in component_scores if c.score >= 0.8]
        if high_components:
            component_names = [c.method.value.replace("_", " ").title() for c in high_components]
            positives.append(f"Strong performance in: {', '.join(component_names)}")
        
        if positives and scoring_result.final_score >= 0.6:
            return "What you did well:\n" + "\n".join(f"• {positive}" for positive in positives)
        
        return ""
    
    def generate_grade(self, score: float) -> str:
        """Convert numeric score to letter grade."""
        if score >= 0.9:
            return "A"
        elif score >= 0.8:
            return "B"
        elif score >= 0.7:
            return "C"
        elif score >= 0.6:
            return "D"
        else:
            return "F"
    
    def generate_pass_fail(self, score: float, passing_threshold: float = 0.7) -> str:
        """Generate pass/fail designation."""
        return "PASS" if score >= passing_threshold else "FAIL"
    
    def generate_detailed_feedback_report(
        self,
        scoring_result: ScoringResult,
        component_scores: List[ComponentScore],
        *,
        request_id: Optional[str] = None
    ) -> Dict:
        """
        Generate a comprehensive feedback report with multiple sections.
        
        Args:
            scoring_result: Complete scoring result
            component_scores: Individual component scores
            request_id: Optional request ID for logging
            
        Returns:
            Dictionary with structured feedback report
        """
        return {
            "overall_assessment": self._generate_overall_feedback(scoring_result.final_score),
            "grade": self.generate_grade(scoring_result.final_score),
            "score_breakdown": {
                "final_score": scoring_result.final_score,
                "components": [
                    {
                        "name": component.method.value.replace("_", " ").title(),
                        "score": component.score,
                        "weight": component.weight,
                        "weighted_score": component.weighted_score,
                        "feedback": self.component_feedback.get(component.method.value, {}).get(
                            "high" if component.score >= 0.8 else 
                            "medium" if component.score >= 0.5 else "low", ""
                        )
                    }
                    for component in component_scores
                ]
            },
            "strengths": self._extract_strengths(scoring_result, component_scores),
            "areas_for_improvement": self._extract_improvement_areas(scoring_result, component_scores),
            "specific_suggestions": self._generate_suggestions(scoring_result),
            "concepts_analysis": {
                "covered": scoring_result.concepts_covered,
                "missing": scoring_result.missing_concepts,
                "total_concepts": len(scoring_result.concepts_covered) + len(scoring_result.missing_concepts)
            },
            "keyword_analysis": {
                "matched": scoring_result.keywords_matched,
                "total_keywords": len(scoring_result.keywords_matched)
            }
        }
    
    def _extract_strengths(
        self, 
        scoring_result: ScoringResult, 
        component_scores: List[ComponentScore]
    ) -> List[str]:
        """Extract specific strengths from the scoring results."""
        strengths = []
        
        # High-scoring components
        for component in component_scores:
            if component.score >= 0.8:
                strengths.append(f"Strong {component.method.value.replace('_', ' ')}")
        
        # Well-covered concepts
        if len(scoring_result.concepts_covered) >= 3:
            strengths.append("Comprehensive concept coverage")
        
        # Good keyword usage
        if len(scoring_result.keywords_matched) >= 5:
            strengths.append("Effective use of key terminology")
        
        return strengths
    
    def _extract_improvement_areas(
        self, 
        scoring_result: ScoringResult, 
        component_scores: List[ComponentScore]
    ) -> List[str]:
        """Extract specific areas needing improvement."""
        improvements = []
        
        # Low-scoring components
        for component in component_scores:
            if component.score < 0.5:
                improvements.append(f"Improve {component.method.value.replace('_', ' ')}")
        
        # Missing concepts
        if scoring_result.missing_concepts:
            improvements.append("Cover more key concepts")
        
        # Missing keywords
        if len(scoring_result.keywords_matched) < 3:
            improvements.append("Include more relevant keywords")
        
        return improvements

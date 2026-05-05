"""
Robust scoring formula for educational short-answer grading.
"""
import logging
import math
from typing import Dict, List, Optional, Tuple

import numpy as np

from .models import ScoringConfig, ComponentScore
from .utils import normalize_score, apply_threshold_normalization

logger = logging.getLogger("scoring-formula")


class ScoringFormula:
    """
    Robust scoring formula that combines semantic similarity, concept coverage,
    and keyword matching with adaptive weighting and validation.
    """
    
    def __init__(self, config: ScoringConfig):
        self.config = config
        self._validate_formula_parameters()
    
    def calculate_final_score(
        self,
        semantic_score: float,
        concept_score: float,
        keyword_score: float,
        answer_length: Optional[int] = None,
        reference_length: Optional[int] = None
    ) -> float:
        """
        Calculate final weighted score with adaptive adjustments.
        
        Args:
            semantic_score: Semantic similarity score (0-1)
            concept_score: Concept coverage score (0-1)
            keyword_score: Keyword matching score (0-1)
            answer_length: Length of student answer (for length adjustment)
            reference_length: Length of reference answer (for length adjustment)
            
        Returns:
            Final weighted score (0-1)
        """
        # Apply threshold normalization to each component
        normalized_semantic = apply_threshold_normalization(
            semantic_score, self.config.semantic_threshold
        )
        normalized_concept = apply_threshold_normalization(
            concept_score, self.config.concept_threshold
        )
        normalized_keyword = apply_threshold_normalization(
            keyword_score, self.config.keyword_threshold
        )
        
        # Apply length-based adjustment
        length_multiplier = self._calculate_length_multiplier(
            answer_length, reference_length
        )
        
        # Calculate weighted base score
        base_score = (
            normalized_semantic * self.config.semantic_weight +
            normalized_concept * self.config.concept_weight +
            normalized_keyword * self.config.keyword_weight
        )
        
        # Apply consistency validation
        consistency_multiplier = self._calculate_consistency_multiplier(
            semantic_score, concept_score, keyword_score
        )
        
        # Apply length adjustment
        adjusted_score = base_score * length_multiplier * consistency_multiplier
        
        final_score = normalize_score(adjusted_score)
        
        logger.debug(
            f"Score calculation: semantic={semantic_score:.3f}→{normalized_semantic:.3f}, "
            f"concept={concept_score:.3f}→{normalized_concept:.3f}, "
            f"keyword={keyword_score:.3f}→{normalized_keyword:.3f}, "
            f"base={base_score:.3f}, length_mult={length_multiplier:.3f}, "
            f"consistency_mult={consistency_multiplier:.3f}, final={final_score:.3f}"
        )
        
        return final_score
    
    def _calculate_length_multiplier(
        self, 
        answer_length: Optional[int], 
        reference_length: Optional[int]
    ) -> float:
        """
        Calculate length-based adjustment multiplier.
        
        Penalizes very short answers and slightly rewards comprehensive answers.
        """
        if answer_length is None or reference_length is None:
            return 1.0
        
        # Calculate length ratio
        length_ratio = answer_length / max(1, reference_length)
        
        # Apply length adjustment
        if length_ratio < 0.3:
            # Very short answers - significant penalty
            return 0.7
        elif length_ratio < 0.6:
            # Short answers - moderate penalty
            return 0.85
        elif length_ratio > 2.0:
            # Very long answers - slight penalty (might be rambling)
            return 0.95
        elif length_ratio > 1.2:
            # Comprehensive answers - slight bonus
            return 1.05
        else:
            # Good length - no adjustment
            return 1.0
    
    def _calculate_consistency_multiplier(
        self,
        semantic_score: float,
        concept_score: float,
        keyword_score: float
    ) -> float:
        """
        Calculate consistency adjustment multiplier.
        
        Reduces score if components show inconsistent patterns.
        """
        # Check for logical inconsistencies
        inconsistencies = 0
        
        # High semantic but low concept coverage is suspicious
        if semantic_score > 0.8 and concept_score < 0.3:
            inconsistencies += 1
            logger.debug("Inconsistency: high semantic, low concept")
        
        # High semantic but very low keyword matching
        if semantic_score > 0.8 and keyword_score < 0.2:
            inconsistencies += 1
            logger.debug("Inconsistency: high semantic, very low keyword")
        
        # Low semantic but high keyword matching (possible keyword stuffing)
        if semantic_score < 0.4 and keyword_score > 0.8:
            inconsistencies += 1
            logger.debug("Inconsistency: low semantic, high keyword (stuffing?)")
        
        # Apply consistency penalty
        if inconsistencies == 0:
            return 1.0
        elif inconsistencies == 1:
            return 0.95
        else:
            return 0.9
    
    def adaptive_weight_adjustment(
        self,
        semantic_score: float,
        concept_score: float,
        keyword_score: float,
        domain_type: str = "general"
    ) -> Tuple[float, float, float]:
        """
        Adaptively adjust weights based on score patterns and domain.
        
        Args:
            semantic_score: Semantic similarity score
            concept_score: Concept coverage score
            keyword_score: Keyword matching score
            domain_type: Type of domain (general, technical, creative)
            
        Returns:
            Adjusted weights (semantic, concept, keyword)
        """
        base_semantic = self.config.semantic_weight
        base_concept = self.config.concept_weight
        base_keyword = self.config.keyword_weight
        
        # Domain-specific adjustments
        if domain_type == "technical":
            # Emphasize concepts and keywords for technical domains
            base_concept *= 1.2
            base_keyword *= 1.1
            base_semantic *= 0.8
        elif domain_type == "creative":
            # Emphasize semantic for creative domains
            base_semantic *= 1.2
            base_concept *= 0.9
            base_keyword *= 0.8
        
        # Score pattern adjustments
        if semantic_score > 0.9:
            # If semantic is very high, slightly reduce its weight
            base_semantic *= 0.9
            base_concept *= 1.05
            base_keyword *= 1.05
        
        if concept_score < 0.2:
            # If concept coverage is very low, boost its weight
            base_concept *= 1.1
            base_semantic *= 0.95
            base_keyword *= 0.95
        
        # Normalize weights to sum to 1.0
        total = base_semantic + base_concept + base_keyword
        return (
            base_semantic / total,
            base_concept / total,
            base_keyword / total
        )
    
    def calculate_confidence_score(
        self,
        semantic_score: float,
        concept_score: float,
        keyword_score: float,
        component_variances: Optional[Dict[str, float]] = None
    ) -> float:
        """
        Calculate confidence score for the grading decision.
        
        Args:
            semantic_score: Semantic similarity score
            concept_score: Concept coverage score
            keyword_score: Keyword matching score
            component_variances: Optional variance measures for each component
            
        Returns:
            Confidence score (0-1)
        """
        # Base confidence from component agreement
        scores = [semantic_score, concept_score, keyword_score]
        score_std = np.std(scores)
        
        # High standard deviation indicates disagreement
        agreement_confidence = max(0.0, 1.0 - score_std)
        
        # Confidence from average score
        avg_score = np.mean(scores)
        magnitude_confidence = avg_score
        
        # Confidence from component stability (if variances provided)
        stability_confidence = 1.0
        if component_variances:
            variances = [
                component_variances.get("semantic", 0.1),
                component_variances.get("concept", 0.1),
                component_variances.get("keyword", 0.1)
            ]
            avg_variance = np.mean(variances)
            stability_confidence = max(0.0, 1.0 - avg_variance * 5)  # Scale variance impact
        
        # Combine confidence measures
        final_confidence = (
            agreement_confidence * 0.4 +
            magnitude_confidence * 0.4 +
            stability_confidence * 0.2
        )
        
        return normalize_score(final_confidence)
    
    def validate_score_reasonableness(
        self,
        final_score: float,
        semantic_score: float,
        concept_score: float,
        keyword_score: float
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate that the final score is reasonable given component scores.
        
        Args:
            final_score: Final calculated score
            semantic_score: Semantic similarity score
            concept_score: Concept coverage score
            keyword_score: Keyword matching score
            
        Returns:
            Tuple of (is_reasonable, reason_if_unreasonable)
        """
        # Check for extreme discrepancies
        component_avg = (semantic_score + concept_score + keyword_score) / 3
        
        if abs(final_score - component_avg) > 0.3:
            return False, f"Final score {final_score:.3f} deviates significantly from component average {component_avg:.3f}"
        
        # Check for impossible combinations
        if final_score > 0.8 and min(semantic_score, concept_score, keyword_score) < 0.2:
            return False, f"High final score {final_score:.3f} despite very low component scores"
        
        if final_score < 0.3 and max(semantic_score, concept_score, keyword_score) > 0.8:
            return False, f"Low final score {final_score:.3f} despite high component scores"
        
        return True, None
    
    def _validate_formula_parameters(self):
        """Validate formula configuration parameters."""
        if not 0.0 <= self.config.semantic_threshold <= 1.0:
            raise ValueError("Semantic threshold must be between 0 and 1")
        if not 0.0 <= self.config.concept_threshold <= 1.0:
            raise ValueError("Concept threshold must be between 0 and 1")
        if not 0.0 <= self.config.keyword_threshold <= 1.0:
            raise ValueError("Keyword threshold must be between 0 and 1")
    
    def get_formula_explanation(self) -> str:
        """
        Get human-readable explanation of the scoring formula.
        """
        return f"""
        Scoring Formula Explanation:
        
        1. Component Scores:
           - Semantic Similarity: {self.config.semantic_weight:.1%} weight
           - Concept Coverage: {self.config.concept_weight:.1%} weight  
           - Keyword Matching: {self.config.keyword_weight:.1%} weight
        
        2. Threshold Normalization:
           - Semantic threshold: {self.config.semantic_threshold:.1%}
           - Concept threshold: {self.config.concept_threshold:.1%}
           - Keyword threshold: {self.config.keyword_threshold:.1%}
        
        3. Adjustments:
           - Length multiplier: Adjusts for answer length appropriateness
           - Consistency multiplier: Penalizes inconsistent scoring patterns
           - Adaptive weighting: Adjusts weights based on domain and score patterns
        
        4. Final Score = Weighted Sum × Length_Adjustment × Consistency_Adjustment
        """


# Weight validation and optimization utilities
class WeightOptimizer:
    """Utilities for validating and optimizing scoring weights."""
    
    @staticmethod
    def validate_weights(weights: Dict[str, float]) -> bool:
        """Validate that weights are properly formatted and sum to 1.0."""
        required_keys = {"semantic", "concept", "keyword"}
        
        if set(weights.keys()) != required_keys:
            raise ValueError(f"Weights must contain exactly: {required_keys}")
        
        for key, value in weights.items():
            if not 0.0 <= value <= 1.0:
                raise ValueError(f"Weight {key} must be between 0 and 1, got {value}")
        
        weight_sum = sum(weights.values())
        if abs(weight_sum - 1.0) > 1e-6:
            raise ValueError(f"Weights must sum to 1.0, got {weight_sum}")
        
        return True
    
    @staticmethod
    def suggest_weights_for_domain(domain_type: str) -> Dict[str, float]:
        """Suggest optimal weights for different domain types."""
        if domain_type == "technical":
            return {"semantic": 0.4, "concept": 0.4, "keyword": 0.2}
        elif domain_type == "creative":
            return {"semantic": 0.6, "concept": 0.2, "keyword": 0.2}
        elif domain_type == "factual":
            return {"semantic": 0.3, "concept": 0.5, "keyword": 0.2}
        else:  # general
            return {"semantic": 0.5, "concept": 0.3, "keyword": 0.2}
    
    @staticmethod
    def optimize_weights_from_examples(
        examples: List[Dict[str, float]],
        target_scores: List[float]
    ) -> Dict[str, float]:
        """
        Optimize weights using linear regression on example data.
        
        Args:
            examples: List of component score dictionaries
            target_scores: List of target final scores
            
        Returns:
            Optimized weight dictionary
        """
        if len(examples) != len(target_scores):
            raise ValueError("Examples and target scores must have same length")
        
        if len(examples) < 3:
            raise ValueError("Need at least 3 examples for optimization")
        
        # Prepare data for linear regression
        X = np.array([[ex["semantic"], ex["concept"], ex["keyword"]] for ex in examples])
        y = np.array(target_scores)
        
        # Solve for weights using least squares
        weights, residuals, rank, s = np.linalg.lstsq(X, y, rcond=None)
        
        # Ensure weights are non-negative and sum to 1
        weights = np.maximum(weights, 0)
        weights = weights / np.sum(weights)
        
        result = {
            "semantic": float(weights[0]),
            "concept": float(weights[1]),
            "keyword": float(weights[2])
        }
        
        WeightOptimizer.validate_weights(result)
        return result

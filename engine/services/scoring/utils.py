"""
Utility functions for the scoring system.
"""
import logging
from typing import Dict, List, Optional, Tuple
import numpy as np

from .models import ScoringConfig, ComponentScore, ScoringMethod

logger = logging.getLogger("scoring-utils")


def validate_weights(config: ScoringConfig) -> bool:
    """
    Validate that scoring weights sum to 1.0 and are within valid ranges.
    
    Args:
        config: Scoring configuration to validate
        
    Returns:
        True if weights are valid, raises ValueError if not
    """
    weights = [config.semantic_weight, config.concept_weight, config.keyword_weight]
    
    # Check individual weight ranges
    for i, weight in enumerate(weights):
        if not 0.0 <= weight <= 1.0:
            raise ValueError(f"Weight {i} ({weight}) must be between 0.0 and 1.0")
    
    # Check sum
    weight_sum = sum(weights)
    if abs(weight_sum - 1.0) > 1e-6:
        raise ValueError(f"Weights must sum to 1.0, got {weight_sum}")
    
    return True


def normalize_score(score: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    """
    Normalize a score to the specified range.
    
    Args:
        score: Input score to normalize
        min_val: Minimum value of output range
        max_val: Maximum value of output range
        
    Returns:
        Normalized score
    """
    return max(min_val, min(max_val, score))


def apply_threshold_normalization(score: float, threshold: float) -> float:
    """
    Apply threshold-based normalization to scores.
    
    Scores above threshold are scaled linearly to 1.0,
    scores below threshold are scaled quadratically (more punitive).
    
    Args:
        score: Input score (0-1)
        threshold: Threshold value (0-1)
        
    Returns:
        Normalized score
    """
    if score >= threshold:
        # Linear scaling above threshold
        return min(1.0, (score - threshold) / (1.0 - threshold))
    else:
        # Quadratic scaling below threshold
        return (score / threshold) ** 2


def calculate_weighted_score(components: List[ComponentScore]) -> float:
    """
    Calculate final weighted score from component scores.
    
    Args:
        components: List of component scores
        
    Returns:
        Final weighted score
    """
    return sum(component.weighted_score for component in components)


def create_component_score(
    method: ScoringMethod,
    score: float,
    weight: float,
    details: Optional[Dict] = None
) -> ComponentScore:
    """
    Create a component score with calculated weighted score.
    
    Args:
        method: Scoring method used
        score: Raw score (0-1)
        weight: Weight in final calculation
        details: Additional details about the score
        
    Returns:
        ComponentScore object
    """
    weighted_score = score * weight
    
    return ComponentScore(
        method=method,
        score=normalize_score(score),
        weight=weight,
        weighted_score=weighted_score,
        details=details or {}
    )


def calculate_confidence_interval(scores: List[float], confidence: float = 0.95) -> Tuple[float, float]:
    """
    Calculate confidence interval for a list of scores.
    
    Args:
        scores: List of scores
        confidence: Confidence level (0-1)
        
    Returns:
        Tuple of (lower_bound, upper_bound)
    """
    if not scores:
        return (0.0, 0.0)
    
    scores_array = np.array(scores)
    mean = np.mean(scores_array)
    std_error = np.std(scores_array) / np.sqrt(len(scores_array))
    
    # Approximate confidence interval (using normal distribution)
    from scipy import stats
    margin = stats.t.ppf((1 + confidence) / 2, len(scores) - 1) * std_error
    
    return (max(0.0, mean - margin), min(1.0, mean + margin))


def detect_outliers(scores: List[float], method: str = "iqr") -> List[int]:
    """
    Detect outliers in a list of scores.
    
    Args:
        scores: List of scores
        method: Outlier detection method ("iqr" or "zscore")
        
    Returns:
        List of indices of outlier scores
    """
    if not scores:
        return []
    
    scores_array = np.array(scores)
    outlier_indices = []
    
    if method == "iqr":
        Q1 = np.percentile(scores_array, 25)
        Q3 = np.percentile(scores_array, 75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        
        outlier_indices = [
            i for i, score in enumerate(scores) 
            if score < lower_bound or score > upper_bound
        ]
    
    elif method == "zscore":
        z_scores = np.abs((scores_array - np.mean(scores_array)) / np.std(scores_array))
        outlier_indices = [i for i, z in enumerate(z_scores) if z > 2.0]
    
    return outlier_indices


def smooth_scores(scores: List[float], window_size: int = 3) -> List[float]:
    """
    Apply moving average smoothing to a list of scores.
    
    Args:
        scores: List of scores to smooth
        window_size: Size of moving window
        
    Returns:
        Smoothed list of scores
    """
    if not scores or window_size <= 1:
        return scores.copy()
    
    smoothed = []
    half_window = window_size // 2
    
    for i in range(len(scores)):
        start = max(0, i - half_window)
        end = min(len(scores), i + half_window + 1)
        window_scores = scores[start:end]
        smoothed.append(np.mean(window_scores))
    
    return smoothed


def calculate_score_distribution(scores: List[float]) -> Dict[str, int]:
    """
    Calculate distribution of scores across grade ranges.
    
    Args:
        scores: List of scores
        
    Returns:
        Dictionary with grade distribution
    """
    distribution = {
        "A": 0,  # 90-100
        "B": 0,  # 80-89
        "C": 0,  # 70-79
        "D": 0,  # 60-69
        "F": 0   # 0-59
    }
    
    for score in scores:
        if score >= 0.9:
            distribution["A"] += 1
        elif score >= 0.8:
            distribution["B"] += 1
        elif score >= 0.7:
            distribution["C"] += 1
        elif score >= 0.6:
            distribution["D"] += 1
        else:
            distribution["F"] += 1
    
    return distribution


def validate_score_consistency(
    semantic_score: float,
    concept_score: float,
    keyword_score: float
) -> bool:
    """
    Validate that component scores are logically consistent.
    
    Args:
        semantic_score: Semantic similarity score
        concept_score: Concept coverage score
        keyword_score: Keyword matching score
        
    Returns:
        True if scores are consistent, False otherwise
    """
    # If semantic similarity is very high, other scores should also be reasonably high
    if semantic_score >= 0.9:
        if concept_score < 0.3 or keyword_score < 0.3:
            logger.warning(
                f"Inconsistent scores: semantic={semantic_score:.3f}, "
                f"concept={concept_score:.3f}, keyword={keyword_score:.3f}"
            )
            return False
    
    # If concept coverage is very low, semantic similarity should also be low
    if concept_score <= 0.2:
        if semantic_score > 0.7:
            logger.warning(
                f"Inconsistent scores: semantic={semantic_score:.3f}, "
                f"concept={concept_score:.3f}, keyword={keyword_score:.3f}"
            )
            return False
    
    return True


def interpolate_scores(
    scores: List[float],
    target_length: int,
    method: str = "linear"
) -> List[float]:
    """
    Interpolate scores to a different length.
    
    Args:
        scores: Original list of scores
        target_length: Desired length of output
        method: Interpolation method ("linear" or "cubic")
        
    Returns:
        Interpolated list of scores
    """
    if len(scores) == target_length:
        return scores.copy()
    
    if len(scores) == 1:
        return [scores[0]] * target_length
    
    from scipy import interpolate
    
    original_indices = np.arange(len(scores))
    target_indices = np.linspace(0, len(scores) - 1, target_length)
    
    if method == "linear":
        interpolator = interpolate.interp1d(
            original_indices, scores, kind='linear', 
            bounds_error=False, fill_value='extrapolate'
        )
    elif method == "cubic":
        if len(scores) >= 4:
            interpolator = interpolate.interp1d(
                original_indices, scores, kind='cubic',
                bounds_error=False, fill_value='extrapolate'
            )
        else:
            # Fall back to linear for small datasets
            interpolator = interpolate.interp1d(
                original_indices, scores, kind='linear',
                bounds_error=False, fill_value='extrapolate'
            )
    else:
        raise ValueError(f"Unknown interpolation method: {method}")
    
    return interpolator(target_indices).tolist()


def calculate_score_statistics(scores: List[float]) -> Dict[str, float]:
    """
    Calculate comprehensive statistics for a list of scores.
    
    Args:
        scores: List of scores
        
    Returns:
        Dictionary with statistical measures
    """
    if not scores:
        return {
            "mean": 0.0,
            "median": 0.0,
            "std": 0.0,
            "min": 0.0,
            "max": 0.0,
            "q25": 0.0,
            "q75": 0.0,
            "skewness": 0.0,
            "kurtosis": 0.0
        }
    
    scores_array = np.array(scores)
    
    from scipy import stats
    
    return {
        "mean": float(np.mean(scores_array)),
        "median": float(np.median(scores_array)),
        "std": float(np.std(scores_array)),
        "min": float(np.min(scores_array)),
        "max": float(np.max(scores_array)),
        "q25": float(np.percentile(scores_array, 25)),
        "q75": float(np.percentile(scores_array, 75)),
        "skewness": float(stats.skew(scores_array)),
        "kurtosis": float(stats.kurtosis(scores_array))
    }

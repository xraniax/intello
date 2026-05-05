"""
Keyword and terminology scoring module.

Evaluates presence of important technical terms with support for:
    - Exact and partial keyword matching
    - Weighted keyword importance
    - TF-IDF style term frequency analysis (simplified)
    - Anti-cheating: detection of keyword stuffing
"""

import logging
import re
from typing import List, Tuple, Dict, Set, Optional
from collections import Counter
from dataclasses import dataclass

logger = logging.getLogger("engine.scoring.keywords")


@dataclass
class KeywordMatchResult:
    """Result of keyword matching for a single term."""
    keyword: str
    found: bool
    occurrences: int
    positions: List[int]  # Character positions in text
    context_snippets: List[str]


@dataclass
class KeywordScoreResult:
    """Complete keyword scoring result."""
    score: float  # 0.0-1.0
    matches: List[KeywordMatchResult]
    found_keywords: List[str]
    missing_keywords: List[str]
    coverage_ratio: float  # proportion of keywords found
    density_score: float  # penalizes stuffing, rewards natural usage
    warnings: List[str]


def tokenize(text: str) -> List[str]:
    """
    Simple tokenization for analysis.
    
    Returns lowercase tokens (words) from text.
    """
    # Remove punctuation except hyphens within words
    text = re.sub(r'[^\w\s-]', ' ', text)
    # Split on whitespace
    tokens = text.lower().split()
    return [t.strip('-') for t in tokens if t.strip('-')]


def find_keyword_matches(
    text: str,
    keyword: str,
    context_window: int = 30
) -> KeywordMatchResult:
    """
    Find all occurrences of a keyword in text.
    
    Supports:
        - Exact word/phrase matching
        - Partial word matching for technical terms (e.g., "normalize" matches "normalization")
        - Case-insensitive matching
    
    Args:
        text: Text to search
        keyword: Keyword to find
        context_window: Characters of context to capture
        
    Returns:
        KeywordMatchResult with occurrences and positions
    """
    text_lower = text.lower()
    keyword_lower = keyword.lower().strip()
    
    positions = []
    snippets = []
    
    if not keyword_lower:
        return KeywordMatchResult(
            keyword=keyword, found=False, occurrences=0,
            positions=[], context_snippets=[]
        )
    
    # Strategy 1: Exact phrase match
    start = 0
    while True:
        idx = text_lower.find(keyword_lower, start)
        if idx == -1:
            break
        
        # Verify word boundaries for single words
        if len(keyword_lower.split()) == 1:
            # Check it's a whole word
            before = idx == 0 or not text_lower[idx-1].isalnum()
            after = idx + len(keyword_lower) >= len(text_lower) or \
                    not text_lower[idx + len(keyword_lower)].isalnum()
            
            if before and after:
                positions.append(idx)
        else:
            # Multi-word phrase: accept substring match
            positions.append(idx)
        
        start = idx + 1
    
    # Strategy 2: Stem matching for longer single keywords (>5 chars)
    if len(positions) == 0 and len(keyword_lower) > 5 and ' ' not in keyword_lower:
        # Try to match stem (e.g., "normalization" -> "normalize")
        stem = keyword_lower[:-3] if keyword_lower.endswith('tion') else \
               keyword_lower[:-2] if keyword_lower.endswith('er') else \
               keyword_lower[:-2] if keyword_lower.endswith('ed') else \
               keyword_lower
        
        if len(stem) >= 4:
            pattern = r'\b' + re.escape(stem) + r'\w*\b'
            for match in re.finditer(pattern, text_lower):
                positions.append(match.start())
    
    # Extract context snippets
    for pos in positions[:5]:  # Limit to first 5 occurrences
        ctx_start = max(0, pos - context_window)
        ctx_end = min(len(text), pos + len(keyword) + context_window)
        snippet = text[ctx_start:ctx_end]
        
        # Add ellipsis
        if ctx_start > 0:
            snippet = "..." + snippet
        if ctx_end < len(text):
            snippet = snippet + "..."
        
        snippets.append(snippet)
    
    return KeywordMatchResult(
        keyword=keyword,
        found=len(positions) > 0,
        occurrences=len(positions),
        positions=positions,
        context_snippets=snippets
    )


def calculate_keyword_score(
    answer_text: str,
    keywords: List[str],
    keyword_weights: Optional[Dict[str, float]] = None,
    max_density_threshold: float = 3.0  # Max expected occurrences per 100 words
) -> KeywordScoreResult:
    """
    Calculate keyword coverage score with anti-stuffing measures.
    
    Args:
        answer_text: Student's answer
        keywords: List of important keywords to check
        keyword_weights: Optional weights per keyword (defaults equal)
        max_density_threshold: Maximum "natural" keyword density
        
    Returns:
        KeywordScoreResult with score and detailed match info
    """
    if not keywords:
        return KeywordScoreResult(
            score=1.0, matches=[], found_keywords=[], missing_keywords=[],
            coverage_ratio=1.0, density_score=1.0, warnings=[]
        )
    
    # Default equal weights
    if keyword_weights is None:
        keyword_weights = {k: 1.0 for k in keywords}
    
    # Find matches for all keywords
    matches: List[KeywordMatchResult] = []
    found_keywords: List[str] = []
    missing_keywords: List[str] = []
    
    total_weight = sum(keyword_weights.get(k, 1.0) for k in keywords)
    weighted_found = 0.0
    total_occurrences = 0
    warnings: List[str] = []
    
    for keyword in keywords:
        match = find_keyword_matches(answer_text, keyword)
        matches.append(match)
        
        weight = keyword_weights.get(keyword, 1.0)
        
        if match.found:
            found_keywords.append(keyword)
            weighted_found += weight
            total_occurrences += match.occurrences
        else:
            missing_keywords.append(keyword)
    
    # Coverage ratio: proportion of keywords found
    coverage_ratio = len(found_keywords) / len(keywords) if keywords else 0.0
    
    # Weighted coverage
    weighted_coverage = weighted_found / total_weight if total_weight > 0 else 0.0
    
    # Density analysis (anti-stuffing)
    word_count = len(tokenize(answer_text))
    if word_count > 0:
        # Calculate keyword density: occurrences per 100 words
        keyword_density = (total_occurrences / word_count) * 100
        
        # Penalize excessive keyword repetition (keyword stuffing)
        if keyword_density > max_density_threshold:
            # Exponential penalty for stuffing
            excess = keyword_density - max_density_threshold
            density_penalty = max(0.0, 1.0 - (excess / max_density_threshold))
            warnings.append(
                f"Potential keyword stuffing detected: "
                f"density={keyword_density:.1f}% (threshold={max_density_threshold:.1f}%)"
            )
        else:
            density_penalty = 1.0
    else:
        density_penalty = 0.0
    
    # Diversity bonus: reward finding many unique keywords
    diversity_bonus = min(0.1 * len(found_keywords), 0.2) if found_keywords else 0.0
    
    # Final score: weighted coverage with density penalty
    base_score = weighted_coverage
    density_score = density_penalty
    
    # Combine scores: 80% coverage, 20% natural density
    final_score = (base_score * 0.8 + density_penalty * 0.2) + diversity_bonus
    final_score = min(final_score, 1.0)  # Cap at 1.0
    
    logger.debug(
        f"Keyword score: {final_score:.3f} "
        f"(found={len(found_keywords)}/{len(keywords)}, "
        f"density_penalty={density_penalty:.3f})"
    )
    
    return KeywordScoreResult(
        score=final_score,
        matches=matches,
        found_keywords=found_keywords,
        missing_keywords=missing_keywords,
        coverage_ratio=coverage_ratio,
        density_score=density_score,
        warnings=warnings
    )


def detect_keyword_stuffing(
    answer_text: str,
    keywords: List[str],
    threshold_ratio: float = 0.5
) -> Tuple[bool, float, List[str]]:
    """
    Detect potential keyword stuffing in an answer.
    
    Heuristics:
        - Unnatural keyword density
        - Repetitive keyword patterns
        - Keywords without contextual support
    
    Args:
        answer_text: Student's answer
        keywords: Target keywords that might be stuffed
        threshold_ratio: Threshold for stuffing detection
        
    Returns:
        Tuple of (is_stuffing_detected, severity_score, warning_messages)
    """
    warnings: List[str] = []
    
    tokens = tokenize(answer_text)
    word_count = len(tokens)
    
    if word_count == 0:
        return False, 0.0, []
    
    token_counter = Counter(tokens)
    
    # Check 1: Repetitive keyword usage
    max_single_keyword_ratio = 0.0
    for keyword in keywords:
        keyword_lower = keyword.lower()
        count = token_counter.get(keyword_lower, 0)
        ratio = count / word_count if word_count > 0 else 0.0
        max_single_keyword_ratio = max(max_single_keyword_ratio, ratio)
        
        if count > 5 and ratio > 0.15:  # More than 15% of words is same keyword
            warnings.append(
                f"Repetitive use of '{keyword}': {count} times ({ratio*100:.1f}% of text)"
            )
    
    # Check 2: Total keyword density
    total_keyword_occurrences = 0
    for keyword in keywords:
        match = find_keyword_matches(answer_text, keyword)
        total_keyword_occurrences += match.occurrences
    
    total_density = total_keyword_occurrences / word_count if word_count > 0 else 0.0
    
    if total_density > threshold_ratio:
        warnings.append(
            f"High keyword density: {total_density*100:.1f}% of words are target keywords"
        )
    
    # Check 3: Semantic coherence (simplified)
    # If answer is very short but contains many keywords, might be stuffed
    if word_count < 20 and len([k for k in keywords if find_keyword_matches(answer_text, k).found]) >= 3:
        warnings.append("Very short answer with multiple keywords - possible stuffing")
    
    # Calculate severity score (0.0 = no stuffing, 1.0 = severe stuffing)
    severity = min(
        len(warnings) * 0.3 +  # 0.3 per warning
        (max_single_keyword_ratio * 2) +  # weight for repetition
        (max(0, total_density - threshold_ratio) * 2),  # weight for density
        1.0
    )
    
    is_detected = len(warnings) > 0 and severity > 0.3
    
    return is_detected, severity, warnings


def extract_terminology_usage(
    answer_text: str,
    terminology_list: List[str]
) -> Dict[str, Dict]:
    """
    Extract detailed terminology usage statistics.
    
    Useful for generating feedback about technical term usage.
    
    Args:
        answer_text: Student's answer
        terminology_list: Technical terms to analyze
        
    Returns:
        Dict mapping term to usage statistics
    """
    results: Dict[str, Dict] = {}
    
    for term in terminology_list:
        match = find_keyword_matches(answer_text, term, context_window=40)
        
        results[term] = {
            "found": match.found,
            "occurrences": match.occurrences,
            "contexts": match.context_snippets[:3],  # First 3 contexts
            "positions": match.positions[:5]  # First 5 positions
        }
    
    return results

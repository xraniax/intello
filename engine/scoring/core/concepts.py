"""
Concept coverage detection for rubric-based grading.

Supports both:
    - Keyword/rule-based concept detection
    - Semantic embedding-based concept detection

Uses the same Sentence-BERT embedding space as the similarity module.
"""

import logging
import re
from typing import List, Tuple, Dict, Set
from dataclasses import dataclass

from .similarity import detect_concept_with_embedding

logger = logging.getLogger("engine.scoring.concepts")


@dataclass
class ConceptDetectionResult:
    """Result of concept detection for a single concept."""
    name: str
    present: bool
    confidence: float
    detection_method: str  # "keyword" or "semantic" or "both"
    matched_keywords: List[str]
    semantic_similarity: float


def normalize_text(text: str) -> str:
    """Normalize text for matching."""
    return text.lower().strip()


def detect_concept_by_keywords(
    answer_text: str,
    concept_keywords: List[str],
    match_threshold: int = 1
) -> Tuple[bool, List[str], float]:
    """
    Detect concept presence by keyword matching.
    
    Args:
        answer_text: Student's answer text
        concept_keywords: Keywords that indicate the concept
        match_threshold: Minimum number of keywords to match (default: 1)
        
    Returns:
        Tuple of (is_present, matched_keywords, confidence_score)
    """
    if not concept_keywords:
        return False, [], 0.0
    
    answer_lower = normalize_text(answer_text)
    matched = []
    
    for keyword in concept_keywords:
        keyword_lower = normalize_text(keyword)
        
        # Check for exact match or word boundary match
        if keyword_lower in answer_lower:
            # Verify it's not part of another word (simple check)
            pattern = r'(?:^|\W)' + re.escape(keyword_lower) + r'(?:$|\W)'
            if re.search(pattern, answer_lower):
                matched.append(keyword)
        
        # Check for partial matches (e.g., "normalization" matches "normalize")
        elif len(keyword_lower) > 5:
            # Only for longer keywords to avoid false positives
            stem = keyword_lower[:-3]  # Simple stemming
            if stem in answer_lower and len(stem) > 4:
                # Additional verification: stem should be at word boundary
                pattern = r'(?:^|\W)' + re.escape(stem) + r'\w*(?:$|\W)'
                if re.search(pattern, answer_lower):
                    matched.append(keyword)
    
    # Remove duplicates while preserving order
    seen = set()
    matched_unique = []
    for m in matched:
        if m not in seen:
            seen.add(m)
            matched_unique.append(m)
    
    is_present = len(matched_unique) >= match_threshold
    
    # Confidence based on proportion of keywords matched
    confidence = len(matched_unique) / len(concept_keywords) if concept_keywords else 0.0
    confidence = min(confidence * 1.5, 1.0)  # Boost for multiple matches, cap at 1.0
    
    return is_present, matched_unique, confidence


def detect_concept_semantic(
    answer_text: str,
    concept_description: str,
    threshold: float = 0.65
) -> Tuple[bool, float]:
    """
    Detect concept presence using semantic similarity.
    
    Args:
        answer_text: Student's answer
        concept_description: Description of what the concept means
        threshold: Minimum similarity to consider present
        
    Returns:
        Tuple of (is_present, confidence_score)
    """
    return detect_concept_with_embedding(answer_text, concept_description, threshold)


def evaluate_concept_coverage(
    answer_text: str,
    concept_definitions: List[Dict],
    semantic_threshold: float = 0.65,
    require_keywords: bool = True
) -> Tuple[float, List[ConceptDetectionResult], List[str], List[str]]:
    """
    Evaluate concept coverage for a student answer against rubric concepts.
    
    Uses hybrid detection: both keyword and semantic matching for robustness.
    
    Args:
        answer_text: Student's submitted answer
        concept_definitions: List of concept definition dicts with keys:
            - name: concept name
            - description: concept description
            - keywords: list of keywords
            - weight: concept importance
            - required: whether concept is mandatory
        semantic_threshold: Threshold for semantic detection
        require_keywords: If True, keyword match OR semantic match required
                       If False, either method can confirm presence
        
    Returns:
        Tuple of:
            - coverage_score: weighted coverage score (0.0-1.0)
            - concept_results: detailed results for each concept
            - present_concepts: list of detected concept names
            - missing_concepts: list of missing concept names
    """
    if not concept_definitions:
        return 1.0, [], [], []
    
    results: List[ConceptDetectionResult] = []
    present_concepts: List[str] = []
    missing_concepts: List[str] = []
    
    total_weight = sum(c.get("weight", 1.0) for c in concept_definitions)
    weighted_coverage = 0.0
    
    for concept in concept_definitions:
        name = concept.get("name", "unknown")
        description = concept.get("description", "")
        keywords = concept.get("keywords", [])
        weight = concept.get("weight", 1.0)
        required = concept.get("required", True)
        
        # Try keyword detection first (faster, more explainable)
        keyword_present, matched_keywords, keyword_confidence = detect_concept_by_keywords(
            answer_text, keywords, match_threshold=1
        )
        
        # Try semantic detection
        semantic_present = False
        semantic_confidence = 0.0
        if description:
            semantic_present, semantic_confidence = detect_concept_semantic(
                answer_text, description, semantic_threshold
            )
        
        # Determine final presence based on method
        if require_keywords:
            # Require keyword match OR strong semantic match
            is_present = keyword_present or (semantic_present and semantic_confidence > 0.75)
        else:
            # Either method can confirm
            is_present = keyword_present or semantic_present
        
        # Determine detection method and final confidence
        if keyword_present and semantic_present:
            detection_method = "both"
            confidence = max(keyword_confidence, semantic_confidence)
        elif keyword_present:
            detection_method = "keyword"
            confidence = keyword_confidence
        elif semantic_present:
            detection_method = "semantic"
            confidence = semantic_confidence
        else:
            detection_method = "none"
            confidence = max(keyword_confidence, semantic_confidence)
        
        result = ConceptDetectionResult(
            name=name,
            present=is_present,
            confidence=confidence,
            detection_method=detection_method,
            matched_keywords=matched_keywords,
            semantic_similarity=semantic_confidence
        )
        results.append(result)
        
        # Track present/missing
        if is_present:
            present_concepts.append(name)
            weighted_coverage += weight
        elif required:
            missing_concepts.append(name)
    
    # Calculate coverage score
    coverage_score = weighted_coverage / total_weight if total_weight > 0 else 0.0
    
    logger.debug(
        f"Concept coverage: {coverage_score:.3f} "
        f"(present={len(present_concepts)}, missing={len(missing_concepts)})"
    )
    
    return coverage_score, results, present_concepts, missing_concepts


def extract_concept_snippets(
    answer_text: str,
    concept_keywords: List[str],
    context_window: int = 50
) -> Dict[str, List[str]]:
    """
    Extract text snippets around matched concept keywords.
    
    Useful for generating feedback showing where concepts were mentioned.
    
    Args:
        answer_text: Student's answer
        concept_keywords: Keywords to find
        context_window: Characters of context around each match
        
    Returns:
        Dict mapping keyword to list of context snippets
    """
    snippets: Dict[str, List[str]] = {}
    answer_lower = normalize_text(answer_text)
    
    for keyword in concept_keywords:
        keyword_lower = normalize_text(keyword)
        snippets[keyword] = []
        
        # Find all occurrences
        start = 0
        while True:
            idx = answer_lower.find(keyword_lower, start)
            if idx == -1:
                break
            
            # Extract context
            ctx_start = max(0, idx - context_window)
            ctx_end = min(len(answer_text), idx + len(keyword) + context_window)
            snippet = answer_text[ctx_start:ctx_end].strip()
            
            # Add ellipsis if truncated
            if ctx_start > 0:
                snippet = "..." + snippet
            if ctx_end < len(answer_text):
                snippet = snippet + "..."
            
            snippets[keyword].append(snippet)
            start = idx + len(keyword)
    
    return snippets

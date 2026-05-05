"""
Anti-cheating utilities for exam scoring.

Detects and handles:
    - Keyword stuffing (excessive keyword repetition)
    - Irrelevant verbose text (padding to appear comprehensive)
    - Copied reference answers (plagiarism detection)
    - Gibberish or nonsense answers
    - Off-topic content
"""

import logging
import re
from typing import List, Tuple, Dict, Set
from dataclasses import dataclass
import math

from ..core.similarity import semantic_similarity_score, compute_embedding, cosine_similarity
from ..core.keywords import tokenize

logger = logging.getLogger("engine.scoring.anti_cheating")


@dataclass
class AntiCheatingReport:
    """Report of anti-cheating analysis."""
    is_suspicious: bool
    suspicion_score: float  # 0.0-1.0, higher = more suspicious
    warnings: List[str]
    details: Dict


def detect_irrelevant_verbose_text(
    answer_text: str,
    reference_answer: str,
    rubric_keywords: List[str],
    entropy_threshold: float = 4.5
) -> Tuple[bool, float, List[str]]:
    """
    Detect irrelevant verbose text added to pad answer length.
    
    Heuristics:
        - Very long answers with low information density
        - High word count but low semantic similarity
        - Repeating content without adding new information
    
    Args:
        answer_text: Student's answer
        reference_answer: Reference answer
        rubric_keywords: Expected keywords
        entropy_threshold: Threshold for text entropy (lower = more repetitive)
        
    Returns:
        Tuple of (is_irrelevant_verbose, severity, warnings)
    """
    warnings: List[str] = []
    
    # Check length
    word_count = len(tokenize(answer_text))
    ref_word_count = len(tokenize(reference_answer))
    
    if word_count > ref_word_count * 3:
        warnings.append(f"Answer is {word_count/ref_word_count:.1f}x longer than expected")
    
    # Check semantic similarity vs length
    similarity, _, _ = semantic_similarity_score(answer_text, reference_answer)
    
    # If very long but low similarity, likely padding
    if word_count > ref_word_count * 2 and similarity < 0.4:
        warnings.append(
            f"Long answer with low semantic alignment (sim={similarity:.2f}) - possible padding"
        )
    
    # Check information entropy (repetition)
    tokens = tokenize(answer_text)
    if tokens:
        unique_tokens = set(tokens)
        # Shannon entropy approximation
        token_counts = {}
        for t in tokens:
            token_counts[t] = token_counts.get(t, 0) + 1
        
        entropy = 0.0
        for count in token_counts.values():
            p = count / len(tokens)
            if p > 0:
                entropy -= p * math.log2(p)
        
        # Low entropy means repetitive text
        if entropy < entropy_threshold and word_count > 50:
            warnings.append(
                f"Low information density (entropy={entropy:.2f}) - possible repetitive padding"
            )
    
    # Check for sentence repetition
    sentences = re.split(r'[.!?]+', answer_text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
    unique_sentences = set(s.lower() for s in sentences)
    
    if len(sentences) > 5 and len(unique_sentences) / len(sentences) < 0.7:
        warnings.append("Significant sentence repetition detected")
    
    severity = min(len(warnings) * 0.25, 1.0)
    is_detected = len(warnings) > 0
    
    return is_detected, severity, warnings


def detect_copied_reference(
    answer_text: str,
    reference_answer: str,
    similarity_threshold: float = 0.92
) -> Tuple[bool, float, str]:
    """
    Detect if student copied the reference answer directly.
    
    Args:
        answer_text: Student's answer
        reference_answer: Reference answer
        similarity_threshold: Threshold for copy detection
        
    Returns:
        Tuple of (is_copied, confidence, message)
    """
    similarity, _, _ = semantic_similarity_score(answer_text, reference_answer)
    
    # Also check substring containment
    answer_lower = answer_text.lower().strip()
    ref_lower = reference_answer.lower().strip()
    
    # Direct containment check
    is_contained = ref_lower in answer_lower or answer_lower in ref_lower
    
    # Length ratio check (if answer is very similar length to reference)
    len_ratio = len(answer_text) / max(len(reference_answer), 1)
    length_similar = 0.8 < len_ratio < 1.2
    
    is_copied = similarity > similarity_threshold or (is_contained and length_similar)
    
    if is_copied:
        message = (
            f"Answer appears to be copied from reference "
            f"(similarity={similarity:.2f}, contained={is_contained})"
        )
    else:
        message = ""
    
    return is_copied, similarity, message


def detect_gibberish(
    answer_text: str,
    min_word_length: int = 2,
    readable_ratio_threshold: float = 0.6
) -> Tuple[bool, float, List[str]]:
    """
    Detect gibberish or nonsense text.
    
    Heuristics:
        - Too many non-dictionary words
        - Unusual character patterns
        - Random character sequences
    
    Args:
        answer_text: Student's answer
        min_word_length: Minimum length for meaningful words
        readable_ratio_threshold: Ratio of "readable" words required
        
    Returns:
        Tuple of (is_gibberish, confidence, warnings)
    """
    warnings: List[str] = []
    
    # Remove punctuation and split
    words = re.findall(r'\b[a-zA-Z]+\b', answer_text.lower())
    
    if not words:
        return True, 1.0, ["No readable text found"]
    
    # Check for very short words (often gibberish)
    short_words = [w for w in words if len(w) < min_word_length]
    if len(short_words) / len(words) > 0.3:
        warnings.append("High proportion of very short words - possible gibberish")
    
    # Check for words with excessive consonants (unpronounceable)
    vowels = set('aeiou')
    unpronounceable = 0
    for word in words:
        if len(word) > 5:
            # Count consecutive consonants
            consonant_runs = re.findall(r'[^aeiou]{4,}', word.lower())
            if consonant_runs:
                unpronounceable += 1
    
    if unpronounceable / max(len(words), 1) > 0.2:
        warnings.append("Unusual consonant patterns detected - possible gibberish")
    
    # Check character entropy (random text has high entropy)
    if len(answer_text) > 20:
        char_entropy = 0.0
        char_counts = {}
        for c in answer_text.lower():
            if c.isalpha():
                char_counts[c] = char_counts.get(c, 0) + 1
        
        total_chars = sum(char_counts.values())
        if total_chars > 0:
            for count in char_counts.values():
                p = count / total_chars
                if p > 0:
                    char_entropy -= p * math.log2(p)
        
        # Very high character entropy suggests random text
        if char_entropy > 4.2 and len(answer_text) > 50:
            warnings.append("Unusual character distribution - possible random text")
    
    # Check for excessive repetition of same sentence structure
    sentences = re.split(r'[.!?]+', answer_text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 5]
    
    if len(sentences) > 3:
        # Check if all sentences start with same pattern
        starts = [s.split()[0].lower() if s.split() else '' for s in sentences[:5]]
        if len(set(starts)) == 1:
            warnings.append("Repetitive sentence structure detected")
    
    severity = min(len(warnings) * 0.35, 1.0)
    is_gibberish = len(warnings) >= 2 or severity > 0.5
    
    return is_gibberish, severity, warnings


def detect_off_topic_content(
    answer_text: str,
    reference_answer: str,
    rubric_concepts: List[str],
    min_similarity: float = 0.25
) -> Tuple[bool, float, List[str]]:
    """
    Detect if answer is off-topic or unrelated to question.
    
    Args:
        answer_text: Student's answer
        reference_answer: Reference answer
        rubric_concepts: Expected concepts
        min_similarity: Minimum similarity to be considered on-topic
        
    Returns:
        Tuple of (is_off_topic, confidence, warnings)
    """
    warnings: List[str] = []
    
    # Primary check: semantic similarity to reference
    similarity, _, _ = semantic_similarity_score(answer_text, reference_answer)
    
    if similarity < min_similarity:
        warnings.append(
            f"Low semantic similarity to expected answer (sim={similarity:.2f})"
        )
    
    # Secondary check: concept overlap
    if rubric_concepts:
        answer_lower = answer_text.lower()
        concept_hits = sum(1 for c in rubric_concepts if c.lower() in answer_lower)
        concept_coverage = concept_hits / len(rubric_concepts)
        
        if concept_coverage < 0.2 and len(rubric_concepts) >= 2:
            warnings.append(
                f"Missing expected concepts (found {concept_hits}/{len(rubric_concepts)})"
            )
    
    # Check for completely unrelated patterns
    # If answer is very generic, it might be a template
    generic_phrases = [
        "this is a very important topic",
        "there are many different perspectives",
        "in conclusion",
        "to summarize",
    ]
    
    generic_count = sum(1 for p in generic_phrases if p in answer_text.lower())
    if generic_count >= 2 and similarity < 0.4:
        warnings.append("Generic template language detected with low topical relevance")
    
    severity = min(len(warnings) * 0.4, 1.0)
    is_off_topic = similarity < 0.15 or (len(warnings) >= 2 and similarity < 0.3)
    
    return is_off_topic, severity, warnings


def analyze_answer_quality(
    answer_text: str,
    reference_answer: str,
    rubric_keywords: List[str],
    rubric_concepts: List[str]
) -> AntiCheatingReport:
    """
    Comprehensive anti-cheating analysis.
    
    Runs all detection methods and compiles a report.
    
    Args:
        answer_text: Student's answer
        reference_answer: Reference answer
        rubric_keywords: Expected keywords
        rubric_concepts: Expected concepts
        
    Returns:
        AntiCheatingReport with findings
    """
    all_warnings: List[str] = []
    details: Dict = {}
    total_severity = 0.0
    
    # Check 1: Irrelevant verbose text
    is_verbose, verbose_sev, verbose_warnings = detect_irrelevant_verbose_text(
        answer_text, reference_answer, rubric_keywords
    )
    all_warnings.extend(verbose_warnings)
    total_severity += verbose_sev
    details["verbose_padding"] = {
        "detected": is_verbose,
        "severity": verbose_sev,
        "warnings": verbose_warnings
    }
    
    # Check 2: Copied reference
    is_copied, copy_sim, copy_msg = detect_copied_reference(answer_text, reference_answer)
    if is_copied:
        all_warnings.append(copy_msg)
        total_severity += 0.9  # High severity for copying
    details["copied_reference"] = {
        "detected": is_copied,
        "similarity": copy_sim,
        "message": copy_msg
    }
    
    # Check 3: Gibberish
    is_gibberish, gibberish_sev, gibberish_warnings = detect_gibberish(answer_text)
    all_warnings.extend(gibberish_warnings)
    total_severity += gibberish_sev
    details["gibberish"] = {
        "detected": is_gibberish,
        "severity": gibberish_sev,
        "warnings": gibberish_warnings
    }
    
    # Check 4: Off-topic
    is_off_topic, off_topic_sev, off_topic_warnings = detect_off_topic_content(
        answer_text, reference_answer, rubric_concepts
    )
    all_warnings.extend(off_topic_warnings)
    total_severity += off_topic_sev
    details["off_topic"] = {
        "detected": is_off_topic,
        "severity": off_topic_sev,
        "warnings": off_topic_warnings
    }
    
    # Cap severity at 1.0
    final_severity = min(total_severity / 2, 1.0)  # Average and cap
    
    # Determine if suspicious (any high-severity detection)
    is_suspicious = (
        is_copied or
        is_gibberish or
        (is_verbose and verbose_sev > 0.5) or
        (is_off_topic and off_topic_sev > 0.5) or
        final_severity > 0.4
    )
    
    return AntiCheatingReport(
        is_suspicious=is_suspicious,
        suspicion_score=final_severity,
        warnings=all_warnings,
        details=details
    )


def calculate_anti_cheating_penalty(
    report: AntiCheatingReport,
    base_score: float,
    max_penalty: float = 0.5
) -> float:
    """
    Calculate score penalty based on anti-cheating findings.
    
    Args:
        report: AntiCheatingReport
        base_score: Original score (0.0-1.0)
        max_penalty: Maximum penalty to apply
        
    Returns:
        Adjusted score after penalty
    """
    if not report.is_suspicious:
        return base_score
    
    # Penalty scales with suspicion score
    penalty = report.suspicion_score * max_penalty
    
    # Extra penalty for copying
    if report.details.get("copied_reference", {}).get("detected", False):
        penalty = max(penalty, 0.7)  # At least 70% penalty for copying
    
    adjusted_score = base_score * (1 - penalty)
    
    logger.debug(
        f"Anti-cheating penalty: base={base_score:.3f}, "
        f"penalty={penalty:.3f}, adjusted={adjusted_score:.3f}"
    )
    
    return max(adjusted_score, 0.0)

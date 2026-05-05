"""
Keyword-based scoring for educational assessment.
"""
import logging
import re
import time
from typing import List, Dict, Set, Optional, Tuple
from collections import Counter

import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

from .models import KeywordMatch, ScoringConfig

logger = logging.getLogger("scoring-keywords")


class KeywordScorer:
    """Handles keyword extraction and matching for scoring."""
    
    def __init__(self, config: ScoringConfig):
        self.config = config
        self._max_keywords = config.max_keywords
        self._keyword_threshold = config.keyword_threshold
        
        # Initialize NLP components
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt')
            
        try:
            nltk.data.find('corpora/stopwords')
        except LookupError:
            nltk.download('stopwords')
            
        try:
            nltk.data.find('corpora/wordnet')
        except LookupError:
            nltk.download('wordnet')
        
        self.lemmatizer = WordNetLemmatizer()
        self.stop_words = set(stopwords.words('english'))
    
    def extract_keywords(
        self, 
        text: str, 
        custom_keywords: Optional[List[str]] = None
    ) -> List[str]:
        """
        Extract important keywords from text.
        
        Args:
            text: Input text to extract keywords from
            custom_keywords: Optional predefined keywords to prioritize
            
        Returns:
            List of extracted keywords
        """
        start_time = time.time()
        
        keywords = []
        
        # Method 1: Custom keyword matching
        if custom_keywords:
            keywords.extend(self._extract_custom_keywords(text, custom_keywords))
        
        # Method 2: Statistical keyword extraction
        keywords.extend(self._extract_statistical_keywords(text))
        
        # Method 3: Position-based keyword extraction
        keywords.extend(self._extract_positional_keywords(text))
        
        # Remove duplicates and limit to max_keywords
        keywords = self._deduplicate_keywords(keywords)[:self._max_keywords]
        
        processing_time = (time.time() - start_time) * 1000
        logger.debug(f"Extracted {len(keywords)} keywords in {processing_time:.1f}ms")
        
        return keywords
    
    def _extract_custom_keywords(self, text: str, custom_keywords: List[str]) -> List[str]:
        """Extract predefined custom keywords from text."""
        found_keywords = []
        text_lower = text.lower()
        
        for keyword in custom_keywords:
            if keyword.lower() in text_lower:
                found_keywords.append(keyword)
        
        return found_keywords
    
    def _extract_statistical_keywords(self, text: str) -> List[str]:
        """Extract keywords using statistical methods (TF-IDF like)."""
        # Tokenize and clean
        tokens = word_tokenize(text.lower())
        tokens = [
            self.lemmatizer.lemmatize(token) 
            for token in tokens 
            if token.isalpha() and token not in self.stop_words and len(token) > 2
        ]
        
        if not tokens:
            return []
        
        # Calculate term frequencies
        term_freq = Counter(tokens)
        total_terms = len(tokens)
        
        # Calculate TF-IDF-like scores (simplified)
        keyword_scores = {}
        for term, freq in term_freq.items():
            tf = freq / total_terms
            
            # Simple IDF approximation based on term length and rarity
            idf_approx = 1.0 + (len(term) / 10.0) + (1.0 / freq)
            score = tf * idf_approx
            
            keyword_scores[term] = score
        
        # Select top keywords
        sorted_keywords = sorted(keyword_scores.items(), key=lambda x: x[1], reverse=True)
        return [keyword for keyword, _ in sorted_keywords[:self._max_keywords//2]]
    
    def _extract_positional_keywords(self, text: str) -> List[str]:
        """Extract keywords based on their position in text."""
        sentences = nltk.sent_tokenize(text)
        keywords = []
        
        # Keywords from first and last sentences (often contain important info)
        important_sentences = []
        if sentences:
            important_sentences.append(sentences[0])  # First sentence
            if len(sentences) > 1:
                important_sentences.append(sentences[-1])  # Last sentence
        
        # Extract terms from important sentences
        for sentence in important_sentences:
            tokens = word_tokenize(sentence.lower())
            for token in tokens:
                if (token.isalpha() and 
                    token not in self.stop_words and 
                    len(token) > 2 and 
                    token.isupper() or token[0].isupper()):  # Capitalized terms might be important
                    keywords.append(self.lemmatizer.lemmatize(token))
        
        return keywords[:self._max_keywords//2]
    
    def _deduplicate_keywords(self, keywords: List[str]) -> List[str]:
        """Remove duplicate keywords while preserving order."""
        seen = set()
        deduplicated = []
        
        for keyword in keywords:
            keyword_lower = keyword.lower()
            if keyword_lower not in seen:
                seen.add(keyword_lower)
                deduplicated.append(keyword)
        
        return deduplicated
    
    def match_keywords(
        self,
        student_answer: str,
        reference_keywords: List[str],
        *,
        request_id: Optional[str] = None
    ) -> Dict:
        """
        Match keywords in student answer against reference keywords.
        
        Args:
            student_answer: Student's response
            reference_keywords: List of expected keywords
            request_id: Optional request ID for logging
            
        Returns:
            Dictionary with matching results and score
        """
        start_time = time.time()
        
        # Extract keywords from student answer
        student_keywords = self.extract_keywords(student_answer)
        
        # Find matches
        matches = self._find_keyword_matches(student_answer, reference_keywords)
        
        # Calculate matching score
        match_score = self._calculate_keyword_score(matches, reference_keywords)
        
        result = {
            "match_score": match_score,
            "reference_keywords": reference_keywords,
            "student_keywords": student_keywords,
            "matched_keywords": [match.keyword for match in matches if match.found],
            "unmatched_keywords": [match.keyword for match in matches if not match.found],
            "matches": [match.dict() for match in matches],
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        logger.debug(
            f"Keyword matching: {match_score:.3f} "
            f"(matched: {len(result['matched_keywords'])}/{len(reference_keywords)})"
        )
        
        return result
    
    def _find_keyword_matches(self, text: str, keywords: List[str]) -> List[KeywordMatch]:
        """Find keyword matches in text with position information."""
        matches = []
        text_lower = text.lower()
        
        for keyword in keywords:
            keyword_lower = keyword.lower()
            
            # Find all occurrences
            start = 0
            found_any = False
            
            while True:
                pos = text_lower.find(keyword_lower, start)
                if pos == -1:
                    break
                
                # Extract context (20 characters before and after)
                context_start = max(0, pos - 20)
                context_end = min(len(text), pos + len(keyword) + 20)
                context = text[context_start:context_end].strip()
                
                matches.append(KeywordMatch(
                    keyword=keyword,
                    found=True,
                    position=pos,
                    context=context
                ))
                
                found_any = True
                start = pos + 1
            
            if not found_any:
                matches.append(KeywordMatch(
                    keyword=keyword,
                    found=False
                ))
        
        return matches
    
    def _calculate_keyword_score(self, matches: List[KeywordMatch], reference_keywords: List[str]) -> float:
        """Calculate keyword matching score."""
        if not reference_keywords:
            return 0.0
        
        # Count unique keywords found
        found_keywords = set()
        for match in matches:
            if match.found:
                found_keywords.add(match.keyword.lower())
        
        # Calculate basic coverage
        coverage = len(found_keywords) / len(reference_keywords)
        
        # Apply threshold-based normalization
        if coverage >= self._keyword_threshold:
            return min(1.0, (coverage - self._keyword_threshold) / (1.0 - self._keyword_threshold))
        else:
            return (coverage / self._keyword_threshold) ** 2
    
    def generate_keyword_variants(self, keywords: List[str]) -> List[str]:
        """Generate common variants of keywords (plural, different forms, etc.)."""
        variants = set()
        
        for keyword in keywords:
            # Add original
            variants.add(keyword)
            
            # Add lemmatized version
            lemmatized = self.lemmatizer.lemmatize(keyword.lower())
            variants.add(lemmatized)
            
            # Add common plural/singular forms
            if keyword.endswith('s'):
                singular = keyword[:-1]
                variants.add(singular)
            else:
                plural = keyword + 's'
                variants.add(plural)
            
            # Add common suffixes/prefixes for educational terms
            common_suffixes = ['ing', 'ed', 'tion', 'sion', 'ity', 'ment']
            for suffix in common_suffixes:
                if keyword.endswith(suffix):
                    base = keyword[:-len(suffix)]
                    variants.add(base)
                else:
                    variant = keyword + suffix
                    variants.add(variant)
        
        return list(variants)
    
    def score_answer_keywords(
        self,
        student_answer: str,
        reference_answer: str,
        custom_keywords: Optional[List[str]] = None,
        *,
        request_id: Optional[str] = None
    ) -> Dict:
        """
        Complete keyword scoring workflow.
        
        Args:
            student_answer: Student's response
            reference_answer: Reference/expected answer
            custom_keywords: Optional predefined keywords
            request_id: Optional request ID for logging
            
        Returns:
            Dictionary with complete keyword scoring results
        """
        # Extract keywords from reference answer
        reference_keywords = self.extract_keywords(reference_answer, custom_keywords)
        
        # Match against student answer
        return self.match_keywords(student_answer, reference_keywords, request_id=request_id)

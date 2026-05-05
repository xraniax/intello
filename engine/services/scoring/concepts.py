"""
Concept coverage detection and scoring.
"""
import logging
import re
import time
from typing import List, Dict, Set, Optional
from collections import Counter

import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
import spacy

from .models import ConceptExtraction, ScoringConfig

logger = logging.getLogger("scoring-concepts")


class ConceptCoverageScorer:
    """Handles concept extraction and coverage scoring."""
    
    def __init__(self, config: ScoringConfig):
        self.config = config
        self._min_coverage = config.min_concept_coverage
        self._concept_threshold = config.concept_threshold
        
        # Initialize NLP components
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.warning("spaCy English model not found, using basic processing")
            self.nlp = None
            
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            logger.info("Downloading NLTK punkt tokenizer")
            nltk.download('punkt')
            
        try:
            nltk.data.find('corpora/stopwords')
        except LookupError:
            logger.info("Downloading NLTK stopwords")
            nltk.download('stopwords')
            
        try:
            nltk.data.find('corpora/wordnet')
        except LookupError:
            logger.info("Downloading NLTK WordNet")
            nltk.download('wordnet')
        
        self.lemmatizer = WordNetLemmatizer()
        self.stop_words = set(stopwords.words('english'))
    
    def extract_concepts(
        self, 
        text: str, 
        domain_concepts: Optional[List[str]] = None
    ) -> List[ConceptExtraction]:
        """
        Extract concepts from text using NLP techniques.
        
        Args:
            text: Input text to extract concepts from
            domain_concepts: Optional predefined domain concepts to prioritize
            
        Returns:
            List of extracted concepts with relevance scores
        """
        start_time = time.time()
        
        concepts = []
        
        # Method 1: Domain-specific concept matching
        if domain_concepts:
            concepts.extend(self._extract_domain_concepts(text, domain_concepts))
        
        # Method 2: NLP-based concept extraction
        if self.nlp:
            concepts.extend(self._extract_nlp_concepts(text))
        else:
            concepts.extend(self._extract_basic_concepts(text))
        
        # Remove duplicates and normalize
        concepts = self._deduplicate_concepts(concepts)
        
        processing_time = (time.time() - start_time) * 1000
        logger.debug(f"Extracted {len(concepts)} concepts in {processing_time:.1f}ms")
        
        return concepts
    
    def _extract_domain_concepts(self, text: str, domain_concepts: List[str]) -> List[ConceptExtraction]:
        """Extract predefined domain concepts from text."""
        concepts = []
        text_lower = text.lower()
        
        for concept in domain_concepts:
            concept_lower = concept.lower()
            
            # Count occurrences
            count = text_lower.count(concept_lower)
            if count > 0:
                # Calculate relevance based on frequency and position
                relevance = min(1.0, count / len(text.split()) * 10)
                
                concepts.append(ConceptExtraction(
                    concept=concept,
                    relevance=relevance,
                    category="domain"
                ))
        
        return concepts
    
    def _extract_nlp_concepts(self, text: str) -> List[ConceptExtraction]:
        """Extract concepts using spaCy NLP processing."""
        concepts = []
        doc = self.nlp(text)
        
        # Extract noun phrases as potential concepts
        for chunk in doc.noun_chunks:
            if len(chunk.text.split()) <= 3:  # Limit to 3-word concepts
                if not self._is_stop_phrase(chunk.text):
                    relevance = self._calculate_concept_relevance(chunk, doc)
                    if relevance > 0.1:
                        concepts.append(ConceptExtraction(
                            concept=chunk.text.strip(),
                            relevance=relevance,
                            category="noun_phrase"
                        ))
        
        # Extract named entities
        for ent in doc.ents:
            if ent.label_ in ['PERSON', 'ORG', 'GPE', 'PRODUCT', 'EVENT']:
                relevance = self._calculate_entity_relevance(ent, doc)
                if relevance > 0.1:
                    concepts.append(ConceptExtraction(
                        concept=ent.text.strip(),
                        relevance=relevance,
                        category=f"entity_{ent.label_.lower()}"
                    ))
        
        return concepts
    
    def _extract_basic_concepts(self, text: str) -> List[ConceptExtraction]:
        """Extract concepts using basic NLP when spaCy is unavailable."""
        concepts = []
        
        # Tokenize and extract important terms
        tokens = word_tokenize(text.lower())
        tokens = [self.lemmatizer.lemmatize(token) for token in tokens 
                 if token.isalpha() and token not in self.stop_words and len(token) > 2]
        
        # Calculate TF-IDF-like scores
        token_freq = Counter(tokens)
        total_tokens = len(tokens)
        
        for token, freq in token_freq.items():
            if freq >= 2:  # Must appear at least twice
                relevance = min(1.0, freq / total_tokens * 20)
                concepts.append(ConceptExtraction(
                    concept=token,
                    relevance=relevance,
                    category="basic"
                ))
        
        return concepts
    
    def _is_stop_phrase(self, phrase: str) -> bool:
        """Check if a phrase is mostly stop words."""
        tokens = word_tokenize(phrase.lower())
        stop_count = sum(1 for token in tokens if token in self.stop_words)
        return stop_count / len(tokens) > 0.6
    
    def _calculate_concept_relevance(self, chunk, doc) -> float:
        """Calculate relevance score for a noun phrase."""
        # Base relevance from length and position
        base_score = min(1.0, len(chunk.text.split()) / 3.0)
        
        # Boost if contains important POS tags
        pos_boost = 1.0
        if any(token.pos_ in ['NOUN', 'PROPN'] for token in chunk):
            pos_boost = 1.2
        if any(token.pos_ in ['ADJ'] for token in chunk):
            pos_boost *= 1.1
        
        # Position boost (earlier concepts might be more important)
        position_factor = 1.0 - (chunk.start / len(doc)) * 0.3
        
        return min(1.0, base_score * pos_boost * position_factor)
    
    def _calculate_entity_relevance(self, entity, doc) -> float:
        """Calculate relevance score for a named entity."""
        # Entities are inherently important
        base_score = 0.7
        
        # Boost by entity type
        type_boost = {
            'PERSON': 1.3,
            'ORG': 1.2,
            'GPE': 1.1,
            'PRODUCT': 1.2,
            'EVENT': 1.1
        }.get(entity.label_, 1.0)
        
        return min(1.0, base_score * type_boost)
    
    def _deduplicate_concepts(self, concepts: List[ConceptExtraction]) -> List[ConceptExtraction]:
        """Remove duplicate concepts and merge relevance scores."""
        concept_map = {}
        
        for concept in concepts:
            key = concept.concept.lower()
            if key in concept_map:
                # Merge relevance scores
                existing = concept_map[key]
                existing.relevance = max(existing.relevance, concept.relevance)
                
                # Prefer more specific category
                if concept.category == "domain":
                    existing.category = concept.category
            else:
                concept_map[key] = concept
        
        return list(concept_map.values())
    
    def score_concept_coverage(
        self,
        student_answer: str,
        reference_answer: str,
        domain_concepts: Optional[List[str]] = None,
        *,
        request_id: Optional[str] = None
    ) -> Dict:
        """
        Score how well the student answer covers concepts from reference.
        
        Args:
            student_answer: Student's response
            reference_answer: Reference/expected answer
            domain_concepts: Optional predefined domain concepts
            request_id: Optional request ID for logging
            
        Returns:
            Dictionary with coverage score and concept details
        """
        start_time = time.time()
        
        # Extract concepts from both answers
        reference_concepts = self.extract_concepts(reference_answer, domain_concepts)
        student_concepts = self.extract_concepts(student_answer, domain_concepts)
        
        # Calculate coverage
        coverage_score = self._calculate_coverage(reference_concepts, student_concepts)
        
        # Prepare detailed results
        result = {
            "coverage_score": coverage_score,
            "reference_concepts": [c.concept for c in reference_concepts],
            "student_concepts": [c.concept for c in student_concepts],
            "covered_concepts": self._get_covered_concepts(reference_concepts, student_concepts),
            "missing_concepts": self._get_missing_concepts(reference_concepts, student_concepts),
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        logger.debug(
            f"Concept coverage: {coverage_score:.3f} "
            f"(covered: {len(result['covered_concepts'])}, "
            f"missing: {len(result['missing_concepts'])})"
        )
        
        return result
    
    def _calculate_coverage(
        self, 
        reference_concepts: List[ConceptExtraction], 
        student_concepts: List[ConceptExtraction]
    ) -> float:
        """Calculate weighted concept coverage score."""
        if not reference_concepts:
            return 0.0
        
        total_weight = sum(c.relevance for c in reference_concepts)
        covered_weight = 0.0
        
        student_concept_set = set(c.concept.lower() for c in student_concepts)
        
        for ref_concept in reference_concepts:
            if ref_concept.concept.lower() in student_concept_set:
                covered_weight += ref_concept.relevance
        
        coverage = covered_weight / total_weight if total_weight > 0 else 0.0
        
        # Apply threshold-based normalization
        if coverage >= self._concept_threshold:
            return min(1.0, (coverage - self._concept_threshold) / (1.0 - self._concept_threshold))
        else:
            return (coverage / self._concept_threshold) ** 2
    
    def _get_covered_concepts(
        self, 
        reference_concepts: List[ConceptExtraction], 
        student_concepts: List[ConceptExtraction]
    ) -> List[str]:
        """Get list of concepts covered by student."""
        student_set = set(c.concept.lower() for c in student_concepts)
        return [c.concept for c in reference_concepts if c.concept.lower() in student_set]
    
    def _get_missing_concepts(
        self, 
        reference_concepts: List[ConceptExtraction], 
        student_concepts: List[ConceptExtraction]
    ) -> List[str]:
        """Get list of important concepts missing from student answer."""
        student_set = set(c.concept.lower() for c in student_concepts)
        missing = [c.concept for c in reference_concepts if c.concept.lower() not in student_set]
        
        # Sort by relevance (most important missing concepts first)
        missing_with_relevance = [
            (concept, next(c.relevance for c in reference_concepts if c.concept == concept))
            for concept in missing
        ]
        missing_with_relevance.sort(key=lambda x: x[1], reverse=True)
        
        return [concept for concept, _ in missing_with_relevance]

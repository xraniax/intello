"""
Simplified rubric generator using LLM.

Generates complete rubrics from questions + optional context.
"""

import json
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger("engine.scoring.rubric")

# Lazy imports - only load when generating
_stream_ollama_generate = None
_strip_markdown_fences = None


def _load_generation_utils():
    """Lazy load generation utilities."""
    global _stream_ollama_generate, _strip_markdown_fences
    if _stream_ollama_generate is None:
        from services.generation import _stream_ollama_generate as sog
        from services.generation import _strip_markdown_fences as smf
        _stream_ollama_generate = sog
        _strip_markdown_fences = smf


class GenerationStrategy(str, Enum):
    """How the rubric was generated."""
    FROM_CONTEXT = "from_context"
    FROM_QUESTION = "from_question"
    HYBRID = "hybrid"


@dataclass
class GeneratedConcept:
    """A concept that students must demonstrate understanding of."""
    name: str
    description: str
    keywords: List[str] = field(default_factory=list)
    weight: float = 1.0
    required: bool = True
    alternative_phrasings: List[str] = field(default_factory=list)


@dataclass
class GeneratedRubric:
    """Complete rubric for scoring a question."""
    question_id: str
    question_text: str
    reference_answer: str
    concepts: List[GeneratedConcept]
    important_keywords: List[str]
    keyword_synonyms: Dict[str, List[str]]
    difficulty_estimate: str = "medium"
    generation_strategy: GenerationStrategy = GenerationStrategy.HYBRID
    source_context_ids: List[str] = field(default_factory=list)
    confidence_score: float = 0.5
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "question_id": self.question_id,
            "question_text": self.question_text,
            "reference_answer": self.reference_answer,
            "concepts": [
                {
                    "name": c.name,
                    "description": c.description,
                    "keywords": c.keywords,
                    "weight": c.weight,
                    "required": c.required,
                    "alternative_phrasings": c.alternative_phrasings
                }
                for c in self.concepts
            ],
            "important_keywords": self.important_keywords,
            "keyword_synonyms": self.keyword_synonyms,
            "difficulty_estimate": self.difficulty_estimate,
            "generation_strategy": self.generation_strategy.value,
            "source_context_ids": self.source_context_ids,
            "confidence_score": self.confidence_score,
        }


class RubricGenerator:
    """Generates scoring rubrics using LLM."""
    
    def __init__(
        self,
        min_concepts: int = 2,
        max_concepts: int = 6,
        temperature: float = 0.3
    ):
        self.min_concepts = min_concepts
        self.max_concepts = max_concepts
        self.temperature = temperature
        self.model = "llama3.2:3b"  # Or get from config
        
        logger.info("RubricGenerator initialized")
    
    async def generate(
        self,
        question_text: str,
        question_id: str,
        context_chunks: Optional[List[Dict[str, Any]]] = None,
        subject_matter: Optional[str] = None
    ) -> GeneratedRubric:
        """
        Generate a rubric for a question.
        
        Args:
            question_text: The exam question
            question_id: Unique identifier
            context_chunks: Optional learning material chunks
            subject_matter: Optional subject context
        """
        
        # Lazy load generation utilities
        _load_generation_utils()
        
        # Build prompt with context if available
        has_context = bool(context_chunks)
        context_block = ""
        source_ids = []
        
        if context_chunks:
            context_block = "\n\n".join([
                f"[Source {i+1}]: {chunk['content'][:500]}"
                for i, chunk in enumerate(context_chunks[:5])
            ])
            source_ids = [c.get("id", f"chunk-{i}") for i, c in enumerate(context_chunks[:5])]
        
        # Generate via LLM
        prompt = self._build_prompt(
            question_text, question_id, context_block,
            subject_matter, has_context
        )
        
        try:
            response = await _stream_ollama_generate(
                model=self.model,
                prompt=prompt,
                system_prompt="You are an expert educational assessment designer. Respond with valid JSON only.",
                temperature=self.temperature,
                stream=False
            )
            
            # Parse response
            raw_text = _strip_markdown_fences(response.get("response", ""))
            parsed = json.loads(raw_text)
            
            # Build rubric
            concepts = [
                GeneratedConcept(
                    name=c.get("name", "unknown").lower().replace(" ", "_"),
                    description=c.get("description", ""),
                    keywords=c.get("keywords", []),
                    weight=c.get("weight", 1.0),
                    required=c.get("required", True),
                    alternative_phrasings=c.get("alternative_phrasings", [])
                )
                for c in parsed.get("concepts", [])
            ]
            
            rubric = GeneratedRubric(
                question_id=question_id,
                question_text=question_text,
                reference_answer=parsed.get("reference_answer", ""),
                concepts=concepts,
                important_keywords=parsed.get("important_keywords", []),
                keyword_synonyms=parsed.get("keyword_synonyms", {}),
                difficulty_estimate=parsed.get("difficulty", "medium"),
                generation_strategy=GenerationStrategy.HYBRID if has_context else GenerationStrategy.FROM_QUESTION,
                source_context_ids=source_ids,
                confidence_score=0.8 if has_context else 0.6
            )
            
            logger.info(f"Generated rubric for {question_id} with {len(concepts)} concepts")
            return rubric
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            raise RuntimeError(f"Rubric generation failed for {question_id}: invalid JSON")
        except Exception as e:
            logger.error(f"Rubric generation failed: {e}")
            raise
    
    def _build_prompt(
        self,
        question_text: str,
        question_id: str,
        context_block: str,
        subject_matter: Optional[str],
        has_context: bool
    ) -> str:
        """Build LLM prompt."""
        
        subject_line = f"Subject: {subject_matter}\n" if subject_matter else ""
        context_section = f"""
LEARNING MATERIALS:
{context_block}

Use these materials to ensure concepts match course content.""" if has_context else ""
        
        return f"""Create a scoring rubric for this exam question.

QUESTION: {question_text}
{subject_line}{context_section}

Generate JSON:
{{
  "reference_answer": "Comprehensive model answer (2-4 sentences)",
  "concepts": [
    {{
      "name": "concept_identifier",
      "description": "What this concept means in 1-2 sentences",
      "keywords": ["specific_term1", "specific_term2"],
      "weight": 1.0,
      "required": true,
      "alternative_phrasings": ["synonym1"]
    }}
  ],
  "important_keywords": ["specific_term1", "specific_term2"],
  "keyword_synonyms": {{"term1": ["synonym1"]}},
  "difficulty": "medium"
}}

STRICT REQUIREMENTS:
1. Generate EXACTLY {self.min_concepts}-{self.max_concepts} concepts (no more, no less)
2. Each concept must represent a DISTINCT cognitive skill or knowledge area
3. Concepts must NOT be synonyms or near-duplicates of each other
4. Name concepts with snake_case identifiers (e.g., "sql_join_types", "database_normalization")
5. Descriptions must explain what understanding looks like (not just define the term)
6. Keywords must be SPECIFIC technical terms from the subject, not generic words
7. At least ONE concept should have weight 1.5 (most important), others 1.0
8. Reference answer must demonstrate ALL concepts you list

BAD examples of duplicate concepts:
- "sql_joins" and "database_joins" (synonyms)
- "inner_join" and "join_types" (one is subset of other)

GOOD examples of distinct concepts:
- "sql_join_types" (knowledge: can name types)
- "join_use_cases" (application: knows when to use which)
- "join_syntax" (skill: can write correct syntax)

Respond with valid JSON only."""

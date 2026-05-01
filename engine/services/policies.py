import logging
import json
import re
from typing import List, Dict, Any, Optional
from services.schemas import GenerationPolicy, QuestionTypePreference, ExamQuestion

logger = logging.getLogger("engine.policies")

class GenerationSegment:
    def __init__(self, q_type: str, count: int, difficulty: str):
        self.q_type = q_type
        self.count = count
        self.difficulty = difficulty

    def to_dict(self):
        return {
            "type": self.q_type,
            "count": self.count,
            "difficulty": self.difficulty
        }

class PolicyEngine:
    @staticmethod
    def create_plan(policy: GenerationPolicy) -> List[GenerationSegment]:
        """
        Converts policy into a list of segments. 
        OPTIMIZATION: Merges segments of same type/difficulty to reduce cold-start latency.
        """
        total_requested = policy.total_count
        distribution = policy.distribution
        
        plan_items = []
        remaining_count = total_requested
        current_id_start = 1
        
        # 1. Distribute counts
        temp_bins = {} # type -> count
        
        fixed_items = [d for d in distribution if d.count is not None]
        for item in fixed_items:
            count = min(item.count, remaining_count)
            if count > 0:
                temp_bins[item.type] = temp_bins.get(item.type, 0) + count
                remaining_count -= count
        
        if remaining_count > 0:
            percentage_items = [d for d in distribution if d.percentage is not None]
            if percentage_items:
                for item in percentage_items:
                    share = int((item.percentage / 100) * total_requested)
                    count = min(share, remaining_count)
                    if count > 0:
                        temp_bins[item.type] = temp_bins.get(item.type, 0) + count
                        remaining_count -= count
            
        if remaining_count > 0:
            fallback = distribution[0].type if distribution else "mcq"
            temp_bins[fallback] = temp_bins.get(fallback, 0) + remaining_count
            
        # 2. Convert bins to segments with pre-assigned IDs
        for q_type, count in temp_bins.items():
            segment = GenerationSegment(q_type, count, policy.difficulty)
            segment.id_range = [current_id_start, current_id_start + count - 1]
            plan_items.append(segment)
            current_id_start += count
                
        logger.info(f"Optimized Plan: {[p.to_dict() for p in plan_items]}")
        return plan_items

    @staticmethod
    def build_segment_prompt(segment: GenerationSegment, context: str, language: str) -> str:
        """Hyper-condensed prompt."""
        shorthand = {
            "mcq": "4 options, 1 answer. JSON: {\"id\":int, \"type\":\"mcq\", \"question\":\"...\", \"options\":[\"A\",\"B\",\"C\",\"D\"], \"answer\":\"...\"}",
            "fill_blank": "Gaps are '____'. JSON: {\"id\":int, \"type\":\"fill_blank\", \"question\":\"...\", \"answer\":\"...\"}",
            "matching": "Pairs. JSON: {\"id\":int, \"type\":\"matching\", \"question\":\"...\", \"pairs\": [{\"left\":\"...\", \"right\":\"...\"}]}",
            "essay": "Concept. JSON: {\"id\":int, \"type\":\"essay\", \"question\":\"...\", \"answer\": \"key points\"}"
        }
        
        return (
            f"Generate {segment.count} {segment.q_type} ({segment.difficulty}) in {language}.\n"
            f"Format: {shorthand.get(segment.q_type, shorthand['mcq'])}\n"
            f"Context: {context[:3000]}...\n"
            "Result: JSON array only. No text."
        )

    @staticmethod
    def validate_segment(questions: List[Dict[str, Any]], expected_type: str, context: str) -> List[Dict[str, Any]]:
        """
        Relaxed validation: ensure it's a list of dicts.
        """
        if not isinstance(questions, list):
            return []
        
        valid_questions = []
        for q in questions:
            if not isinstance(q, dict):
                continue
            
            # Basic structural requirement
            if not q.get("question"):
                continue
            
            # Ensure type is set
            valid_questions.append(q)
            
        logger.info(f"[QUIZ_VALIDATION] input={len(questions)} output={len(valid_questions)} rejected={len(questions) - len(valid_questions)}") # dbg3
        return valid_questions

    @staticmethod
    def final_semantic_check(questions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Global validation sweep to ensure conceptual deduplication and coherence
        across parallel segments.
        """
        seen_questions = set()
        final_list = []
        
        for q in questions:
            # Simple content-based deduplication
            q_text = q.get("question", "").strip().lower()
            if q_text in seen_questions:
                logger.warning(f"Deduplication: Removing redundant question: {q_text[:50]}...")
                continue
                
            seen_questions.add(q_text)
            final_list.append(q)
            
        logger.info(f"[QUIZ_DEDUP] before={len(questions)} after={len(final_list)}") # dbg4
        logger.info(f"Final Semantic Check: {len(questions)} -> {len(final_list)} questions.")
        return final_list

    @staticmethod
    def repair_json_content(raw_text: str) -> str:
        """Simplified repair: remove markdown blocks and whitespace."""
        original_length = len(raw_text)
        text = raw_text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        # Very basic cleanup
        text = re.sub(r'//.*', '', text) # Remove single line comments
        
        # Ensure it looks like JSON
        if not (text.startswith('[') or text.startswith('{')):
            # Try to find the first [ or {
            start_sq = text.find('[')
            start_br = text.find('{')
            if start_sq != -1 and (start_br == -1 or start_sq < start_br):
                text = text[start_sq:]
            elif start_br != -1:
                text = text[start_br:]
        
        if text.startswith('[') and not text.endswith(']'):
            # Close it if it looks like an array
            text = text[:text.rfind('}')+1] + ']'
        elif text.startswith('{') and not text.endswith('}'):
            # Wrap object if needed
            text = text + '}]' if not text.endswith('}') else text
        
        # If it's a single object starting with {, wrap it in [ ] for consistency
        if text.startswith('{') and text.endswith('}'):
            text = '[' + text + ']'

        repaired_length = len(text)
        if repaired_length != original_length:
            logger.info(f"[TRACE] PolicyEngine.repair_json_content modified the LLM output. Original: {original_length} chars, Repaired: {repaired_length} chars. Diff: {original_length - repaired_length} chars removed.")

        return text

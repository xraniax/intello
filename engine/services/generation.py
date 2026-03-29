import os
import json
import logging
from typing import List, Optional, Dict, Any, Union

import requests
from requests.exceptions import RequestException, Timeout

logger = logging.getLogger("engine-generation")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama_gpu:11434").rstrip("/")
OLLAMA_GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"
OLLAMA_GENERATION_MODEL = os.getenv("OLLAMA_GENERATION_MODEL", "dreamingbumblebee/qwen2.5vl-3b-qlora-ko-1.5k_q4_k_m")

OLLAMA_GENERATION_TIMEOUT = int(os.getenv("OLLAMA_GENERATION_TIMEOUT", "300"))
OLLAMA_CHAT_TIMEOUT = int(os.getenv("OLLAMA_CHAT_TIMEOUT", "120"))
OLLAMA_MAX_CONTEXT_CHARS = int(os.getenv("OLLAMA_MAX_CONTEXT_CHARS", "15000"))

def build_prompt(material_type: str, context: str, topic: Optional[str], language: str) -> str:
    """Build a structured prompt for the LLM based on material type."""
    
    json_format_instructions = "Return ONLY valid JSON. Do not include any markdown formatting, pre-amble, or post-amble."

    if material_type == "summary":
        base_instructions = f"Provide a comprehensive summary of the given context in {language}. Format the output in clear paragraphs."
        prompt = (
            f"System instructions:\n{base_instructions}\n"
            f"Context:\n---\n{context}\n---\n\n"
            f"Generate the summary now:"
        )
        return prompt

    elif material_type == "quiz":
        base_instructions = (
            f"Generate a multiple-choice or short-answer quiz based on the context in {language}. "
            f"Include {5} questions. For each question, provide options (if MCQ), the correct answer, and a short explanation."
        )
        json_structure = {
            "type": "quiz",
            "questions": [
                {
                    "id": 1,
                    "question": "Question text?",
                    "options": ["A", "B", "C", "D"],
                    "correct_answer": "A",
                    "explanation": "Why A is correct"
                }
            ]
        }
        base_instructions += f"\nOutput MUST be a JSON object following this structure: {json.dumps(json_structure)}"

    elif material_type == "flashcards":
        base_instructions = f"Create a set of 5-10 flashcards (Front/Back) based on the context in {language}."
        json_structure = {
            "type": "flashcards",
            "cards": [
                {"front": "Question/Term", "back": "Answer/Definition"}
            ]
        }
        base_instructions += f"\nOutput MUST be a JSON object following this structure: {json.dumps(json_structure)}"

    elif material_type == "exam":
        base_instructions = (
            f"Create an exam based on the context in {language}. "
            f"Include 5 questions. Each question must have an 'answer_space' (e.g. '__________'). "
            f"DO NOT include answers in the questions list. "
            f"Provide a SEPARATE 'answer_sheet' section with 'question_id', 'answer', and 'explanation'."
        )
        json_structure = {
            "type": "exam",
            "questions": [
                {"question": "Question text?", "answer_space": "__________"}
            ],
            "answer_sheet": [
                {"question_id": 1, "answer": "The answer", "explanation": "Explanation"}
            ]
        }
        base_instructions += f"\nOutput MUST be a JSON object following this structure: {json.dumps(json_structure)}"
    else:
        base_instructions = f"Process the given context and generate {material_type} in {language}."

    topic_focus = f"\nFocus specifically on the topic: '{topic}'." if topic else ""

    prompt = (
        f"System instructions:\n{base_instructions}{topic_focus}\n{json_format_instructions}\n\n"
        f"Context:\n---\n{context}\n---\n\n"
        f"Generate the {material_type} JSON now:"
    )
    return prompt

def generate_study_material(
    chunks: List[str],
    material_type: str,
    topic: Optional[str] = None,
    language: str = "en",
    timeout: int = OLLAMA_GENERATION_TIMEOUT,
    retries: int = 1
) -> Union[str, Dict[str, Any]]:
    """Combine chunks into context and call Ollama to generate study material."""
    if not chunks:
        return "Not enough context to generate material."

    # Combine chunks, limit to MAX_CHARS to prevent context overflow
    MAX_CHARS = OLLAMA_MAX_CONTEXT_CHARS
    context = "\n\n".join(chunks)
    if len(context) > MAX_CHARS:
        context = context[:MAX_CHARS] + "...\n[Context truncated due to length]"

    prompt = build_prompt(material_type, context, topic, language)

    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json" if material_type != "summary" else None
    }

    for attempt in range(retries):
        try:
            logger.info(f"Requesting '{material_type}' generation from Ollama (attempt {attempt + 1}/{retries})")
            response = requests.post(OLLAMA_GENERATE_URL, json=payload, timeout=timeout)
            response.raise_for_status()
            
            response_data = response.json()
            generated_text = response_data.get("response")
            
            if not generated_text:
                logger.warning("Ollama generation response missing 'response' field.")
                raise ValueError("No response returned by Ollama")
            
            generated_text = generated_text.strip()
            
            if material_type == "summary":
                return generated_text
            
            # Parsing/validation layer
            try:
                # Clean up potential markdown code blocks if LLM ignored instructions
                if "```json" in generated_text:
                    generated_text = generated_text.split("```json")[1].split("```")[0].strip()
                elif "```" in generated_text:
                    generated_text = generated_text.split("```")[1].split("```")[0].strip()
                
                parsed_json = json.loads(generated_text)
                
                # Structural validation
                from .schemas import ExamOutput, QuizOutput, FlashcardsOutput
                from pydantic import ValidationError
                
                try:
                    if material_type == "quiz":
                        parsed_json = QuizOutput(**parsed_json).model_dump()
                    elif material_type == "exam":
                        parsed_json = ExamOutput(**parsed_json).model_dump()
                    elif material_type == "flashcards":
                        parsed_json = FlashcardsOutput(**parsed_json).model_dump()
                except ValidationError as ve:
                    logger.error(f"Structural validation failed for {material_type}: {ve}")
                    if attempt == retries - 1:
                        return {"error": "Invalid structure from LLM", "raw": generated_text, "details": str(ve)}
                    continue # Retry on validation error

                return parsed_json
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON for {material_type}: {e}")
                if attempt == retries - 1:
                    # Fallback or re-raise
                    return {"error": "Invalid JSON format from LLM", "raw": generated_text}
                
        except Timeout:
            logger.warning(f"Ollama generation request timed out (attempt {attempt + 1}/{retries})")
            if attempt == retries - 1:
                raise
        except RequestException as err:
            logger.warning(f"Ollama generation request failed (attempt {attempt + 1}/{retries}): {err}")
            if hasattr(err, 'response') and err.response is not None:
                logger.error(f"Ollama error response: {err.response.text}")
            if attempt == retries - 1:
                raise

    raise RuntimeError("All generation retry attempts failed")

def generate_chat_response(
    context: str,
    question: str,
    language: str = "en",
    timeout: int = OLLAMA_CHAT_TIMEOUT,
    retries: int = 1
) -> str:
    """Generate a conversational response based on context."""
    prompt = (
        f"System instructions: Answer the user's question clearly and concisely based on the provided context in {language}. "
        f"If the answer is not in the context, say you don't know based on the provided material.\n\n"
        f"Context:\n---\n{context}\n---\n\n"
        f"User Question: {question}\n"
        f"Response:"
    )

    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
        "stream": False
    }

    for attempt in range(retries):
        try:
            logger.info(f"Requesting chat response from Ollama (attempt {attempt + 1}/{retries})")
            response = requests.post(OLLAMA_GENERATE_URL, json=payload, timeout=timeout)
            response.raise_for_status()
            
            response_data = response.json()
            return response_data.get("response", "").strip()
            
        except Timeout:
            logger.warning(f"Ollama chat request timed out (attempt {attempt + 1}/{retries})")
            if attempt == retries - 1:
                raise
        except RequestException as err:
            logger.warning(f"Ollama chat request failed (attempt {attempt + 1}/{retries}): {err}")
            if attempt == retries - 1:
                raise

    raise RuntimeError("All chat retry attempts failed")

def evaluate_quiz(questions: List[Dict[str, Any]], submissions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compare user answers with correct answers and return color-coded results.
    """
    results = []
    
    # Create a mapping for quick lookup
    question_map = {q["id"]: q for q in questions}
    
    for sub in submissions:
        q_id = sub.get("question_id")
        user_ans = sub.get("user_answer", "").strip().lower()
        
        q = question_map.get(q_id)
        if not q:
            continue
            
        correct_ans = str(q.get("correct_answer", "")).strip().lower()
        is_correct = user_ans == correct_ans
        
        result = {
            "question_id": q_id,
            "status": "correct" if is_correct else "wrong",
            "color": "green" if is_correct else "red",
        }
        
        if not is_correct:
            result["explanation"] = q.get("explanation", "Incorrect answer.")
            
        results.append(result)
        
    return {
        "type": "quiz_result",
        "results": results
    }

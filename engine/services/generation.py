import os
import json
import logging
from typing import List, Optional, Dict, Any, Union

import requests
from requests.exceptions import RequestException, Timeout

import logging
import time
import tiktoken
from utils.logging import get_job_logger

logger = logging.getLogger("engine-generation")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama_gpu:11434").rstrip("/")
OLLAMA_GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"
OLLAMA_GENERATION_MODEL = os.getenv("OLLAMA_GENERATION_MODEL", "qwen2:0.5b")

OLLAMA_GENERATION_TIMEOUT = int(os.getenv("OLLAMA_GENERATION_TIMEOUT", "300"))
OLLAMA_CHAT_TIMEOUT = int(os.getenv("OLLAMA_CHAT_TIMEOUT", "120"))
OLLAMA_MAX_CONTEXT_CHARS = int(os.getenv("OLLAMA_MAX_CONTEXT_CHARS", "6000"))

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
            f"Create a {language} quiz with 5 multiple-choice questions. "
            f"IMPORTANT: Each question MUST have exactly 4 choices."
        )
        json_structure = {
            "type": "quiz",
            "questions": [
                {
                    "id": 1,
                    "question": "Sample Question?",
                    "options": ["A", "B", "C", "D"],
                    "correct_answer": "A",
                    "explanation": "Why A is correct."
                }
            ]
        }
        prompt = (
            f"Context:\n{context}\n\n"
            f"Task: {base_instructions}\n"
            f"Output JSON format:\n{json.dumps(json_structure, indent=2)}\n"
            f"Generate now:"
        )
        return prompt

    elif material_type == "flashcards":
        base_instructions = f"Create a set of 5-8 flashcards (Front/Back) based on the context in {language}."
        json_structure = {
            "type": "flashcards",
            "cards": [
                {"front": "Photosynthesis", "back": "The process by which green plants and some other organisms use sunlight to synthesize foods with the help of chlorophyll."}
            ]
        }
        base_instructions += f"\nExample JSON output:\n{json.dumps(json_structure, indent=2)}"

    elif material_type == "exam":
        base_instructions = (
            f"Create a {language} mock exam with 5 questions. "
            f"Questions should be challenging. "
            f"Provide a separate 'answer_sheet' where 'question_id' matches the question number (1-5)."
        )
        json_structure = {
            "type": "exam",
            "questions": [
                {"question": "Question text?", "answer_space": "__________"}
            ],
            "answer_sheet": [
                {"question_id": 1, "answer": "The correct answer.", "explanation": "Why it is correct."}
            ]
        }
        prompt = (
            f"Context:\n{context}\n\n"
            f"Task: {base_instructions}\n"
            f"Output JSON format:\n{json.dumps(json_structure, indent=2)}\n"
            f"Generate now:"
        )
        return prompt
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
    retries: int = 1,
    job_id: Optional[str] = None,
) -> Union[str, Dict[str, Any]]:
    """Combine chunks into context and call Ollama to generate study material."""
    log = get_job_logger(job_id, "engine-generation")
    log.info(f"STEP: GENERATION STARTED for type={material_type}, topic='{topic}'")
    start_time = time.perf_counter()

    if not chunks:
        log.warning("STEP: GENERATION FAILED - Not enough context")
        return "No content available for this subject"

    # Combine chunks, limit to MAX_CHARS to prevent context overflow
    MAX_CHARS = OLLAMA_MAX_CONTEXT_CHARS
    context = "\n\n".join(chunks)
    if len(context) > MAX_CHARS:
        context = context[:MAX_CHARS] + "...\n[Context truncated due to length]"

    prompt = build_prompt(material_type, context, topic, language)
    
    # Token count estimation
    try:
        encoding = tiktoken.get_encoding("cl100k_base")
        tokens_count = len(encoding.encode(prompt))
    except Exception:
        # Fallback to heuristic
        tokens_count = len(prompt) // 4

    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json" if material_type != "summary" else None
    }

    for attempt in range(retries):
        try:
            log.info(f"Requesting '{material_type}' generation from Ollama (attempt {attempt + 1}/{retries}). Est. tokens: {tokens_count}")
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
                
                # Structural repair layer - handle common LLM hallucinations
                if material_type == "quiz":
                    if "quiz_questions" in parsed_json: parsed_json["questions"] = parsed_json.pop("quiz_questions")
                    if "quiz" in parsed_json and not isinstance(parsed_json["quiz"], str): 
                        parsed_json["questions"] = parsed_json.pop("quiz")
                    
                    if "questions" in parsed_json and isinstance(parsed_json["questions"], list):
                        for i, q in enumerate(parsed_json["questions"]):
                            if "question_id" in q: q["id"] = q.pop("question_id")
                            if "id" not in q: q["id"] = i + 1
                            if "title" in q: q["question"] = q.pop("title")
                            if "answer" in q: q["correct_answer"] = q.pop("answer")
                            if "choices" in q: q["options"] = q.pop("choices")
                            if "options" not in q: q["options"] = []
                            if "explanation" not in q: q["explanation"] = "Generated by AI."
                
                elif material_type == "flashcards":
                    if "flashcards" in parsed_json: parsed_json["cards"] = parsed_json.pop("flashcards")
                
                elif material_type == "exam":
                    if "exam_questions" in parsed_json: parsed_json["questions"] = parsed_json.pop("exam_questions")
                    if "questions" in parsed_json:
                        for q in parsed_json["questions"]:
                            if "text" in q: q["question"] = q.pop("text")
                            if "answer_space" not in q: q["answer_space"] = "____________________"
                
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
                        # Raise exception so the task is marked as FAILED in Celery/Backend
                        raise ValueError(f"AI generated invalid structure for {material_type} and could not be repaired: {ve}")
                    continue # Retry on validation error

                duration = time.perf_counter() - start_time
                log.info(f"STEP: GENERATION SUCCESS (duration: {duration:.2f}s, tokens sent: {tokens_count})")
                return parsed_json
            except json.JSONDecodeError as e:
                log.error(f"Failed to parse JSON for {material_type}: {e}")
                if attempt == retries - 1:
                    log.error(f"STEP: GENERATION FAILED - JSON parse error")
                    # Fallback or re-raise
                    return {"error": "Invalid JSON format from LLM", "raw": generated_text}
                
        except Timeout:
            log.warning(f"Ollama generation request timed out (attempt {attempt + 1}/{retries})")
            if attempt == retries - 1:
                log.error(f"STEP: GENERATION FAILED - Timeout")
                raise
        except RequestException as err:
            log.warning(f"Ollama generation request failed (attempt {attempt + 1}/{retries}): {err}")
            if hasattr(err, 'response') and err.response is not None:
                log.error(f"Ollama error response: {err.response.text}")
            if attempt == retries - 1:
                log.error(f"STEP: GENERATION FAILED - Request error")
                raise

    log.error("STEP: GENERATION FAILED - All retries failed")
    raise RuntimeError("All generation retry attempts failed")

def generate_chat_response(
    context: str,
    question: str,
    language: str = "en",
    timeout: int = OLLAMA_GENERATION_TIMEOUT,
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

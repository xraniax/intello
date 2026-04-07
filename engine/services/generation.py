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

import re

def clean_text(text: Any) -> str:
    """Strip hallucinated prefixes like 'Question 1:', 'Answer:', '1.' from text."""
    if not isinstance(text, str):
        return str(text)
    
    # Remove leading numbering/prefixes: "1. ", "Question 1: ", "Q: ", "A: ", "Answer: "
    text = re.sub(r"^(?i)(question|answer|q|a|flashcard|card)\s*\d*[:.-]?\s*", "", text.strip())
    text = re.sub(r"^\d+[:.-]?\s+", "", text)
    return text.strip()

def build_prompt(material_type: str, context: str, topic: Optional[str], language: str, options: Optional[Dict[str, Any]] = None) -> str:
    """Build a structured prompt for the LLM based on material type."""
    
    json_format_instructions = "Return ONLY valid JSON. Do not include any markdown formatting, pre-amble, or post-amble."

    if material_type == "summary":
        base_instructions = (
            f"Provide a comprehensive, high-quality summary of the given context in {language}. "
            "IMPORTANT: Structure the content using Markdown:\n"
            "- Start with a # Clear Title\n"
            "- Use ## for major conceptual sections\n"
            "- Use ### for sub-topics\n"
            "- Use bullet points (- ) and **bold** for key terms\n"
            "- Use > for critical highlights or 'Key Takeaways'."
        )
        prompt = (
            f"System instructions:\n{base_instructions}\n"
            f"Context:\n---\n{context}\n---\n\n"
            f"Generate the structured summary now:"
        )
        return prompt

    elif material_type == "quiz":
        opts = options or {}
        try:
            quiz_count = int(opts.get("count", 5))
        except (ValueError, TypeError):
            quiz_count = 5
        quiz_count = max(1, min(quiz_count, 50))  # Clamp to safe range
        
        difficulty = opts.get("difficulty", "Default")
        difficulty_map = {
            "Default": "well-balanced questions covering fundamental concepts",
            "Hard": "challenging questions focusing on application, analysis, and complex relationships",
            "Expert": "highly technical and nuanced questions requiring absolute mastery and critical thinking"
        }
        level_desc = difficulty_map.get(difficulty, "well-balanced questions")
        
        base_instructions = (
            f"Create a {language} quiz with EXACTLY {quiz_count} multiple-choice questions at a {level_desc} difficulty level. "
            f"CRITICAL RULES:\n"
            f"1. You MUST generate EXACTLY {quiz_count} question objects in the 'questions' array.\n"
            f"2. Each question MUST have exactly 4 choices.\n"
            f"3. DO NOT include indices like 'Question 1:' or '1.' inside the question text or options."
        )
        json_structure = {
            "type": "quiz",
            "questions": [
                {
                    "id": 1,
                    "question": "Question text here?",
                    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
                    "correct_answer": "Option 1",
                    "explanation": "Why Option 1 is correct."
                }
            ]
        }
        prompt = (
            f"Context:\n{context}\n\n"
            f"Task: {base_instructions}\n"
            f"Output JSON shape (generate {quiz_count} of these question objects):\n{json.dumps(json_structure, indent=2)}\n"
            f"Important: Return ONLY valid JSON. No preamble. No markdown code blocks.\n"
            f"Generate now:"
        )
        return prompt

    elif material_type == "flashcards":
        opts = options or {}
        card_count = opts.get("count", "5-8")
        difficulty = opts.get("difficulty", "Default")
        card_type = opts.get("cardType", "mixed")
        
        difficulty_map = {
            "Default": "standard educational depth",
            "Hard": "advanced depth, focusing on complex relationships, edge cases, and technical nuances",
            "Expert": "extreme depth, targeting absolute mastery of subtle details, advanced theory, and highly technical concepts"
        }
        level_desc = difficulty_map.get(difficulty, "standard educational depth")
        
        try:
            count_int = int(card_count)
        except ValueError:
            count_int = 10
            
        type_instructions = {
            "definition": "Focus strictly on Term/Definition pairs. The 'question' should be the term, and the 'answer' should be the clear, concise definition.",
            "Q&A": "Focus strictly on Question/Answer pairs. Use complete, thought-provoking questions and provide comprehensive answers.",
            "conceptual": "Focus on deep conceptual questions and reasoning. Test the user's understanding of 'why' and 'how' rather than just 'what'.",
            "mixed": "Use a healthy mix of definitions, Q&A, and conceptual reasoning to provide a 360-degree understanding."
        }
        type_str = type_instructions.get(card_type, type_instructions["mixed"])
        
        # Determine examples based on type
        examples = {
            "definition": {"q": "Semantic Memory", "a": "A type of long-term memory involving the capacity to recall words, concepts, or numbers, which is essential for the use and understanding of language."},
            "Q&A": {"q": "What is the primary difference between long-term and short-term memory?", "a": "Short-term memory has a limited capacity (approx. 7 items) and duration (seconds), while long-term memory has an almost infinite capacity and can last for a lifetime."},
            "conceptual": {"q": "How does the 'Spacing Effect' optimize long-term retention compared to cramming?", "a": "By introducing intervals between study sessions, the brain is forced to retrieve information multiple times, strengthening the neural pathways and preventing the rapid decay associated with massed practice."},
            "mixed": {"q": "Neuroplasticity", "a": "The ability of the brain to form and reorganize synaptic connections, especially in response to learning or experience or following injury."}
        }
        ex = examples.get(card_type, examples["mixed"])

        base_instructions = (
            f"Create a set of {count_int} flashcards at an {level_desc}. {type_str}\n"
            f"CRITICAL RULES:\n"
            f"1. You MUST generate EXACTLY {count_int} objects in a JSON array. Do not stop until you have reached item number {count_int}.\n"
            f"2. NEVER use index numbers like '1.' or 'Question 1:' inside the 'question' or 'answer' strings.\n"
            f"3. Ensure all cards are meaningful and concise.\n"
            f"4. Avoid generic phrases like 'this concept refers to...'\n"
            f"5. Do not repeat the same card twice.\n"
            f"6. Output ONLY a valid JSON array. Each item must have: question, answer."
        )
        
        json_str = "[\n  {\n    \"question\": \"" + ex['q'] + "\",\n    \"answer\": \"" + ex['a'] + "\"\n  },\n  // ... generate exactly " + str(count_int) + " objects total in this array\n]"
        base_instructions += f"\nFollow this exact JSON Array structure precisely and generate EXACTLY {count_int} cards (no markdown, just the array):\n{json_str}\n"

        prompt = (
            f"Context:\n{context}\n\n"
            f"Task: {base_instructions}\n"
            f"Output JSON shape (generate {count_int} cards):\n{json_str}\n"
            f"Important: Return ONLY valid JSON. No preamble. No markdown code blocks.\n"
            f"Generate now:"
        )
        return prompt

    elif material_type == "exam":
        opts = options or {}
        try:
            exam_count = int(opts.get("count", 5))
        except (ValueError, TypeError):
            exam_count = 5
        exam_count = max(1, min(exam_count, 20))  # Exams are more complex, cap at 20
        
        difficulty = opts.get("difficulty", "Intermediate")
        difficulty_map = {
            "Introductory": "fundamental concepts, core definitions, and basic recognition questions",
            "Intermediate": "application of concepts, identifying relationships, and multi-step reasoning",
            "Advanced": "complex problem solving, advanced synthesis of topics, and challenging edge-case scenarios",
            "Default": "comprehensive questions covering all key topics",
            "Hard": "advanced questions testing deep integration of concepts and critical problem solving",
            "Expert": "expert-level challenge featuring extremely technical scenarios and sophisticated reasoning"
        }
        level_desc = difficulty_map.get(difficulty, "comprehensive questions")
        
        # Extract requested types
        requested_types = opts.get("examTypes", ["single_choice", "multiple_select", "short_answer"])
        types_str = ", ".join(requested_types)

        base_instructions = (
            f"Create a {language} mock exam with EXACTLY {exam_count} questions at a {level_desc} difficulty level. "
            f"Allowed question types: {types_str}. "
            f"Questions should be challenging, professional, and strictly based on the provided context. "
            f"Provide a separate 'answer_sheet' where 'question_id' matches the question number (1-{exam_count})."
        )
        json_structure = {
            "type": "exam",
            "questions": [
                {"id": 1, "type": "single_choice", "question": "Question text?", "options": ["A", "B", "C", "D"], "answer_space": "__________"}
            ],
            "answer_sheet": [
                {"question_id": 1, "answer": "The correct answer.", "explanation": "Why it is correct."}
            ]
        }
        prompt = (
            f"Context:\n{context}\n\n"
            f"Task: {base_instructions}\n"
            f"Output JSON shape example:\n{json.dumps(json_structure, indent=2)}\n"
            f"Important: Return ONLY valid JSON. No preamble. No markdown code blocks.\n"
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
    stream: bool = False,
    options: Optional[Dict[str, Any]] = None
) -> Union[str, Dict[str, Any], Any]:
    """Combine chunks into context and call Ollama to generate study material."""
    log = get_job_logger(job_id, "engine-generation")
    log.info(f"STEP: GENERATION STARTED for type={material_type}, topic='{topic}', options={options}")
    start_time = time.perf_counter()

    if not chunks:
        log.warning("STEP: GENERATION FAILED - Not enough context")
        return "No content available for this subject"

    # Combine chunks, limit to MAX_CHARS to prevent context overflow
    MAX_CHARS = OLLAMA_MAX_CONTEXT_CHARS
    context = "\n\n".join(chunks)
    if len(context) > MAX_CHARS:
        context = context[:MAX_CHARS] + "...\n[Context truncated due to length]"

    prompt = build_prompt(material_type, context, topic, language, options=options)
    
    if material_type != "summary":
        prompt += "\nOutput your response starting exactly with the '{' character."
    
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
        "stream": stream,
        "options": {
            "num_predict": 2048,  # Allow for long generation of up to 30-50 flashcards
            "temperature": 0.3,   # Lower temperature for more consistent JSON structure
        }
    }

    for attempt in range(retries):
        try:
            if stream:
                log.info(f"Ollama streaming enabled for {job_id}")
                return requests.post(OLLAMA_GENERATE_URL, json=payload, timeout=timeout, stream=True)

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
            
            # ... (parsing logic remains same)
            
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
                        valid_questions = []
                        for i, q in enumerate(parsed_json["questions"]):
                            if not isinstance(q, dict): continue
                            if "question_id" in q: q["id"] = q.pop("question_id")
                            if "id" not in q: q["id"] = i + 1
                            if "title" in q: q["question"] = q.pop("title")
                            if "answer" in q: q["correct_answer"] = q.pop("answer")
                            if "choices" in q: q["options"] = q.pop("choices")
                            
                            # Filter incomplete questions
                            if q.get("question") and q.get("correct_answer") and q.get("options") and len(q["options"]) >= 2:
                                q["question"] = clean_text(q["question"])
                                q["correct_answer"] = clean_text(q["correct_answer"])
                                q["options"] = [clean_text(o) for o in q["options"]]
                                if "explanation" in q: q["explanation"] = clean_text(q["explanation"])
                                else: q["explanation"] = "Generated by AI."
                                valid_questions.append(q)
                        
                        opts = options if options is not None else {}
                        try:
                            target_count = int(opts.get("count", len(valid_questions)))
                        except (ValueError, TypeError):
                            target_count = len(valid_questions)
                        
                        target_count_int = max(1, min(int(target_count), 50))
                        
                        if len(valid_questions) > target_count_int:
                            valid_questions = valid_questions[:target_count_int]
                        elif len(valid_questions) < target_count_int and len(valid_questions) > 0:
                            missing = target_count_int - len(valid_questions)
                            logger.warning(f"STEP: QUIZ shortfall - generated {len(valid_questions)}, need {target_count_int}. Padding {missing} questions.")
                            for i in range(missing):
                                base_q = valid_questions[i % len(valid_questions)]
                                new_q = base_q.copy()
                                new_q["id"] = len(valid_questions) + 1
                                new_q["question"] = f"{base_q['question']} (Variant {i+2})"
                                valid_questions.append(new_q)
                        
                        parsed_json["questions"] = valid_questions
                
                elif material_type == "flashcards":
                    raw_cards = parsed_json if isinstance(parsed_json, list) else parsed_json.get("cards", parsed_json.get("flashcards", []))
                    
                    if isinstance(raw_cards, list) or isinstance(raw_cards, dict):
                        # Force iteration if someone sent {"1": {...}, "2": {...}}
                        iterable_cards = raw_cards.values() if isinstance(raw_cards, dict) else raw_cards
                        
                        valid_cards = []
                        for c in iterable_cards:
                            if not isinstance(c, dict): continue
                            f = str(c.get("question", c.get("front", c.get("text", "")))).strip()
                            b = str(c.get("answer", c.get("back", c.get("solution", "")))).strip()
                            
                            # Filter empty or placeholder-like cards
                            if f and b and not f.startswith("Key Concept") and not f.startswith("Term 1") and not f.startswith("Question 1"):
                                valid_cards.append({"question": clean_text(f), "answer": clean_text(b)})
                        
                        opts = options if options is not None else {}
                        try:
                            target_count = int(opts.get("count", len(valid_cards)))
                        except (ValueError, TypeError):
                            target_count = len(valid_cards)
                        
                        target_count_int = int(target_count)
                        if len(valid_cards) > target_count_int:
                            valid_cards = valid_cards[:target_count_int]
                            
                        elif len(valid_cards) < target_count_int and len(valid_cards) > 0:
                            missing = target_count_int - len(valid_cards)
                            logger.warning(f"STEP: GENERATION shortfall - generated {len(valid_cards)}, need {target_count_int}. Padding {missing} cards locally.")
                            base_cards_copy = list(valid_cards)
                            for i in range(missing):
                                base_card = base_cards_copy[i % len(base_cards_copy)]
                                valid_cards.append({
                                    "question": f"{base_card['question']} (Continued Part {i+2})",
                                    "answer": f"Further implications: {base_card['answer']}"
                                })
                        
                        # Set parsed_json back to simply the valid array
                        parsed_json = valid_cards
                
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
                        # Bypass Pydantic validation if we already manually verified the array shape.
                        if not isinstance(parsed_json, list):
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

def evaluate_answer_semantically(
    question: str, 
    correct_answer: str, 
    user_answer: str,
    language: str = "en",
    timeout: int = OLLAMA_GENERATION_TIMEOUT
) -> Dict[str, Any]:
    """
    Use LLM to compare user answer with correct answer semantically.
    Returns { is_correct, is_almost, explanation, score }
    """
    prompt = (
        f"You are an expert academic grader. Evaluate the student's answer based on the question and the correct reference answer.\n\n"
        f"Question: {question}\n"
        f"Correct Reference Answer: {correct_answer}\n"
        f"Student's Answer: {user_answer}\n\n"
        f"Grading Philosophy:\n"
        f"- Prioritize conceptual understanding and logical accuracy over exact phrasing or dictionary matching.\n"
        f"- If the student's answer is logically equivalent or demonstrates the same level of understanding as the reference, mark it as correct.\n"
        f"- Be lenient with formatting, minor grammatical errors, or synonyms.\n"
        f"- An 'almost' answer is one that is on the right track but misses a key technical detail or is too vague.\n\n"
        f"Output Requirements:\n"
        f"1. 'is_correct': true if the answer is conceptually sound (score >= 0.85).\n"
        f"2. 'is_almost': true if the answer is partially correct (score between 0.5 and 0.84).\n"
        f"3. 'score': A float between 0.0 and 1.0.\n"
        f"4. 'explanation': A short, helpful sentence explaining the grade.\n\n"
        f"Output EXACTLY this JSON format:\n"
        f"{{\n"
        f"  \"is_correct\": true/false,\n"
        f"  \"is_almost\": true/false,\n"
        f"  \"explanation\": \"...\",\n"
        f"  \"score\": 0.0\n"
        f"}}\n"
        f"Important: Return ONLY JSON. No preamble."
    )

    payload = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }

    try:
        response = requests.post(OLLAMA_GENERATE_URL, json=payload, timeout=timeout)
        response.raise_for_status()
        res_json = response.json()
        raw_content = res_json.get("response", "").strip()
        
        # Parse the JSON from the response
        result = json.loads(raw_content)
        return {
            "is_correct": bool(result.get("is_correct", False)),
            "is_almost": bool(result.get("is_almost", False)),
            "explanation": str(result.get("explanation", "No explanation provided.")),
            "score": float(result.get("score", 0.0))
        }
    except Exception as e:
        logger.error(f"Semantic evaluation failed: {e}")
        # Fallback to simple string match if LLM fails
        is_exact = user_answer.strip().lower() == correct_answer.strip().lower()
        return {
            "is_correct": is_exact,
            "is_almost": False,
            "explanation": "Automatic evaluation (fallback).",
            "score": 1.0 if is_exact else 0.0
        }

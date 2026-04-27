import os
import json
import logging
import time
import re
import asyncio
from typing import List, Optional, Dict, Any, Union, Iterator, AsyncIterator

import httpx
import requests
from requests.exceptions import RequestException, Timeout

from .ollama_config import get_ollama_base_url, get_ollama_generation_model

logger = logging.getLogger("engine-generation")

# Centralised, environment-aware Ollama configuration
OLLAMA_BASE_URL = get_ollama_base_url()
OLLAMA_GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"
# Fail fast if the generation model is not configured; this avoids sending
# `null` to Ollama and makes configuration issues immediately visible.
OLLAMA_GENERATION_MODEL = get_ollama_generation_model(required=True)

OLLAMA_GENERATION_TIMEOUT = int(os.getenv("OLLAMA_GENERATION_TIMEOUT", "300"))
OLLAMA_CHAT_TIMEOUT = int(os.getenv("OLLAMA_CHAT_TIMEOUT", "120"))
OLLAMA_MAX_CONTEXT_CHARS = int(os.getenv("OLLAMA_MAX_CONTEXT_CHARS", "15000"))
OLLAMA_REQUEST_RETRIES = int(os.getenv("OLLAMA_REQUEST_RETRIES", "4"))
OLLAMA_REQUEST_RETRY_DELAY_SECONDS = float(os.getenv("OLLAMA_REQUEST_RETRY_DELAY_SECONDS", "2"))


def _stream_ollama_generate(payload: Dict[str, Any], *, timeout: int, material_type: str) -> str:
    """Call Ollama /api/generate with streaming enabled and reconstruct full text.

    Robust against:
    - partial JSON lines (chunk boundaries)
    - malformed chunks
    - bytes vs str inconsistencies
    - keep-alive empty lines
    - interrupted streams (bubbles up for retry)

    We accumulate ONLY valid `response` strings from dict chunks and stop on
    `done: true`.
    """
    payload = dict(payload)
    payload["stream"] = True

    parts: List[str] = []
    done_seen = False

    try:
        # Ensure the response body is properly closed even on exceptions.
        with requests.post(
            OLLAMA_GENERATE_URL,
            json=payload,
            timeout=timeout,
            stream=True,
        ) as resp:
            resp.raise_for_status()

            buf = b""
            for raw_chunk in resp.iter_content(chunk_size=8192):
                if raw_chunk is None:
                    continue

                if isinstance(raw_chunk, str):
                    raw_bytes = raw_chunk.encode("utf-8", errors="replace")
                else:
                    raw_bytes = raw_chunk

                if not raw_bytes:
                    continue

                buf += raw_bytes

                while True:
                    nl = buf.find(b"\n")
                    if nl == -1:
                        break
                    line_bytes = buf[:nl]
                    buf = buf[nl + 1 :]

                    line_bytes = line_bytes.strip()
                    if not line_bytes:
                        continue

                    line = line_bytes.decode("utf-8", errors="replace").strip()
                    if not line:
                        continue

                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError as e:
                        # Streaming occasionally includes malformed/noisy lines; keep going.
                        logger.debug(
                            "Streaming JSON decode failed material_type=%s error=%s line_prefix=%s",
                            material_type,
                            e,
                            line[:200],
                        )
                        continue

                    if not isinstance(chunk, dict):
                        continue

                    text_piece = chunk.get("response")
                    if isinstance(text_piece, str) and text_piece:
                        parts.append(text_piece)

                    if chunk.get("done") is True:
                        done_seen = True
                        break

                if done_seen:
                    break

            # Try parsing any remaining trailing line (may not end with a newline).
            tail = buf.strip()
            if tail and not done_seen:
                tail_line = tail.decode("utf-8", errors="replace").strip()
                if tail_line:
                    try:
                        chunk = json.loads(tail_line)
                        if isinstance(chunk, dict):
                            text_piece = chunk.get("response")
                            if isinstance(text_piece, str) and text_piece:
                                parts.append(text_piece)
                            if chunk.get("done") is True:
                                done_seen = True
                    except json.JSONDecodeError as e:
                        logger.debug(
                            "Streaming trailing JSON decode failed material_type=%s error=%s line_prefix=%s",
                            material_type,
                            e,
                            tail_line[:200],
                        )

    except Timeout:
        raise
    except RequestException as err:
        # Surface response body if present, but avoid noisy logs for expected streaming quirks.
        if getattr(err, "response", None) is not None:
            logger.error(
                "Ollama stream error material_type=%s status=%s body=%s",
                material_type,
                getattr(err.response, "status_code", None),
                getattr(err.response, "text", ""),
            )
        raise
    except OSError as e:
        logger.warning(
            "Streaming interrupted material_type=%s error=%s accumulated_chars=%d",
            material_type,
            e,
            sum(len(p) for p in parts),
        )
        raise

    text = "".join(parts).strip()
    if not text:
        raise ValueError("Empty response from Ollama streaming API")

    return text


def _strip_markdown_fences(text: str) -> str:
    """Best-effort cleanup for markdown fenced code blocks around JSON.

    Handles patterns like:
      ```json
      { ... }
      ```
    or generic ``` ... ``` fences. Returns inner content if found, otherwise
    the original text.
    """
    if not text:
        return text

    cleaned = text.strip()

    # Prefer ```json ... ``` pattern
    if "```json" in cleaned:
        try:
            cleaned = cleaned.split("```json", 1)[1]
            cleaned = cleaned.split("```", 1)[0]
            return cleaned.strip()
        except Exception:
            # Fall back to original if splitting fails
            return text.strip()

    # Generic fenced block
    if cleaned.startswith("```") and cleaned.endswith("```"):
        try:
            cleaned = cleaned.strip("`")
            return cleaned.strip()
        except Exception:
            return text.strip()

    # Fallback: remove any first/last ``` pair
    if "```" in cleaned:
        parts = cleaned.split("```")
        if len(parts) >= 3:
            return parts[1].strip()

    return cleaned


def _extract_json_payload(text: str) -> str:
    """Extract JSON object from text while rejecting clearly invalid payloads."""
    cleaned = _strip_markdown_fences(text).strip()
    if not cleaned:
        raise ValueError("LLM output is empty")

    if cleaned.startswith("{") and cleaned.endswith("}"):
        return cleaned

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("LLM output does not contain a JSON object")
    return cleaned[start : end + 1]


def _validate_non_empty_material(material_type: str, parsed: Dict[str, Any]) -> Optional[str]:
    """Check for empty cards/questions and return a warning message if detected.

    This does not change the structure, only signals that the payload is
    effectively empty so callers can decide whether to retry or surface a
    warning.
    """
    try:
        if material_type == "flashcards":
            cards = (parsed or {}).get("cards") or []
            if not cards:
                return "Flashcards output has empty 'cards' list."
        elif material_type == "quiz":
            questions = (parsed or {}).get("questions") or []
            if not questions:
                return "Quiz output has empty 'questions' list."
        elif material_type == "exam":
            questions = (parsed or {}).get("questions") or []
            answers = (parsed or {}).get("answer_sheet") or []
            if not questions:
                return "Exam output has empty 'questions' list."
            if not answers:
                return "Exam output has empty 'answer_sheet' list."
    except Exception as e:
        logger.warning("Non-empty validation failed for %s: %s", material_type, e)
    return None


def _validate_mode_specific_constraints(material_type: str, parsed: Dict[str, Any]) -> None:
    """Validate constraints that are stricter than schema shape validation."""
    if material_type == "exam":
        questions = parsed.get("questions") or []
        answer_sheet = parsed.get("answer_sheet") or []
        for idx, q in enumerate(questions, start=1):
            if str(q.get("answer_space") or "").strip() == "":
                raise ValueError(f"Exam question {idx} must include non-empty answer_space")
        # Ensure answer sheet can be matched deterministically.
        ids = {int(a.get("question_id")) for a in answer_sheet if a.get("question_id") is not None}
        expected = set(range(1, len(questions) + 1))
        if ids != expected:
            raise ValueError("Exam answer_sheet question_id values must match questions numbering (1..N)")

    if material_type == "flashcards":
        cards = parsed.get("cards") or []
        for idx, card in enumerate(cards, start=1):
            if not str(card.get("front") or "").strip() or not str(card.get("back") or "").strip():
                raise ValueError(f"Flashcard {idx} must include non-empty front/back")

    if material_type == "quiz":
        questions = parsed.get("questions") or []
        for idx, q in enumerate(questions, start=1):
            question_text = str(q.get("question") or "").strip()
            if not question_text:
                raise ValueError(f"Quiz question {idx} must include non-empty question text")
            if q.get("options") is not None:
                options = q.get("options") or []
                if len(options) < 2:
                    raise ValueError(f"Quiz question {idx} options must include at least 2 choices when present")


def _canonical_answer(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\w\s]", "", text)
    return text


def build_quiz_answer_key(questions: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
    """Build internal answer key map from generated quiz questions."""
    answer_key: Dict[int, Dict[str, Any]] = {}
    for q in questions or []:
        try:
            qid = int(q.get("id"))
        except (TypeError, ValueError):
            continue
        answer_key[qid] = {
            "correct_answer": str(q.get("correct_answer") or "").strip(),
            "explanation": str(q.get("explanation") or "").strip(),
        }
    return answer_key


def build_student_quiz_view(quiz_payload: Dict[str, Any]) -> Dict[str, Any]:
    """Return quiz payload without exposing correct answers before submission."""
    questions = quiz_payload.get("questions") or []
    safe_questions = []
    for q in questions:
        safe_item = {
            "id": q.get("id"),
            "question": q.get("question"),
        }
        if q.get("options") is not None:
            safe_item["options"] = q.get("options")
        safe_questions.append(safe_item)
    return {"type": "quiz", "questions": safe_questions}

def build_prompt(
    material_type: str,
    context: str,
    topic: Optional[str],
    language: str,
    count: Optional[int] = None,
    difficulty_override: Optional[str] = None,
    student_profile: Optional[Dict[str, Any]] = None,
) -> str:
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
        accuracy = None
        avg_response_time = None
        weak_topics: List[str] = []
        difficulty = "medium"

        if student_profile:
            try:
                accuracy = float(student_profile.get("accuracy", 0.5))
            except (TypeError, ValueError):
                accuracy = 0.5
            try:
                avg_response_time = float(student_profile.get("avg_response_time", 0.0))
            except (TypeError, ValueError):
                avg_response_time = 0.0

            weak_topics = [str(t) for t in (student_profile.get("weak_topics") or []) if t]

            if accuracy < 0.5:
                difficulty = "easy"
            elif accuracy <= 0.8:
                difficulty = "medium"
            else:
                difficulty = "hard"

        question_count = count if isinstance(count, int) and count > 0 else 5
        if difficulty_override and str(difficulty_override).strip():
            difficulty = str(difficulty_override).strip()

        base_instructions = (
            f"Generate a multiple-choice or short-answer quiz based on the context in {language}. "
            f"Include exactly {question_count} questions. For each question, provide options (if MCQ), the correct answer, and a short explanation."
        )
        base_instructions += f"\nSet quiz difficulty to: {difficulty}."
        if weak_topics:
            base_instructions += f"\nPrioritize these weak topics when possible: {', '.join(weak_topics)}."
        if accuracy is not None and avg_response_time is not None:
            base_instructions += (
                f"\nStudent performance summary: accuracy={accuracy:.2f}, "
                f"avg_response_time={avg_response_time:.2f}s."
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
        base_instructions += (
            f"\nOutput MUST be a JSON object following this structure: {json.dumps(json_structure)}"
            "\nUse numeric ids starting from 1 and increment by 1."
        )

    elif material_type == "flashcards":
        card_count = count if isinstance(count, int) and count > 0 else None
        if card_count is not None:
            base_instructions = f"Create a set of {card_count} flashcards (Front/Back) based on the context in {language}."
        else:
            base_instructions = f"Create a set of 5-10 flashcards (Front/Back) based on the context in {language}."
        if difficulty_override and str(difficulty_override).strip():
            base_instructions += f" Adapt the complexity to {str(difficulty_override).strip()} level."
        json_structure = {
            "type": "flashcards",
            "cards": [
                {"front": "Question/Term", "back": "Answer/Definition"}
            ]
        }
        base_instructions += f"\nOutput MUST be a JSON object following this structure: {json.dumps(json_structure)}"

    elif material_type == "exam":
        exam_count = count if isinstance(count, int) and count > 0 else 5
        base_instructions = (
            f"Create an exam based on the context in {language}. "
            f"Include exactly {exam_count} questions. Each question must have an 'answer_space' (e.g. '__________'). "
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
        base_instructions += (
            f"\nOutput MUST be a JSON object following this structure: {json.dumps(json_structure)}"
            "\nQuestion numbering in answer_sheet must start at 1 and map to questions order."
        )
    else:
        base_instructions = f"Process the given context and generate {material_type} in {language}."

    topic_focus = f"\nFocus specifically on the topic: '{topic}'." if topic else ""

    prompt = (
        f"System instructions:\n{base_instructions}{topic_focus}\n{json_format_instructions}\n\n"
        f"Context:\n---\n{context}\n---\n\n"
        f"Generate the {material_type} JSON now:"
    )
    return prompt


def _build_generation_context(chunks: List[str]) -> str:
    """Combine chunk context with a safe max-length cap."""
    max_chars = OLLAMA_MAX_CONTEXT_CHARS
    context = "\n\n".join(chunks)
    if len(context) > max_chars:
        context = context[:max_chars] + "...\n[Context truncated due to length]"
    return context


async def generate_study_material_stream(
    chunks: List[str],
    material_type: str,
    topic: Optional[str] = None,
    language: str = "en",
    options: Optional[Dict[str, Any]] = None,
) -> AsyncIterator[str]:
    """Stream study material tokens/chunks directly from Ollama.

    This path is intentionally independent from Celery so callers can forward
    progressive output to clients over SSE.
    """
    if not chunks:
        yield "[ERROR] Not enough context to generate material."
        return

    request_options = options if isinstance(options, dict) else {}
    raw_count = request_options.get("count")
    count = raw_count if isinstance(raw_count, int) and raw_count > 0 else None
    raw_difficulty = request_options.get("difficulty")
    difficulty_override = str(raw_difficulty).strip() if raw_difficulty is not None else None
    if difficulty_override == "":
        difficulty_override = None

    context = _build_generation_context(chunks)
    prompt = build_prompt(
        material_type,
        context,
        topic,
        language,
        count=count,
        difficulty_override=difficulty_override,
    )

    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
        "stream": True,
    }
    if material_type != "summary":
        payload["format"] = "json"

    retries = OLLAMA_REQUEST_RETRIES
    for attempt in range(1, retries + 1):
        try:
            async with httpx.AsyncClient(timeout=OLLAMA_GENERATION_TIMEOUT) as client:
                async with client.stream(
                    "POST",
                    OLLAMA_GENERATE_URL,
                    json=payload,
                ) as resp:
                    resp.raise_for_status()

                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                        except json.JSONDecodeError:
                            logger.debug("Skipping non-JSON stream line for %s", material_type)
                            continue

                        if not isinstance(chunk, dict):
                            continue

                        piece = chunk.get("response")
                        if isinstance(piece, str) and piece:
                            yield piece

                        if chunk.get("done") is True:
                            return
            return
        except (httpx.TimeoutException, httpx.RequestError) as e:
            if attempt == retries:
                logger.error(
                    "Streaming generation failed after %d attempts for material_type=%s: %s",
                    retries,
                    material_type,
                    e,
                )
                yield f"[ERROR] Ollama unreachable at {OLLAMA_BASE_URL} after {retries} attempts"
                return
            logger.warning(
                "Streaming generation retry %d/%d for material_type=%s due to: %s",
                attempt,
                retries,
                material_type,
                e,
            )
            await asyncio.sleep(OLLAMA_REQUEST_RETRY_DELAY_SECONDS)
        except Exception as e:
            logger.exception("Streaming generation failed for material_type=%s", material_type)
            yield f"[ERROR] {e}"
            return

def generate_study_material(
    chunks: List[str],
    material_type: str,
    topic: Optional[str] = None,
    language: str = "en",
    timeout: int = OLLAMA_GENERATION_TIMEOUT,
    retries: int = OLLAMA_REQUEST_RETRIES,
    user_id: Optional[str] = None,
    count: Optional[int] = None,
    difficulty: Optional[str] = None,
) -> Union[str, Dict[str, Any]]:
    """Combine chunks into context and call Ollama to generate study material."""
    if not chunks:
        return "Not enough context to generate material."

    # Combine chunks, limit to MAX_CHARS to prevent context overflow
    context = _build_generation_context(chunks)

    student_profile: Optional[Dict[str, Any]] = None
    if material_type == "quiz" and user_id:
        try:
            from .student_model import get_student

            student_profile = get_student(user_id)
        except Exception as e:
            logger.warning("Student profile lookup failed for user_id=%s: %s", user_id, e)

    prompt = build_prompt(
        material_type,
        context,
        topic,
        language,
        count=count,
        difficulty_override=difficulty,
        student_profile=student_profile,
    )

    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
        # NEW: streaming is now handled explicitly in _stream_ollama_generate.
        # For structured types, request JSON mode so the concatenated stream is valid JSON.
    }
    if material_type != "summary":
        payload["format"] = "json"

    for attempt in range(retries):
        try:
            logger.info(
                "LLM generation start material_type=%s attempt=%d/%d timeout=%s",
                material_type,
                attempt + 1,
                retries,
                timeout,
            )
            req_started = time.perf_counter()
            generated_text = _stream_ollama_generate(payload, timeout=timeout, material_type=material_type)
            req_ended = time.perf_counter()

            if not generated_text.strip():
                # Empty output guard: retry if possible, otherwise fail clearly.
                if attempt < retries - 1:
                    logger.info(
                        "LLM generation empty output material_type=%s attempt=%d/%d -> retrying",
                        material_type,
                        attempt + 1,
                        retries,
                    )
                    continue
                raise RuntimeError(f"Empty output from Ollama for material_type={material_type}")

            duration_ms = int((req_ended - req_started) * 1000)
            logger.info(
                "LLM generation done material_type=%s status_code=%s duration_ms=%s response_chars=%d",
                material_type,
                200,
                duration_ms,
                len(generated_text),
            )
            
            if material_type == "summary":
                return generated_text
            
            # Parsing/validation layer
            try:
                # Clean up potential markdown / fenced JSON
                parsed_json = json.loads(_extract_json_payload(generated_text))
                
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

                    _validate_mode_specific_constraints(material_type, parsed_json)

                    # Detect structurally valid but empty payloads
                    empty_warning = _validate_non_empty_material(material_type, parsed_json)
                    if empty_warning:
                        logger.info(
                            "LLM generation produced empty content material_type=%s warning=%s",
                            material_type,
                            empty_warning,
                        )
                        if attempt < retries - 1:
                            continue
                        return {
                            "error": "Empty content from LLM",
                            "details": empty_warning,
                            "raw": generated_text,
                            "parsed": parsed_json,
                        }
                except ValidationError as ve:
                    logger.error(
                        "LLM generation structural validation failed material_type=%s error=%s", 
                        material_type,
                        ve,
                    )
                    if attempt == retries - 1:
                        return {"error": "Invalid structure from LLM", "raw": generated_text, "details": str(ve)}
                    continue # Retry on validation error

                return parsed_json
            except json.JSONDecodeError as e:
                logger.error(
                    "Failed to parse JSON for material_type=%s error=%s text_prefix=%s",
                    material_type,
                    e,
                    generated_text[:200],
                )
                if attempt < retries - 1:
                    continue
                if attempt == retries - 1:
                    # Fallback or re-raise
                    return {"error": "Invalid JSON format from LLM", "raw": generated_text}
                
        except ValueError as e:
            # Typically empty output or unreconstructable stream; retry if allowed.
            logger.info(
                "Ollama streaming produced no usable output material_type=%s attempt=%d/%d error=%s",
                material_type,
                attempt + 1,
                retries,
                e,
            )
            if attempt == retries - 1:
                raise RuntimeError(f"Empty/invalid streaming output for material_type={material_type}") from e
            continue
        except Timeout:
            logger.warning(
                "Ollama generation request timed out material_type=%s attempt=%d/%d", 
                material_type,
                attempt + 1,
                retries,
            )
            if attempt == retries - 1:
                raise
        except RequestException as err:
            logger.warning(
                "Ollama generation request failed material_type=%s attempt=%d/%d error=%s", 
                material_type,
                attempt + 1,
                retries,
                err,
            )
            if hasattr(err, 'response') and err.response is not None:
                logger.error("Ollama error response body=%s", err.response.text)
            if attempt == retries - 1:
                raise

    raise RuntimeError("All generation retry attempts failed")


def generate_single_quiz_question(
    chunks: List[str],
    student_profile: Optional[Dict[str, Any]] = None,
    topic: Optional[str] = None,
    language: str = "en",
    timeout: int = OLLAMA_GENERATION_TIMEOUT,
    retries: int = OLLAMA_REQUEST_RETRIES,
) -> Dict[str, Any]:
    """Generate exactly one adaptive quiz question as structured JSON."""
    if not chunks:
        raise ValueError("Not enough context to generate question.")

    max_chars = OLLAMA_MAX_CONTEXT_CHARS
    context = "\n\n".join(chunks)
    if len(context) > max_chars:
        context = context[:max_chars] + "...\n[Context truncated due to length]"

    accuracy = 0.5
    weak_topics: List[str] = []
    if student_profile:
        try:
            accuracy = float(student_profile.get("accuracy", 0.5))
        except (TypeError, ValueError):
            accuracy = 0.5
        weak_topics = [str(t) for t in (student_profile.get("weak_topics") or []) if t]

    if accuracy < 0.5:
        difficulty = "easy"
    elif accuracy <= 0.8:
        difficulty = "medium"
    else:
        difficulty = "hard"

    topic_hint = f"Focus topic: {topic}." if topic else ""
    weak_hint = (
        f"Prioritize these weak topics when possible: {', '.join(weak_topics)}."
        if weak_topics
        else ""
    )

    json_structure = {
        "question": "Question text?",
        "options": ["A", "B", "C", "D"],
        "correct_answer": "A",
        "explanation": "Why A is correct",
    }

    prompt = (
        f"System instructions:\n"
        f"Generate EXACTLY ONE multiple-choice quiz question in {language}. "
        f"Use difficulty level: {difficulty}. "
        f"Question must include exactly 4 options, one correct_answer, and a concise explanation.\n"
        f"{topic_hint}\n"
        f"{weak_hint}\n"
        f"Return ONLY valid JSON with this exact structure: {json.dumps(json_structure)}\n\n"
        f"Context:\n---\n{context}\n---\n\n"
        f"Generate the single quiz question JSON now:"
    )

    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
        "format": "json",
    }

    last_error: Optional[Exception] = None
    for attempt in range(retries):
        try:
            logger.info(
                "Single quiz generation start attempt=%d/%d difficulty=%s",
                attempt + 1,
                retries,
                difficulty,
            )
            generated_text = _stream_ollama_generate(payload, timeout=timeout, material_type="quiz_single")
            cleaned = _strip_markdown_fences(generated_text)
            parsed = json.loads(cleaned)

            if not isinstance(parsed, dict):
                raise ValueError("Single quiz payload is not a JSON object")

            question = str(parsed.get("question") or "").strip()
            options = parsed.get("options") or []
            correct_answer = str(parsed.get("correct_answer") or "").strip()
            explanation = str(parsed.get("explanation") or "").strip()

            if not question:
                raise ValueError("Missing question")
            if not isinstance(options, list) or len(options) != 4:
                raise ValueError("options must contain exactly 4 items")
            options = [str(o).strip() for o in options]
            if any(not o for o in options):
                raise ValueError("All options must be non-empty")
            if not correct_answer:
                raise ValueError("Missing correct_answer")
            if not explanation:
                raise ValueError("Missing explanation")

            return {
                "question": question,
                "options": options,
                "correct_answer": correct_answer,
                "explanation": explanation,
            }
        except Exception as e:
            last_error = e
            logger.warning(
                "Single quiz generation failed attempt=%d/%d error=%s",
                attempt + 1,
                retries,
                e,
            )
            if attempt == retries - 1:
                break

    raise RuntimeError(f"Single quiz generation failed: {last_error}")

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
    }

    for attempt in range(retries):
        try:
            logger.info("Requesting chat response from Ollama attempt=%d/%d", attempt + 1, retries)
            text = _stream_ollama_generate(payload, timeout=timeout, material_type="chat")
            if not text.strip():
                if attempt < retries - 1:
                    logger.info("Chat empty output attempt=%d/%d -> retrying", attempt + 1, retries)
                    continue
                raise RuntimeError("Empty chat output from Ollama")
            return text
            
        except ValueError as e:
            logger.info("Ollama chat streaming produced no usable output attempt=%d/%d error=%s", attempt + 1, retries, e)
            if attempt == retries - 1:
                raise RuntimeError("Empty/invalid chat streaming output") from e
            continue
        except Timeout:
            logger.warning("Ollama chat request timed out attempt=%d/%d", attempt + 1, retries)
            if attempt == retries - 1:
                raise
        except RequestException as err:
            logger.warning("Ollama chat request failed attempt=%d/%d error=%s", attempt + 1, retries, err)
            if attempt == retries - 1:
                raise

    raise RuntimeError("All chat retry attempts failed")

def evaluate_quiz(
    questions: List[Dict[str, Any]],
    submissions: List[Dict[str, Any]],
    answer_key: Optional[Dict[Union[str, int], Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Compare user answers with correct answers and return color-coded results.
    """
    results = []
    question_map: Dict[int, Dict[str, Any]] = {}
    for q in questions or []:
        try:
            question_map[int(q.get("id"))] = q
        except (TypeError, ValueError):
            continue

    resolved_answer_key: Dict[int, Dict[str, Any]] = {}
    if isinstance(answer_key, dict):
        for key, value in answer_key.items():
            try:
                resolved_answer_key[int(key)] = value if isinstance(value, dict) else {}
            except (TypeError, ValueError):
                continue
    else:
        resolved_answer_key = build_quiz_answer_key(questions or [])

    for sub in submissions or []:
        try:
            q_id = int(sub.get("question_id"))
        except (TypeError, ValueError):
            continue
        user_ans = _canonical_answer(sub.get("user_answer", ""))

        answer_info = resolved_answer_key.get(q_id) or {}
        q = question_map.get(q_id) or {}
        correct_ans = _canonical_answer(answer_info.get("correct_answer") or q.get("correct_answer", ""))
        is_correct = bool(correct_ans) and user_ans == correct_ans

        result = {
            "question_id": q_id,
            "status": "correct" if is_correct else "wrong",
            "color": "green" if is_correct else "red",
        }

        if not is_correct:
            result["explanation"] = answer_info.get("explanation") or q.get("explanation") or "Incorrect answer."

        results.append(result)

    return {
        "type": "quiz_result",
        "results": results
    }

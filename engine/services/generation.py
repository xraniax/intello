import os
import json
import logging
import time
import re
import asyncio
import concurrent.futures
import string
from typing import List, Optional, Dict, Any, Union, Iterator, AsyncIterator

import httpx
import requests
from requests.exceptions import RequestException, Timeout

from .ollama_config import get_ollama_base_url, get_ollama_generation_model
from .summary_pipeline import _build_summary_system_prompt
from .chunk_processing import map_chunks_sync, async_map_chunks, reduce_results

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
MAP_MAX_CHUNKS = int(os.getenv("MAP_MAX_CHUNKS", "80"))
MAP_CONCURRENCY = int(os.getenv("MAP_CONCURRENCY", "2"))
STREAM_MAP_MAX_CHUNKS = int(os.getenv("STREAM_MAP_MAX_CHUNKS", "20"))


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
    payload.setdefault("keep_alive", -1)

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
            
            options = q.get("options")
            if not isinstance(options, list) or len(options) < 2:
                raise ValueError(f"Quiz question {idx} options must be a list with at least 2 choices")
            
            correct_answer = q.get("correct_answer")
            if not isinstance(correct_answer, int):
                raise ValueError(f"Quiz question {idx} correct_answer must be an integer index")
            
            if not (0 <= correct_answer < len(options)):
                raise ValueError(f"Quiz question {idx} correct_answer index out of range")


def extract_index(user_answer: Any, options: Any) -> Optional[int]:
    """
    Strict index-based extraction for quiz answers.
    Supports numeric input only.
    """

    if not isinstance(options, list) or not options:
        return None

    if user_answer is None:
        return None

    text = str(user_answer).strip()
    if not text:
        return None

    try:
        idx = int(text)
        if 0 <= idx < len(options):
            return idx
        return None
    except (TypeError, ValueError):
        return None
    
def build_quiz_answer_key(questions: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
    """Build internal answer key map from generated quiz questions."""
    answer_key: Dict[int, Dict[str, Any]] = {}
    for q in questions or []:
        try:
            qid = int(q.get("id"))
        except (TypeError, ValueError):
            continue
        answer_key[qid] = {
            "correct_answer": q.get("correct_answer"),
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


def _build_quiz_difficulty_guidance(difficulty: str) -> str:
    """Map difficulty strings to specific cognitive and structural LLM constraints."""
    diff_lower = (difficulty or "").lower().strip()
    if diff_lower in ("introductory", "beginner", "easy", "beg"):
        return (
            "Difficulty Constraint (Beginner):\n"
            "- Test factual recall and simple definitions.\n"
            "- Require only single-step reasoning.\n"
            "- Distractors must be obviously incorrect to a minimally prepared student."
        )
    elif diff_lower in ("advanced", "hard", "adv"):
        return (
            "Difficulty Constraint (Advanced):\n"
            "- Test multi-step reasoning, complex scenarios, and edge cases.\n"
            "- Do not test simple definitions.\n"
            "- Distractors must be highly nuanced, plausible, and designed to trap subtle reasoning errors or common misconceptions."
        )
    else:
        return (
            "Difficulty Constraint (Intermediate):\n"
            "- Test conceptual understanding and application.\n"
            "- Distractors must include plausible misconceptions and require careful reading to rule out."
        )


# PURE STRUCTURAL VALIDATOR — NO SEMANTIC OR DIFFICULTY LOGIC
def validate_quiz_question(question: Dict[str, Any]) -> Dict[str, Any]:
    """Schema-only check: shape and index bounds. No content, semantic, or difficulty logic."""
    if not isinstance(question, dict):
        return {"valid": False, "reasons": ["Question is not a dict."]}

    reasons = []

    q_text = question.get("question") or question.get("text")
    if not q_text or not str(q_text).strip():
        reasons.append("Question text is missing or empty.")

    options = question.get("options")
    if not isinstance(options, list) or len(options) < 2:
        reasons.append("Options must be a list with at least 2 items.")
    else:
        correct_ans = question.get("correct_answer")
        if not isinstance(correct_ans, int) or correct_ans < 0 or correct_ans >= len(options):
            reasons.append("correct_answer must be an integer index within options range.")

    return {"valid": len(reasons) == 0, "reasons": reasons}


def llm_validate_quiz_question(question: Dict[str, Any], difficulty: str) -> Dict[str, Any]:
    """
    Check question CONTENT quality only — never difficulty calibration.

    # Difficulty is system-controlled, not model-inferred.
    # The `difficulty` argument is passed so the LLM has generation context,
    # but the model's opinion on difficulty is neither requested nor returned.

    Returns valid=False only when there is a genuine content error:
      - The marked correct_answer is factually wrong.
      - A distractor is ambiguous or also-correct.
      - The question stem is circular, self-referential, or unanswerable.
      - The explanation contradicts the marked answer.
    """
    prompt = (
        "You are a quiz question quality checker.\n"
        "Your job: verify that the question is CORRECT and CLEAR.\n"
        "You are NOT checking whether the question matches a difficulty level.\n\n"
        "── What to check ──\n"
        "1. Is the marked correct_answer factually correct for the question stem?\n"
        "2. Are all other options (distractors) genuinely wrong — "
        "none of them also-correct or ambiguous?\n"
        "3. Is the question stem clear and answerable — not circular, "
        "not self-referential, not missing necessary information?\n"
        "4. Does the explanation correctly justify why the correct_answer is right?\n\n"
        "── Hard rules ──\n"
        "- Return valid=false ONLY for a content error listed above.\n"
        "- NEVER return valid=false because the question seems too easy or too hard.\n"
        "- NEVER return valid=false because the topic is unfamiliar or domain-specific.\n"
        "- When in doubt, return valid=true.\n\n"
        f"(Context: this question was generated for difficulty={difficulty.upper()}.)\n\n"
        "Output (STRICT JSON only):\n"
        "{\n"
        '  "valid": true or false,\n'
        '  "reason": "one sentence — describe the content error, or write OK"\n'
        "}\n\n"
        "Question to evaluate:\n"
        f"{json.dumps(question, indent=2)}\n\n"
        "Return ONLY JSON."
    )

    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
        "format": "json",
    }

    try:
        generated_text = _stream_ollama_generate(payload, timeout=30, material_type="quiz_validation")
        cleaned = _strip_markdown_fences(generated_text)
        parsed = json.loads(cleaned)

        valid = bool(parsed.get("valid"))
        reason = str(parsed.get("reason", "")).strip()

        logger.debug("[LLM_VAL] difficulty=%s valid=%s reason=%s", difficulty, valid, reason)

        return {"valid": valid, "reason": reason}
    except Exception as e:
        # Structural validation already passed; don't block on an LLM validator error.
        logger.warning("[LLM_VAL] validation call failed (accepting question): %s", e)
        return {"valid": True, "reason": f"Validation skipped due to error: {e}"}


def build_prompt(
    material_type: str,
    context: str,
    topic: Optional[str],
    language: str,
    count: Optional[int] = None,
    difficulty_override: Optional[str] = None,
    student_profile: Optional[Dict[str, Any]] = None,
    difficulty: str = "intermediate",
) -> str:
    """Build a structured prompt for the LLM based on material type."""
    
    json_format_instructions = "Return ONLY valid JSON. Do not include any markdown formatting, pre-amble, or post-amble."

    if material_type == "summary":
        lang_phrase = f" Write in {language}." if language and language.lower() != "en" else ""

        # Difficulty-aware depth instructions
        if difficulty in ("introductory", "beginner", "easy"):
            depth_instruction = (
                "Focus ONLY on the 2-3 most important ideas. "
                "Skip minor details, examples, and edge cases entirely. "
                "Keep it short and simple — a quick overview someone can read in under a minute."
            )
        elif difficulty in ("advanced", "hard"):
            depth_instruction = (
                "Cover nearly all the major and supporting ideas from the material. "
                "Include important details, distinctions, and nuances, but still synthesize — "
                "do not just restate every sentence. Explain connections between concepts."
            )
        else:  # intermediate / default
            depth_instruction = (
                "Cover all major concepts but compress the explanations. "
                "Include enough detail to understand each idea, but skip minor examples "
                "and tangential points. Aim for a balanced, medium-length summary."
            )

        prompt = (
            f"{depth_instruction}{lang_phrase}\n\n"
            f"Text to summarize:\n---\n{context}\n---\n\n"
            f"Summary:"
        )
        return prompt

    elif material_type == "quiz":
        accuracy = None
        avg_response_time = None
        weak_topics: List[str] = []

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

        question_count = count if isinstance(count, int) and count > 0 else 5
        if difficulty_override and str(difficulty_override).strip():
            difficulty = str(difficulty_override).strip()

        base_instructions = (
            f"Generate a multiple-choice quiz based on the context in {language}. "
            f"Include exactly {question_count} questions. For each question, provide options, the correct answer, and a short explanation."
        )
        base_instructions += f"\n{_build_quiz_difficulty_guidance(difficulty)}"
        if weak_topics:
            base_instructions += f"\nPrioritize these weak topics when possible: {', '.join(weak_topics)}."
        if accuracy is not None and avg_response_time is not None:
            base_instructions += (
                f"\nStudent performance summary: accuracy={accuracy:.2f}, "
                f"avg_response_time={avg_response_time:.2f}s."
            )
        json_structure = {
            "type": "quiz",
            "content": {
                "questions": [
                    {
                        "id": 1,
                        "question": "Question text?",
                        "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
                        "correct_answer": 0,
                        "explanation": "Why Option 1 is correct"
                    }
                ]
            },
            "metadata": {"difficulty": difficulty, "count": 5, "version": "v1"}
        }
        base_instructions += (
            f"\nOutput MUST be a JSON object following this structure: {json.dumps(json_structure)}"
            "\nUse numeric ids starting from 1 and increment by 1."
            "\ncorrect_answer must be the integer index of the correct option (0-based). DO NOT use letters or text for correct_answer."
        )

    elif material_type == "flashcards":
        card_count = count if isinstance(count, int) and count > 0 else None
        if card_count is not None:
            base_instructions = f"Create a set of {card_count} flashcards (Front/Back) based on the context in {language}."
        else:
            base_instructions = f"Create a set of 5-10 flashcards (Front/Back) based on the context in {language}."
        
        actual_diff = str(difficulty_override).strip() if difficulty_override and str(difficulty_override).strip() else difficulty
        if actual_diff:
            base_instructions += f" Adapt the complexity to {actual_diff} level."
            
        json_structure = {
            "type": "flashcards",
            "content": {
                "cards": [
                    {"front": "Question/Term", "back": "Answer/Definition"}
                ]
            },
            "metadata": {"difficulty": "intermediate", "count": 5, "version": "v1"}
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
            "content": {
                "questions": [
                    {"id": 1, "question": "Question text?", "answer_space": "__________"}
                ],
                "answer_sheet": [
                    {"question_id": 1, "answer": "The answer", "explanation": "Explanation"}
                ]
            },
            "metadata": {"difficulty": "intermediate", "count": 5, "version": "v1"}
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


def _map_summarize_chunk(chunk_text: str, language: str, timeout: int, retries: int) -> str:
    """Summarize a single chunk for the MAP stage."""
    prompt = (
        f"System instructions:\n"
        f"You are a highly efficient assistant. Compress the following text into a concise summary in {language}. "
        f"Extract ALL key facts, concepts, and details without omitting important information. "
        f"Do not add introductions or conclusions. Return ONLY the summary.\n\n"
        f"Text to summarize:\n---\n{chunk_text}\n---\n\n"
        f"Summary:"
    )
    
    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
    }
    
    prompt_chars = len(prompt)
    logger.info(
        "[TRACE][MAP_CHUNK] model=%s prompt_chars=%d chunk_input_chars=%d timeout=%d",
        OLLAMA_GENERATION_MODEL, prompt_chars, len(chunk_text), timeout,
    )
    
    for attempt in range(retries):
        attempt_start = time.perf_counter()
        try:
            generated_text = _stream_ollama_generate(payload, timeout=timeout, material_type="map_summary")
            attempt_ms = int((time.perf_counter() - attempt_start) * 1000)
            if generated_text and generated_text.strip():
                logger.info(
                    "[TRACE][MAP_CHUNK] attempt=%d/%d duration_ms=%d output_chars=%d",
                    attempt + 1, retries, attempt_ms, len(generated_text),
                )
                return generated_text.strip()
        except Exception as e:
            attempt_ms = int((time.perf_counter() - attempt_start) * 1000)
            logger.warning(
                "[TRACE][MAP_CHUNK] attempt=%d/%d FAILED duration_ms=%d error=%s",
                attempt + 1, retries, attempt_ms, e,
            )
            if attempt == retries - 1:
                return ""
            time.sleep(OLLAMA_REQUEST_RETRY_DELAY_SECONDS)
    return ""


def generate_map_summaries(
    chunks: List[str],
    language: str = "en",
    timeout: int = OLLAMA_GENERATION_TIMEOUT,
    retries: int = OLLAMA_REQUEST_RETRIES,
    max_chunks: Optional[int] = None,
) -> List[str]:
    """MAP stage: summarize chunks with bounded concurrency via ThreadPoolExecutor."""
    def process_fn(chunk: str) -> str:
        return _map_summarize_chunk(chunk, language, timeout, retries)

    return map_chunks_sync(
        chunks,
        process_fn,
        concurrency=MAP_CONCURRENCY,
        max_chunks=max_chunks or MAP_MAX_CHUNKS,
    )


async def _async_map_summaries(
    chunks: List[str],
    language: str = "en",
    timeout: int = OLLAMA_GENERATION_TIMEOUT,
    retries: int = OLLAMA_REQUEST_RETRIES,
    max_chunks: Optional[int] = None,
) -> List[str]:
    """Async MAP stage with bounded concurrency for the streaming path.

    WARNING — LEGACY PATH:
    This function is used only by generate_study_material_stream() for
    non-summary material types (quiz, flashcards, exam).  It calls the
    local _map_summarize_chunk() which does NOT accept a ``difficulty``
    parameter.

    Summary streaming MUST use summary_pipeline._async_map_summaries()
    instead, which supports difficulty-aware MAP prompts.
    api.py /generate/stream already routes summary correctly.
    Do NOT call this function for material_type="summary".
    """
    def process_fn(chunk: str) -> str:
        return _map_summarize_chunk(chunk, language, timeout, retries)

    return await async_map_chunks(
        chunks,
        process_fn,
        concurrency=MAP_CONCURRENCY,
        max_chunks=max_chunks or STREAM_MAP_MAX_CHUNKS,
    )


def _build_generation_context(chunks: List[str]) -> str:
    """Combine chunk context with a safe max-length cap."""
    return reduce_results(chunks, OLLAMA_MAX_CONTEXT_CHARS, "\n...\n[Context truncated due to length]")


async def generate_study_material_stream(
    chunks: List[str],
    material_type: str,
    topic: Optional[str] = None,
    language: str = "en",
    difficulty: str = "intermediate",
) -> AsyncIterator[str]:
    """Stream study material tokens/chunks directly from Ollama.

    This path is intentionally independent from Celery so callers can forward
    progressive output to clients over SSE.
    """
    overall_start = time.perf_counter()
    logger.info(
        "[TRACE][STREAM_GEN_START] material_type=%s chunks=%d difficulty=%s topic=%s",
        material_type, len(chunks), difficulty, topic,
    )

    if not chunks:
        yield "[ERROR] Not enough context to generate material."
        return

    context = _build_generation_context(chunks)
    prompt = build_prompt(material_type, context, topic, language, difficulty=difficulty)

    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
        "stream": True,
        "format": "json",
    }

    reduce_prompt_chars = len(prompt)
    logger.info(
        "[TRACE][REDUCE_START] model=%s prompt_chars=%d context_chars=%d url=%s timeout=%d",
        OLLAMA_GENERATION_MODEL, reduce_prompt_chars, len(context),
        OLLAMA_GENERATE_URL, OLLAMA_GENERATION_TIMEOUT,
    )

    retries = OLLAMA_REQUEST_RETRIES
    for attempt in range(1, retries + 1):
        reduce_attempt_start = time.perf_counter()
        first_token_logged = False
        token_count = 0
        total_chars = 0
        try:
            async with httpx.AsyncClient(timeout=OLLAMA_GENERATION_TIMEOUT) as client:
                async with client.stream(
                    "POST",
                    OLLAMA_GENERATE_URL,
                    json=payload,
                ) as resp:
                    resp.raise_for_status()
                    logger.info(
                        "[TRACE][REDUCE_HTTP_OK] attempt=%d/%d status=%d time_to_response_ms=%d",
                        attempt, retries, resp.status_code,
                        int((time.perf_counter() - reduce_attempt_start) * 1000),
                    )

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
                            token_count += 1
                            total_chars += len(piece)
                            if not first_token_logged:
                                first_token_ms = int((time.perf_counter() - reduce_attempt_start) * 1000)
                                logger.info(
                                    "[TRACE][REDUCE_FIRST_TOKEN] attempt=%d/%d time_to_first_token_ms=%d",
                                    attempt, retries, first_token_ms,
                                )
                                first_token_logged = True
                            yield piece

                        if chunk.get("done") is True:
                            reduce_ms = int((time.perf_counter() - reduce_attempt_start) * 1000)
                            overall_ms = int((time.perf_counter() - overall_start) * 1000)
                            throughput = (token_count / (reduce_ms / 1000)) if reduce_ms > 0 else 0
                            logger.info(
                                "[TRACE][REDUCE_DONE] attempt=%d/%d reduce_ms=%d tokens=%d chars=%d throughput_tok_per_s=%.1f overall_ms=%d",
                                attempt, retries, reduce_ms, token_count, total_chars, throughput, overall_ms,
                            )
                            return
            return
        except (httpx.TimeoutException, httpx.RequestError, httpx.HTTPStatusError) as e:
            attempt_ms = int((time.perf_counter() - reduce_attempt_start) * 1000)
            if attempt == retries:
                logger.error(
                    "[TRACE][REDUCE_FAIL] attempt=%d/%d duration_ms=%d error=%s tokens_before_fail=%d",
                    attempt, retries, attempt_ms, e, token_count,
                )
                yield f"[ERROR] Ollama unreachable at {OLLAMA_BASE_URL} after {retries} attempts"
                return
            logger.warning(
                "[TRACE][REDUCE_RETRY] attempt=%d/%d duration_ms=%d error=%s",
                attempt, retries, attempt_ms, e,
            )
            await asyncio.sleep(OLLAMA_REQUEST_RETRY_DELAY_SECONDS)
        except Exception as e:
            attempt_ms = int((time.perf_counter() - reduce_attempt_start) * 1000)
            logger.exception(
                "[TRACE][REDUCE_CRASH] attempt=%d duration_ms=%d error=%s",
                attempt, attempt_ms, e,
            )
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
    difficulty: str = "intermediate",
) -> Union[str, Dict[str, Any]]:
    """Combine chunks into context and call Ollama to generate study material."""
    if not chunks:
        return "Not enough context to generate material."

    if material_type == "summary":
        logger.info("Initiating MAP stage for %d chunks", len(chunks))
        mapped_chunks = generate_map_summaries(chunks, language, timeout, retries)
        if mapped_chunks:
            chunks = mapped_chunks

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
        difficulty=difficulty,
    )

    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
    }
    if material_type == "summary":
        payload["system"] = _build_summary_system_prompt()
    else:
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
                "LLM generation done material_type=%s duration_ms=%s response_chars=%d",
                material_type,
                duration_ms,
                len(generated_text),
            )

            if material_type == "summary":
                return generated_text

            try:
                cleaned = _strip_markdown_fences(generated_text)
                parsed_json = json.loads(cleaned)


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
                    continue

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
                return {"error": "Invalid JSON format from LLM", "raw": generated_text}

        except ValueError as e:
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
    difficulty: str,
    target_concept: str,
    distractor_pool: List[str],
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

    logger.info(
        "[QUIZ_PIPELINE] prompt_difficulty=%s concept=%r chunks=%d context_chars=%d",
        difficulty, target_concept, len(chunks), len(context),
    )
    logger.info(
        "[QUIZ_GEN] build_prompt concept=%r difficulty=%s chunks=%d context_chars=%d pool=%s",
        target_concept, difficulty, len(chunks), len(context),
        distractor_pool[:5] if distractor_pool else [],
    )

    target_hint = (
        f"The question must test understanding of the concept: '{target_concept}'."
        if target_concept else ""
    )

    # Related concept names hint: a suggestion, not a copy directive.
    # The LLM must still derive actual wrong-answer text from the context.
    distractor_hint = (
        f"The following related concepts from the same subject area may inspire plausible wrong answers: "
        f"{', '.join(distractor_pool[:5])}. "
        f"Only use them if they can represent a realistic misconception about the correct answer to this specific question."
        if distractor_pool
        else ""
    )

    option_grounding = (
        "Option quality rules:\n"
        "- Every option (correct and incorrect) must be a direct, specific answer to the question stem — "
        "not a general fact about the subject area.\n"
        "- Incorrect options must be plausible misconceptions or common confusions about the correct answer, "
        "not unrelated facts.\n"
        "- All options must be grounded in the provided context. Do not invent options absent from the context.\n"
        "- Options should be parallel in form and comparable in length."
    )

    json_structure = {
        "question": "Question text?",
        "options": ["Option 1", "Option 2", "Option 3"],
        "correct_answer": 0,
        "explanation": "Why option 1 is correct",
    }

    difficulty_guidance = _build_quiz_difficulty_guidance(difficulty)

    prompt = (
        f"System instructions:\n"
        f"Generate EXACTLY ONE multiple-choice quiz question in {language}.\n"
        f"{difficulty_guidance}\n"
        f"{option_grounding}\n"
        f"Question must include a list of options (minimum 2), a correct_answer index, and a concise explanation.\n"
        f"correct_answer must be the integer index of the correct option (0-based). DO NOT use letters or text for correct_answer.\n"
        f"{target_hint}\n"
        f"{distractor_hint}\n"
        f"Return ONLY valid JSON with this exact structure: {json.dumps(json_structure)}\n\n"
        f"Context:\n---\n{context}\n---\n\n"
        f"Generate the single quiz question JSON now:"
    )

    logger.debug("[QUIZ_GEN] prompt_chars=%d prompt_head=%r", len(prompt), prompt[:400])

    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
        "format": "json",
    }

    last_error: Optional[Exception] = None
    for attempt in range(retries):
        try:
            logger.info(
                "[QUIZ_GEN] generation attempt=%d/%d difficulty=%s concept=%r",
                attempt + 1, retries, difficulty, target_concept,
            )
            generated_text = _stream_ollama_generate(payload, timeout=timeout, material_type="quiz_single")
            cleaned = _strip_markdown_fences(generated_text)
            parsed = json.loads(cleaned)

            if not isinstance(parsed, dict):
                raise ValueError("Single quiz payload is not a JSON object")

            question = str(parsed.get("question") or "").strip()
            options = parsed.get("options") or []
            correct_answer = parsed.get("correct_answer")
            explanation = str(parsed.get("explanation") or "").strip()

            if not question:
                raise ValueError("Missing question")
            if not isinstance(options, list) or len(options) < 2:
                raise ValueError("options must contain at least 2 items")
            options = [str(o).strip() for o in options]
            if any(not o for o in options):
                raise ValueError("All options must be non-empty")
            if not isinstance(correct_answer, int):
                raise ValueError("correct_answer must be an integer index")
            if not 0 <= correct_answer < len(options):
                raise ValueError("correct_answer index out of range")
            if not explanation:
                raise ValueError("Missing explanation")

            logger.info(
                "[QUIZ_GEN] options_raw correct_idx=%d options=%s",
                correct_answer, options,
            )

            return {
                "question": question,
                "options": options,
                "correct_answer": correct_answer,
                "explanation": explanation,
            }
        except Exception as e:
            last_error = e
            logger.warning(
                "[QUIZ_GEN] generation attempt=%d/%d FAILED error=%s",
                attempt + 1, retries, e,
            )
            if attempt == retries - 1:
                break

    raise RuntimeError(f"Single quiz generation failed: {last_error}")


def generate_validated_quiz_question(
    chunks: List[str],
    difficulty: str,
    target_concept: str,
    distractor_pool: List[str],
    language: str = "en",
    timeout: int = OLLAMA_GENERATION_TIMEOUT,
) -> Dict[str, Any]:
    """
    Generate and structurally validate a single quiz question.

    # LLM is not a validator. It is a generator only.
    #
    # `difficulty` is the resolved value from resolve_quiz_difficulty() and is the
    # single source of truth passed unchanged into every generation attempt.
    # Retry decisions are made EXCLUSIVELY by validate_quiz_question() (deterministic,
    # code-only).  llm_validate_quiz_question() is called for debug observability only
    # and NEVER influences accept/reject or retry.
    """
    max_attempts = 3

    logger.info(
        "[QUIZ_PIPELINE] start resolved_difficulty=%s concept=%r max_attempts=%d",
        difficulty, target_concept, max_attempts,
    )

    for attempt in range(max_attempts):
        try:
            logger.info(
                "[QUIZ_PIPELINE] attempt=%d/%d resolved_difficulty=%s concept=%r",
                attempt + 1, max_attempts, difficulty, target_concept,
            )
            question = generate_single_quiz_question(
                chunks=chunks,
                difficulty=difficulty,
                target_concept=target_concept,
                distractor_pool=distractor_pool,
                language=language,
                timeout=timeout,
                retries=1,
            )

            # ── Structural validation (sole retry gate) ────────────────────────
            # ONLY validate_quiz_question() can accept or reject a question.
            # No other check influences retry. No heuristic, no LLM output.
            val = validate_quiz_question(question)
            if not val["valid"]:
                logger.warning(
                    "[QUIZ_PIPELINE] structural FAIL attempt=%d/%d resolved_difficulty=%s "
                    "reasons=%s question_text=%r",
                    attempt + 1, max_attempts, difficulty,
                    val["reasons"], question.get("question", ""),
                )
                if attempt == max_attempts - 1:
                    raise ValueError(f"Structural validation failed: {val['reasons']}")
                continue

            # ── LLM observability log (debug only — no decision made here) ────
            # Difficulty is system-controlled, not model-inferred.
            # llm_validate_quiz_question() checks content quality only.
            # Its result never influences difficulty, retry, or rejection.
            try:
                llm_val = llm_validate_quiz_question(question, difficulty)
                logger.debug(
                    "[QUIZ_PIPELINE] llm_content_check resolved_difficulty=%s valid=%s reason=%s",
                    difficulty, llm_val.get("valid"), llm_val.get("reason", ""),
                )
            except Exception as lv_err:
                logger.debug("[QUIZ_PIPELINE] llm_validate skipped: %s", lv_err)

            logger.info(
                "[QUIZ_PIPELINE] accepted attempt=%d/%d resolved_difficulty=%s concept=%r",
                attempt + 1, max_attempts, difficulty, target_concept,
            )
            return question

        except Exception as e:
            logger.warning(
                "[QUIZ_PIPELINE] exception attempt=%d/%d resolved_difficulty=%s error=%s",
                attempt + 1, max_attempts, difficulty, e,
            )
            if attempt == max_attempts - 1:
                raise RuntimeError(
                    f"All {max_attempts} validated generation attempts failed. Last error: {e}"
                )

    raise RuntimeError("Unexpected end of generate_validated_quiz_question.")


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
    """Compare user answers with correct answers and return color-coded results."""
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
        user_answer = sub.get("user_answer", "")

        answer_info = resolved_answer_key.get(q_id) or {}
        q = question_map.get(q_id) or {}
        options = q.get("options")
        raw_correct = answer_info.get("correct_answer")
        if raw_correct is None:
            raw_correct = q.get("correct_answer")

        correct_index = None
        try:
            if raw_correct is not None:
                if isinstance(raw_correct, int):
                    correct_index = raw_correct
                elif isinstance(raw_correct, str) and raw_correct.strip().isdigit():
                    correct_index = int(raw_correct.strip())
        except (TypeError, ValueError):
            pass

        user_index = extract_index(user_answer, options)

        is_correct = correct_index is not None and user_index == correct_index
        correct_option_text = ""
        if correct_index is not None and isinstance(options, list) and 0 <= correct_index < len(options):
            correct_option_text = str(options[correct_index]).strip()

        result = {
            "question_id": q_id,
            "status": "correct" if is_correct else "wrong",
            "color": "green" if is_correct else "red",
            "correct_index": correct_index,
            "correct_option_text": correct_option_text,
        }

        if not is_correct:
            explanation = answer_info.get("explanation") or q.get("explanation") or "Incorrect answer."
            if correct_index is not None and correct_option_text:
                explanation = (
                    f"{explanation} Correct answer: Option {correct_index + 1} — {correct_option_text}"
                )
            result["explanation"] = explanation
            logger.debug(
                "Quiz answer mismatch question_id=%s user_answer=%s correct_answer=%s",
                q_id, user_answer, raw_correct,
            )

        results.append(result)

    return {
        "type": "quiz_result",
        "results": results
    }

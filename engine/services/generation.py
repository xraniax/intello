import os
import json
import logging
import time
import re
import asyncio
import concurrent.futures
from typing import List, Optional, Dict, Any, Union, Iterator, AsyncIterator

import httpx
import requests
from requests.exceptions import RequestException, Timeout

from .ollama_config import (
    get_ollama_base_url,
    get_ollama_generation_model,
    get_dynamic_timeout,
    _stream_ollama_generate,
    _async_stream_ollama_generate,
    OLLAMA_GENERATE_URL,
    OLLAMA_GENERATION_MODEL,
)
from .summary_pipeline import _build_summary_system_prompt

from .exceptions import NonRetriableGenerationError
from .schemas import ExamOutput, QuizOutput, FlashcardsOutput, SummaryOutput
from pydantic import ValidationError

logger = logging.getLogger("engine-generation")

# Centralised, environment-aware Ollama configuration
OLLAMA_BASE_URL = get_ollama_base_url()
OLLAMA_GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"
# Fail fast if the generation model is not configured; this avoids sending
# `null` to Ollama and makes configuration issues immediately visible.
OLLAMA_GENERATION_MODEL = get_ollama_generation_model(required=True)

OLLAMA_GENERATION_TIMEOUT = int(os.getenv("OLLAMA_GENERATION_TIMEOUT", "300"))
OLLAMA_CHAT_TIMEOUT = int(os.getenv("OLLAMA_CHAT_TIMEOUT", "120"))
OLLAMA_MAX_CONTEXT_CHARS = int(os.getenv("OLLAMA_MAX_CONTEXT_CHARS", "12000"))
OLLAMA_REQUEST_RETRIES = int(os.getenv("OLLAMA_REQUEST_RETRIES", "4"))
OLLAMA_REQUEST_RETRY_DELAY_SECONDS = float(os.getenv("OLLAMA_REQUEST_RETRY_DELAY_SECONDS", "2"))
MAP_MAX_CHUNKS = int(os.getenv("MAP_MAX_CHUNKS", "80"))
MAP_CONCURRENCY = int(os.getenv("MAP_CONCURRENCY", "2"))
STREAM_MAP_MAX_CHUNKS = int(os.getenv("STREAM_MAP_MAX_CHUNKS", "20"))




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
        content = (parsed or {}).get("content") or {}
        if material_type == "flashcards":
            cards = content.get("cards") or []
            if not cards:
                return "Flashcards output has empty 'cards' list."
        elif material_type == "quiz":
            questions = content.get("questions") or []
            if not questions:
                return "Quiz output has empty 'questions' list."
        elif material_type == "exam":
            questions = content.get("questions") or []
            answers = content.get("answer_sheet") or []
            if not questions:
                return "Exam output has empty 'questions' list."
            if not answers:
                return "Exam output has empty 'answer_sheet' list."
    except Exception as e:
        logger.warning("Non-empty validation failed for %s: %s", material_type, e)
    return None


def _validate_mode_specific_constraints(material_type: str, parsed: Dict[str, Any]) -> None:
    """Validate constraints that are stricter than schema shape validation."""
    content = parsed.get("content") or {}
    
    if material_type == "exam":
        questions = content.get("questions") or []
        answer_sheet = content.get("answer_sheet") or []
        for idx, q in enumerate(questions, start=1):
            if str(q.get("answer_space") or "").strip() == "":
                # REPAIR: Default to a placeholder if missing instead of failing terminaly
                logger.warning(f"[REPAIR] Exam question {idx} missing answer_space. Repairing.")
                q["answer_space"] = "__________"
        
        # Resilient ID Matching: 
        # First, try to convert IDs to integers to match numbering
        try:
            ids = {int(a.get("question_id")) for a in answer_sheet if a.get("question_id") is not None}
            expected = set(range(1, len(questions) + 1))
            if ids == expected:
                return # Perfect match
        except (ValueError, TypeError):
            pass

        # If IDs don't match numbering or are non-numeric, fallback to positional matching if counts match
        if len(questions) == len(answer_sheet):
            logger.info("[REPAIR] Exam IDs mismatched or non-numeric. Re-syncing via positional alignment (questions=answer_sheet).")
            for idx, (q, a) in enumerate(zip(questions, answer_sheet), start=1):
                # Force sync both to positional IDs
                q["id"] = str(idx)
                a["question_id"] = str(idx)
        else:
            # Last resort: If counts don't match, we still want to avoid terminal failure if we have some questions.
            # But the answer sheet is likely corrupted relative to questions.
            # Pydantic will still valid structure, but this is a semantic warning.
            if not questions or not answer_sheet:
                 raise ValueError("Exam requires at least one question and one answer_sheet item")
            logger.warning(f"[REPAIR] Exam questions ({len(questions)}) and answer_sheet ({len(answer_sheet)}) count mismatch. Structural integrity may be compromised.")

    if material_type == "flashcards":
        cards = content.get("cards") or []
        for idx, card in enumerate(cards, start=1):
            if not str(card.get("front") or "").strip() or not str(card.get("back") or "").strip():
                raise ValueError(f"Flashcard {idx} must include non-empty front/back")

    if material_type == "quiz":
        questions = content.get("questions") or []
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
            val = q.get("id")
            qid = int(val) if val is not None else 0
            if qid == 0: continue
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
    difficulty: str = "intermediate",
    existing_items: Optional[List[str]] = None,
    options: Optional[Dict[str, Any]] = None,
) -> str:
    """Build a structured prompt for the LLM based on material type."""
    
    json_format_instructions = "Return ONLY valid JSON. Do not include any markdown formatting, pre-amble, or post-amble."

    additive_instruction = ""
    if existing_items:
        titles = ", ".join([f"'{t}'" for t in existing_items[:20]]) # Cap to avoid overfilling prompt
        additive_instruction = (
            f"\nIMPORTANT: I already have these questions/items: {titles}. "
            f"DO NOT repeat any of these. Generate {count} NEW and UNIQUE items from different parts of the context."
        )

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
            f"Generate a multiple-choice or short-answer quiz in {language}. "
            f"Include exactly {question_count} questions. Each question must include options (for MCQ), correct_answer, and explanation.\n"
            f"Difficulty: {difficulty}.\n"
        )
        if weak_topics:
            base_instructions += f"Targeted topics: {', '.join(weak_topics)}.\n"
            
        json_structure = {
            "type": "quiz",
            "content": {
                "questions": [
                    {
                        "id": 1,
                        "question": "text",
                        "options": ["A", "B", "C", "D"],
                        "correct_answer": "answer",
                        "explanation": "reasoning"
                    }
                ]
            },
            "metadata": {"difficulty": difficulty, "count": question_count, "version": "v1"}
        }
        base_instructions += (
            f"Output MUST be a single JSON object with this exact structure: {json.dumps(json_structure)}\n"
            "All questions must be inside the 'content.questions' list."
        )

    elif material_type == "flashcards":
        card_count = count if isinstance(count, int) and count > 0 else 5
        # Build a numbered list placeholder so the model understands it must fill each slot
        placeholder_cards = [{"front": f"term {i}", "back": f"definition {i}"} for i in range(1, card_count + 1)]
        json_structure = {
            "type": "flashcards",
            "content": {
                "cards": placeholder_cards
            },
            "metadata": {"difficulty": "intermediate", "count": card_count, "version": "v1"}
        }
        base_instructions = (
            f"Create EXACTLY {card_count} flashcard entries in {language}. "
            f"You MUST produce ALL {card_count} cards — do not stop early. "
            f"Each card has a 'front' (term or question) and a 'back' (definition or answer). "
            f"Output MUST be a single JSON object. The 'content.cards' array MUST contain exactly {card_count} items. "
            f"Template structure (replace all placeholder values with real content): {json.dumps(json_structure)}"
        )

    elif material_type == "exam":
        exam_count = count if isinstance(count, int) and count > 0 else 5

        # ── Adaptive difficulty resolution ──────────────────────────────────
        # Priority: explicit user override > student profile accuracy > fallback
        adaptive_difficulty = difficulty or "intermediate"
        adaptive_weak_topics: List[str] = []

        if student_profile and not difficulty_override:
            try:
                accuracy = float(student_profile.get("accuracy", 0.5))
            except (TypeError, ValueError):
                accuracy = 0.5

            if accuracy < 0.4:
                adaptive_difficulty = "beginner"
            elif accuracy < 0.65:
                adaptive_difficulty = "intermediate"
            else:
                adaptive_difficulty = "advanced"

            adaptive_weak_topics = [
                str(t) for t in (student_profile.get("weak_topics") or []) if t
            ]
            logger.info(
                "[ADAPTIVE][EXAM] Resolved difficulty=%s weak_topics=%s (accuracy=%.3f)",
                adaptive_difficulty, adaptive_weak_topics, accuracy,
            )
        elif difficulty_override:
            adaptive_difficulty = str(difficulty_override).strip()

        # ── Question Type Distribution Resolution ──────────────────────────
        # Extract requested question types from GPS distribution
        distribution = (options or {}).get("generation_options", {}).get("distribution", [])
        if not distribution and options:
             # Fallback to direct types if distribution is missing
             distribution = [{"type": t, "count": 1} for t in options.get("types", [])]

        type_instructions = ""
        if distribution:
            type_counts = [f"{d.get('count', '')}x {d.get('type')}" for d in distribution if d.get("type")]
            if type_counts:
                type_instructions = f"\n6. QUESTION MIX: Use this specific distribution of question types: " + ", ".join(type_counts) + "."

        base_instructions = (
            f"Generate a COMPREHENSIVE mock exam in {language} based ONLY on the provided context.\n"
            f"Requirements:\n"
            f"1. Include EXACTLY {exam_count} unique and challenging questions.\n"
            f"2. Each question MUST be grounded in the provided facts.\n"
            f"3. Difficulty level: {adaptive_difficulty}.\n"
            f"4. Format: Return a single JSON object with 'type', 'content', and 'metadata'.\n"
            f"5. Structure: 'content' must have 'questions' (list of {{id, question, type, options, answer_space}}) and 'answer_sheet' (list of {{question_id, answer, explanation}})."
            f"{type_instructions}"
        )
        if adaptive_weak_topics:
            base_instructions += (
                f"\n7. PRIORITY FOCUS: Emphasize questions on these topics where the student has shown weakness: "
                + ", ".join(adaptive_weak_topics) + "."
            )

        # Use a minimal, non-conversational schema hint to avoid triggering "echoing"
        schema_hint = {
            "type": "exam",
            "content": {
                "questions": [{"id": "1", "question": "...", "type": "mcq", "options": ["A", "B"], "answer_space": "__________"}],
                "answer_sheet": [{"question_id": "1", "answer": "...", "explanation": "..."}]
            },
            "metadata": {"difficulty": adaptive_difficulty, "count": exam_count}
        }
        base_instructions += f"\nTemplate structure: {json.dumps(schema_hint)}"
    else:
        base_instructions = f"Process the given context and generate {material_type} in {language}."

    topic_focus = f"\nFocus specifically on the topic: '{topic}'." if topic else ""

    prompt = (
        f"System instructions:\n{base_instructions}{topic_focus}{additive_instruction}\n{json_format_instructions}\n"
        f"Return ONLY valid JSON. No preamble, no commentary.\n\n"
        f"Context:\n---\n{context}\n---\n\n"
        f"Generate the JSON now:"
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
    overall_start = time.perf_counter()
    difficulty = (options or {}).get("difficulty", "medium")  # pre-read for logging; full parse happens below
    logger.info(
        "[TRACE][STREAM_GEN_START] material_type=%s chunks=%d difficulty=%s topic=%s",
        material_type, len(chunks), difficulty, topic,
    )

    if not chunks:
        yield "[ERROR] Not enough context to generate material."
        return

    request_options = options if isinstance(options, dict) else {}
    raw_count = request_options.get("count") or request_options.get("total_count")
    count = raw_count if isinstance(raw_count, int) and raw_count > 0 else None
    raw_difficulty = request_options.get("difficulty")
    difficulty_override = str(raw_difficulty).strip() if raw_difficulty is not None else None
    if difficulty_override == "":
        difficulty_override = None
    if material_type == "exam":
        logger.info(f"[EXAM COUNT] {count}")

    # Stability patch: dynamic timeout based on question count
    dynamic_timeout = get_dynamic_timeout(count or 5)

    context = _build_generation_context(chunks)
    prompt = build_prompt(
        material_type,
        context,
        topic,
        language,
        count=count,
        difficulty_override=difficulty_override,
        options=request_options,
    )

    # Scale num_predict based on item count so the model doesn't stop early.
    # Rule of thumb: ~150 tokens per card/question, 256 token base overhead.
    # Capped at 4096 to stay within qwen2.5:3b's comfortable window.
    items_count = count or 5
    dynamic_num_predict = min(4096, 256 + items_count * 150)

    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
        "stream": True,
        "format": "json",
        "options": {
            "num_ctx": 8192,
            "num_predict": dynamic_num_predict,
            "temperature": 0.7,
        },
    }

    reduce_prompt_chars = len(prompt)
    logger.info(
        "[TRACE][REDUCE_START] model=%s prompt_chars=%d context_chars=%d url=%s timeout=%s",
        OLLAMA_GENERATION_MODEL, reduce_prompt_chars, len(context),
        OLLAMA_GENERATE_URL, str(dynamic_timeout),
    )

    retries = OLLAMA_REQUEST_RETRIES
    for attempt in range(1, retries + 1):
        reduce_attempt_start = time.perf_counter()
        first_token_logged = False
        token_count = 0
        total_chars = 0
        try:
            async with httpx.AsyncClient(timeout=dynamic_timeout) as client:
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

def normalize_to_canonical(
    raw_payload: Any,
    material_type: str,
    model: str,
    difficulty: str = "intermediate",
    topic: str = None,
    subject_id: str = None
) -> dict:
    """
    Whitelisted Resilient Normalization Layer.
    Only heals KNOWN schema drift. Rejects unknown structures strictly.
    """
    # 1. Handle Raw Strings (Universal wrapping)
    if isinstance(raw_payload, str):
        logger.info("[REPAIR] Wrapping raw string output into canonical 'content'")
        if material_type == "summary":
            content = {
                "title": f"Summary of {topic}" if topic else "Study Summary",
                "sections": [{"heading": "Summary", "body": raw_payload}]
            }
        elif material_type == "flashcards":
            # Very loose attempt for flashcards if it's just text (rarely works but safer than guess)
            content = {"cards": [{"front": "Summary", "back": raw_payload}]}
        else:
            # For exams/quizzes, a raw string is usually unusable, but we wrap it to let Pydantic fail it specifically
            content = {"unstructured_text": raw_payload, "questions": []}
    
    elif isinstance(raw_payload, dict):
        # 2. Map Whitelisted Hallucinations
        content = raw_payload.get("content")

        # When the LLM serializes the content field as a JSON string instead of an object,
        # try to parse it back and use it if it contains the expected keys.
        if isinstance(content, str):
            try:
                parsed_content = json.loads(content)
                if isinstance(parsed_content, dict):
                    if material_type == "flashcards" and isinstance(parsed_content.get("cards"), list):
                        content = parsed_content
                        logger.info("[REPAIR] Decoded string content to flashcard dict with cards")
                    elif material_type in ["exam", "quiz"] and isinstance(parsed_content.get("questions"), list):
                        content = parsed_content
                        logger.info("[REPAIR] Decoded string content to exam/quiz dict with questions")
                    else:
                        # Parsed but not useful — treat as absent so whitelist/root search kicks in
                        logger.warning("[REPAIR] String content decoded but lacks expected keys (%s): %s", material_type, list(parsed_content.keys()))
                        content = None
            except (json.JSONDecodeError, ValueError):
                content = None

        # Candidate keys that we know LLMs use for 'content'
        whitelist = ["examJSON", "examJson", "exam_json", "exam", "quizJSON", "quiz_json", "quiz", "flashcardsJSON", "flashcards", "questions"]

        for key in whitelist:
            if key in raw_payload and not content:
                val = raw_payload[key]
                # Map to content
                if material_type in ["exam", "quiz"] and isinstance(val, list):
                    content = {"questions": val}
                elif material_type == "flashcards" and isinstance(val, list):
                    content = {"cards": val}
                else:
                    content = val
                logger.warning(f"[REPAIR] Mapped whitelisted key '{key}' to 'content'")
                break
        
        # If still no content, check if the root itself looks like the content
        if not content:
            if "questions" in raw_payload or "cards" in raw_payload or "sections" in raw_payload:
                content = raw_payload
                logger.info("[REPAIR] Root dict looks like canonical content. Using as-is.")
            else:
                # TRULY unknown structure
                raise NonRetriableGenerationError(f"Rejected unknown LLM structure. Missing 'content' or whitelisted keys in: {list(raw_payload.keys())}")
    else:
        raise NonRetriableGenerationError(f"Rejected invalid LLM payload type: {type(raw_payload).__name__}")

    # 3. Canonical Structure Construction
    normalized = {
        "type": material_type,
        "content": content,
        "metadata": {
            "model": model or "unknown",
            "provider": "ollama",
            "difficulty": difficulty or "intermediate",
            "count": len(content.get("questions", content.get("cards", []))) if isinstance(content, dict) else 0,
            "version": "v2",
            "additional_info": {
                "topic": topic,
                "subject_id": subject_id
            }
        }
    }

    # 4. Canonical Field Enforcement (Mandatory transformations)
    if material_type == "exam" and isinstance(content, dict):
        # ID Stringification and Answer Sheet Sync (Whitelisted Repair)
        questions = content.get("questions") or []
        raw_answer_sheet = content.get("answer_sheet")
        
        normalized_questions = []
        answer_sheet_map = {}

        for q in questions:
            if not isinstance(q, dict): continue
            
            # Legacy mapping
            if "id" not in q and "question_id" in q:
                q["id"] = q["question_id"]
            
            # Ensure ID is string
            qid = q.get("id")
            if qid is None:
                import uuid
                qid = str(uuid.uuid4())
            q["id"] = str(qid)

            # Strict default for missing required fields (let Pydantic decide if error)
            if "difficulty" not in q: q["difficulty"] = difficulty
            
            # REPAIR: Ensure answer_space is present for frontend rendering
            if str(q.get("answer_space") or "").strip() == "":
                q["answer_space"] = "Write your answer clearly and concisely..."
            
            normalized_questions.append(q)
            answer_sheet_map[q["id"]] = q.get("answer", "N/A")

        # Build list-based answer_sheet
        final_answer_sheet = []
        if isinstance(raw_answer_sheet, list):
            for item in raw_answer_sheet:
                if isinstance(item, dict):
                    qid = item.get("question_id") or item.get("id")
                    if qid:
                        final_answer_sheet.append({
                            "question_id": str(qid),
                            "answer": str(item.get("answer") or "N/A"),
                            "explanation": str(item.get("explanation") or "")
                        })
        
        # Resilient Fallback: If answer_sheet was missing but raw content had 'answer' fields, 
        # or if we need to reconstruct it from the map we built above.
        if not final_answer_sheet and answer_sheet_map:
            logger.info("[REPAIR] Reconstructing answer_sheet from question 'answer' fields")
            for qid, ans in answer_sheet_map.items():
                final_answer_sheet.append({
                    "question_id": qid,
                    "answer": ans,
                    "explanation": ""
                })

        content["questions"] = normalized_questions
        content["answer_sheet"] = final_answer_sheet
    
    # Generic ID recovery for all types (if list of questions/cards exists but id is missing)
    if isinstance(content, dict):
        for key in ["questions", "cards"]:
            if key in content and isinstance(content[key], list):
                for idx, item in enumerate(content[key], start=1):
                    if isinstance(item, dict) and "id" not in item:
                        item["id"] = str(idx)

    # 5. Final Pydantic Structural Pass
    # This ensures that even after repairs, the object adheres to the base schema
    # but we catch and wrap validation errors to make them retriable if possible.
    try:
        from .schemas import ExamOutput, QuizOutput, FlashcardsOutput, SummaryOutput
        schema_map = {
            "exam": ExamOutput,
            "quiz": QuizOutput,
            "flashcards": FlashcardsOutput,
            "summary": SummaryOutput
        }
        if material_type in schema_map:
            # We use the schema to validate structure.
            schema_map[material_type](**normalized)
            logger.info(f"[SUCCESS] Normalized {material_type} passed validation.")
    except ValidationError as e:
        logger.error(f"[SCHEMA_FAIL] Normalized result failed final validation: {e}")
        # We don't raise here yet, as downstream might still handle a partial dict,
        # but normalize_to_canonical is often the last step.
    except Exception as e:
        logger.error(f"[SCHEMA_CRASH] Validation crashed: {e}")
    
    return normalized


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
    subject_id: Optional[str] = None,
    options: Optional[Dict[str, Any]] = None
) -> Union[str, Dict[str, Any]]:
    """Combine chunks into context and call Ollama to generate study material."""
    if not chunks:
        return "Not enough context to generate material."

    if material_type == "summary":
        # Summaries should be routed through summary_pipeline.generate_summary
        # This block is kept for safety but should ideally not be reached for summaries.
        from .summary_pipeline import generate_summary
        return generate_summary(
            chunks,
            topic=topic,
            language=language,
            difficulty=difficulty,
            summary_mode=(options or {}).get("summary_mode") or (options or {}).get("generation_options", {}).get("summary_mode")
        )

    context = _build_generation_context(chunks)

    student_profile: Optional[Dict[str, Any]] = None
    if material_type in ("quiz", "exam") and user_id:
        try:
            from .student_model import get_student

            student_profile = get_student(user_id)
            logger.info(
                "[ADAPTIVE] Loaded student profile for user_id=%s type=%s accuracy=%.3f weak_topics=%s",
                user_id, material_type,
                float(student_profile.get("accuracy", 0.5)),
                student_profile.get("weak_topics", []),
            )
        except Exception as e:
            logger.warning("Student profile lookup failed for user_id=%s: %s", user_id, e)

    # Enforce strict 10-question cap for exams as requested
    if material_type == "exam" and isinstance(count, int) and count > 10:
        logger.info(f"[CAP] Reducing requested exam count from {count} to 10")
        count = 10

    prompt = build_prompt(
        material_type,
        context,
        topic,
        language,
        count=count,
        difficulty_override=difficulty,
        student_profile=student_profile,
        difficulty=difficulty,
        options=options,
    )

    # Scale num_predict based on requested count (base 512 + 150/q)
    items_count = count if count and count > 0 else 5
    dynamic_num_predict = min(4096, 512 + items_count * 150)

    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
        "options": {
            "num_ctx": 16384,
            "num_predict": dynamic_num_predict,
            "temperature": 0.7,
        }
    }
    if material_type == "summary":
        payload["system"] = _build_summary_system_prompt()
    else:
        payload["format"] = "json"

    # Accumulators for additive generation
    final_questions = []
    final_answer_sheet = []
    final_cards = []

    for attempt in range(retries):
        try:
            # Calculate what we still need
            current_count_needed = count - (len(final_questions) or len(final_cards))
            if current_count_needed <= 0 and (final_questions or final_cards):
                break

            existing_titles = [q.get("question") or q.get("front") for q in (final_questions or final_cards)]
            
            prompt = build_prompt(
                material_type,
                context,
                topic,
                language,
                count=current_count_needed,
                difficulty_override=difficulty,
                student_profile=student_profile,
                difficulty=difficulty,
                existing_items=existing_titles if existing_titles else None,
                options=options
            )

            payload["prompt"] = prompt
            timeout = get_dynamic_timeout(current_count_needed or 5)

            logger.info(
                "LLM generation start material_type=%s attempt=%d/%d timeout=%s (needed=%d)",
                material_type, attempt + 1, retries, str(timeout), current_count_needed
            )
            
            req_started = time.perf_counter()
            generated_text = _stream_ollama_generate(payload, timeout=timeout, material_type=material_type)
            req_ended = time.perf_counter()

            if not generated_text.strip():
                if attempt < retries - 1:
                    logger.warning("[RETRY_REASON] attempt=%d/%d reason=empty_output", attempt+1, retries)
                    continue
                break

            duration_ms = int((req_ended - req_started) * 1000)
            logger.info("[RAW_LLM_OUTPUT] %s", generated_text)

            # 2. Parsing and Normalization
            parsed_payload = None
            try:
                cleaned = _strip_markdown_fences(generated_text)
                parsed_payload = json.loads(cleaned)
            except json.JSONDecodeError as e:
                logger.error("JSON parse failed: %s", e)
                if attempt < retries - 1:
                    logger.warning("[RETRY_REASON] attempt=%d/%d reason=invalid_json", attempt + 1, retries)
                    continue
                raise

            normalized_json = normalize_to_canonical(
                parsed_payload, 
                material_type, 
                OLLAMA_GENERATION_MODEL, 
                difficulty,
                topic=topic,
                subject_id=subject_id
            )
            
            logger.info("[NORMALIZED_OUTPUT] %s", json.dumps(normalized_json))

            # Extract new content
            new_content = normalized_json.get("content") or {}
            new_qs = new_content.get("questions") or []
            new_as = new_content.get("answer_sheet") or []
            new_cs = new_content.get("cards") or []

            # Append to accumulators
            final_questions.extend(new_qs)
            final_answer_sheet.extend(new_as)
            final_cards.extend(new_cs)

            # Check if we have enough
            total_count = len(final_questions) or len(final_cards)
            if total_count >= (count or 5) * 0.8:
                break
            
            logger.info(f"Insufficient count: have {total_count}/{count}. Retrying additive...")

        except Exception as e:
            logger.error("Unexpected error in generation material_type=%s error=%s attempt=%d/%d", material_type, e, attempt+1, retries)
            if attempt < retries - 1:
                continue
            if not (final_questions or final_cards):
                raise

    # Final Assembly and Re-indexing
    result_content = {}
    if material_type == "flashcards":
        result_content["cards"] = final_cards
    elif material_type == "exam":
        # Re-index to ensure ID consistency after merging
        new_questions = []
        new_answer_sheet = []
        
        # Robust Merging: Separate loops to handle mismatching lengths
        for idx, q in enumerate(final_questions, start=1):
            q["id"] = str(idx)
            new_questions.append(q)
            
        # Try to match answer sheet items by position if they were collected in lock-step
        for idx, a in enumerate(final_answer_sheet, start=1):
            if idx <= len(new_questions):
                a["question_id"] = str(idx)
                new_answer_sheet.append(a)
            else:
                logger.warning(f"[MERGE_MISMATCH] Extra answer item {idx} dropped (no matching question)")

        result_content["questions"] = new_questions
        result_content["answer_sheet"] = new_answer_sheet
    else: # quiz
        new_questions = []
        for idx, q in enumerate(final_questions, start=1):
            q["id"] = str(idx)
            new_questions.append(q)
        result_content["questions"] = new_questions

    final_output = {
        "type": material_type,
        "content": result_content,
        "metadata": {
            "model": OLLAMA_GENERATION_MODEL,
            "provider": "ollama",
            "count": len(final_questions) or len(final_cards),
            "requested_count": count,
            "version": "v2-additive"
        }
    }
    
    logger.info("[TERMINAL_STATE] SUCCESS material_type=%s total_count=%d", material_type, final_output["metadata"]["count"])
    return final_output


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
            val = sub.get("question_id")
            q_id = int(val) if val is not None else 0
            if q_id == 0: continue
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


async def condense_question(
    question: str,
    history: List[Dict[str, str]],
    language: str = "en",
    timeout: int = 15,
) -> str:
    """
    Rephrase a follow-up question into a standalone version that captures
    the necessary context from previous turns. Essential for accurate retrieval.
    """
    if not history:
        return question



async def generate_structured_chat(
    chunks: List[Dict[str, Any]],
    question: str,
    history: Optional[List[Dict[str, str]]] = None,
    language: str = "en",
    timeout: int = OLLAMA_CHAT_TIMEOUT,
) -> Dict[str, Any]:
    """Generate a structured chat response with strict grounding and evidence validation."""
    history = history or []

    # --- Build numbered context block ---
    context_parts: List[str] = []
    for chunk in chunks:
        cid = chunk.get("id", "?")
        page = chunk.get("page_number")
        page_str = f", page {page}" if page is not None else ""
        snippet = str(chunk.get("content", "")).strip()
        context_parts.append(f"[{cid}{page_str}] {snippet}")
    context_block = "\n\n".join(context_parts) if context_parts else "No context available."

    # --- Build conversation history block ---
    history_lines: List[str] = []
    for msg in history[-10:]:
        role = str(msg.get("role", "user")).capitalize()
        content = str(msg.get("content", "")).strip()
        if content:
            history_lines.append(f"{role}: {content}")
    history_block = "\n".join(history_lines) if history_lines else "None"

    # --- Prompt — Strict Cognify AI Tutor ---
    prompt = (
        "You are Cognify AI Tutor. Your absolute priority is accuracy and groundedness.\n\n"
        "STRICT GROUNDING RULES:\n"
        "1. USE ONLY PROVIDED CONTEXT: Your answer MUST be based SOLELY on the numbered context passages below.\n"
        "2. NO GENERAL KNOWLEDGE: Do not use your own knowledge or guess. If the answer is not in the context, set 'supported' to false.\n"
        "3. EVIDENCE REQUIRED: In 'evidence', list the [ID] values of every passage used to build your answer.\n"
        "4. CONCISE & CLEAR: Keep your answer helpful but focused strictly on the facts in the material.\n\n"
        
        "CONTEXT PASSAGES:\n"
        "---\n"
        f"{context_block}\n"
        "---\n\n"

        "CONVERSATION HISTORY:\n"
        f"{history_block}\n\n"

        f"STUDENT QUESTION: {question}\n\n"

        "OUTPUT FORMAT: You must respond ONLY with a single JSON object with this exact structure:\n"
        "{\n"
        '  "answer": "Your concise answer here",\n'
        '  "supported": true/false,\n'
        '  "evidence": [list of IDs used]\n'
        "}\n\n"
        "If the answer is not explicitly found in the context, set 'supported' to false and 'evidence' to [].\n"
        "Generate the JSON now:"
    )

    payload: Dict[str, Any] = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": prompt,
    }

    try:
        raw = await _async_stream_ollama_generate(payload, timeout=timeout, material_type="structured_chat")
        if not raw.strip():
            raise ValueError("Empty LLM output")

        cleaned = _extract_json_payload(raw)
        parsed = json.loads(cleaned)

        answer = str(parsed.get("answer", "")).strip()
        supported = bool(parsed.get("supported", False))
        evidence = parsed.get("evidence", [])

        cited_ids: List[int] = []
        for eid in (evidence if isinstance(evidence, list) else []):
            try:
                cited_ids.append(int(eid))
            except (TypeError, ValueError):
                pass

        # The retrieval similarity threshold is the primary grounding gate.
        # The LLM's `supported` flag is a secondary signal; local models
        # often return supported=false even when they produce a correct answer.
        if not answer or answer.lower().startswith("i couldn't find") or answer.lower().startswith("i could not find"):
            return {
                "answer": "I couldn't find that information in the selected material.",
                "cited_ids": [],
                "confidence": 0.0,
                "fallback": False
            }

        if not supported or not cited_ids:
            logger.info("LLM said supported=%s evidence=%s but answer has content; trusting retrieval gate", supported, evidence)

        return {
            "answer": answer,
            "cited_ids": cited_ids,
            "confidence": 1.0 if supported and cited_ids else 0.7,
            "fallback": False
        }


    except Exception as e:
        logger.warning("Structured chat failed: %s", e)
        return {
            "answer": "I couldn't find that information in the selected material.",
            "cited_ids": [],
            "confidence": 0.0,
            "fallback": True
        }

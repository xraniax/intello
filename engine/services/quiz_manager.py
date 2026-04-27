"""
Adaptive quiz manager — single source of truth for all adaptive quiz logic.

Responsibilities:
  - Session difficulty tracking (streak-based)
  - Student model persistence delegation
  - Context retrieval coordination
  - LLM question generation delegation

api.py routes are thin controllers that call into this module only.
"""
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger("engine-quiz-manager")

# Difficulty levels: 1 = easy, 2 = medium, 3 = hard
_DIFFICULTY_MAP: Dict[int, str] = {1: "easy", 2: "medium", 3: "hard"}
_STREAK_UPGRADE_THRESHOLD = 3


def _clamp_difficulty(level: int) -> int:
    return max(1, min(3, level))


def _resolve_difficulty_label(session: Dict[str, Any]) -> str:
    return _DIFFICULTY_MAP[_clamp_difficulty(int(session.get("current_difficulty", 1)))]


def _default_session() -> Dict[str, Any]:
    return {"correct_streak": 0, "current_difficulty": 1, "total": 0}


def _advance_session(session: Dict[str, Any], *, is_correct: bool) -> Dict[str, Any]:
    """Return a new session dict with streak and difficulty updated for one answer."""
    session = dict(session)
    session["total"] = int(session.get("total", 0)) + 1

    if is_correct:
        session["correct_streak"] = int(session.get("correct_streak", 0)) + 1
    else:
        session["correct_streak"] = 0

    difficulty = _clamp_difficulty(int(session.get("current_difficulty", 1)))
    if session["correct_streak"] >= _STREAK_UPGRADE_THRESHOLD:
        difficulty = min(3, difficulty + 1)
    if not is_correct:
        difficulty = max(1, difficulty - 1)
    session["current_difficulty"] = difficulty

    return session


def _build_progress(student: Dict[str, Any], session: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "accuracy": float(student.get("accuracy", 0.5)),
        "weak_topics": list(student.get("weak_topics") or []),
        "strong_topics": list(student.get("strong_topics") or []),
        "difficulty": _resolve_difficulty_label(session),
    }


def _fetch_chunk_texts(
    db: Session, subject_id: str, topic: Optional[str], top_k: int
) -> List[str]:
    from .retrieval import retrieve_chunks_by_topic

    chunks = retrieve_chunks_by_topic(db, subject_id, topic, int(top_k))
    texts = [c.content for c in chunks if c.content]
    if not texts:
        raise ValueError("No retrieval context found for this subject/topic.")
    return texts


def next_question_only(
    *,
    user_id: str,
    subject_id: str,
    topic: Optional[str],
    language: str,
    top_k: int,
    db: Session,
) -> Dict[str, Any]:
    """
    Return the first question of an adaptive session.

    Does NOT update the student model — the student has not answered yet.
    Persists an initial session record so subsequent submit calls have a
    baseline to advance from.
    """
    from .student_model import get_student
    from .generation import generate_single_quiz_question
    from .redis_client import get_quiz_session, update_quiz_session

    session = get_quiz_session(user_id, subject_id) or _default_session()
    student = get_student(user_id)
    chunk_texts = _fetch_chunk_texts(db, subject_id, topic, top_k)

    question = generate_single_quiz_question(
        chunks=chunk_texts,
        student_profile=student,
        topic=topic,
        language=language,
    )

    # Persist so the session key exists before the first answer arrives.
    update_quiz_session(user_id, subject_id, session)

    logger.info(
        "next_question_only user=%s subject=%s difficulty=%s",
        user_id,
        subject_id,
        _resolve_difficulty_label(session),
    )

    return {
        "question": question,
        "progress": _build_progress(student, session),
        "session": session,
    }


def submit_answer_and_get_next(
    *,
    user_id: str,
    subject_id: str,
    topic: Optional[str],
    is_correct: bool,
    response_time: float,
    language: str,
    top_k: int,
    db: Session,
) -> Dict[str, Any]:
    """
    Record the student's answer, update adaptive state, and return the next question.

    Sequence:
      1. Persist answer metrics to student model (accuracy, response time, topic strength).
      2. Advance session difficulty/streak based on correctness.
      3. Reload student profile so the next question reflects the updated accuracy.
      4. Retrieve context chunks and generate the next question.
    """
    from .student_model import update_student_performance, get_student
    from .generation import generate_single_quiz_question
    from .redis_client import get_quiz_session, update_quiz_session

    # 1. Persist answer to the student model.
    update_student_performance(
        user_id=user_id,
        is_correct=is_correct,
        response_time=float(response_time),
        topic=str(topic or "general"),
    )

    # 2. Advance session difficulty / streak.
    session = get_quiz_session(user_id, subject_id) or _default_session()
    session = _advance_session(session, is_correct=is_correct)
    update_quiz_session(user_id, subject_id, session)

    # 3. Reload updated student profile (accuracy now reflects this answer).
    student = get_student(user_id)

    # 4. Retrieve context and generate the next question.
    chunk_texts = _fetch_chunk_texts(db, subject_id, topic, top_k)
    question = generate_single_quiz_question(
        chunks=chunk_texts,
        student_profile=student,
        topic=topic,
        language=language,
    )

    logger.info(
        "submit_answer_and_get_next user=%s subject=%s correct=%s difficulty=%s accuracy=%.3f",
        user_id,
        subject_id,
        is_correct,
        _resolve_difficulty_label(session),
        float(student.get("accuracy", 0.5)),
    )

    return {
        "question": question,
        "progress": _build_progress(student, session),
        "session": session,
    }

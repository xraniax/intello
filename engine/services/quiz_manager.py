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

_DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced"]


def _ensure_list(value) -> list:
    """Return value as a list; collapse None/str to empty list (Redis round-trip safety)."""
    if value is None or isinstance(value, str):
        return []
    if isinstance(value, list):
        return value
    try:
        return list(value)
    except TypeError:
        return []


def resolve_quiz_difficulty(
    mode: str,
    ui_difficulty: str,
    session_state: Dict[str, Any],
    student_profile: Dict[str, Any],
    last_answer_correct: Optional[bool],
) -> str:
    """Single source of truth for quiz difficulty resolution."""
    if ui_difficulty not in _DIFFICULTY_LEVELS:
        ui_difficulty = "intermediate"

    if mode == "fixed":
        return ui_difficulty

    base_idx = _DIFFICULTY_LEVELS.index(ui_difficulty)
    
    # Initial question
    if last_answer_correct is None:
        accuracy = float(student_profile.get("accuracy", 0.5))
        if accuracy >= 0.8:
            return _DIFFICULTY_LEVELS[min(2, base_idx + 1)]
        elif accuracy <= 0.4:
            return _DIFFICULTY_LEVELS[max(0, base_idx - 1)]
        return ui_difficulty

    history = session_state.get("difficulty_history") or []
    if history:
        prev_diff = history[-1]
        prev_idx = _DIFFICULTY_LEVELS.index(prev_diff) if prev_diff in _DIFFICULTY_LEVELS else base_idx
    else:
        prev_idx = base_idx

    streak_count = int(session_state.get("streak_count", 0))
    accuracy = float(student_profile.get("accuracy", 0.5))

    next_idx = prev_idx

    if last_answer_correct is True:
        if streak_count >= 2:
            next_idx += 1
    else:
        next_idx -= 1

    # Bias
    if accuracy >= 0.85 and next_idx < 2 and streak_count >= 1:
        next_idx += 1
    elif accuracy <= 0.35 and next_idx > 0:
        next_idx -= 1

    # Clamp bounds to base ± 1 (anchor constraints)
    max_idx = min(2, base_idx + 1)
    min_idx = max(0, base_idx - 1)
    
    # Smooth transitions (±1 step max)
    if next_idx > prev_idx + 1:
        next_idx = prev_idx + 1
    elif next_idx < prev_idx - 1:
        next_idx = prev_idx - 1

    next_idx = max(min_idx, min(max_idx, next_idx))

    return _DIFFICULTY_LEVELS[next_idx]


def _default_session(ui_difficulty: str = "intermediate") -> Dict[str, Any]:
    return {
        "streak_count": 0,
        "total": 0,
        "difficulty_history": [],
        "ui_difficulty": ui_difficulty,
        "last_concept": None,
    }


def _build_progress(student: Dict[str, Any], session: Dict[str, Any], current_difficulty: str) -> Dict[str, Any]:
    return {
        "accuracy": float(student.get("accuracy", 0.5)),
        "weak_concepts": list(student.get("weak_concepts") or []),
        "strong_concepts": list(student.get("strong_concepts") or []),
        "difficulty": current_difficulty,
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


def _extract_concept_names(concepts: List[Any]) -> List[str]:
    names: List[str] = []
    for concept in concepts:
        if isinstance(concept, dict):
            raw = concept.get("name")
        elif isinstance(concept, str):
            raw = concept
        else:
            raw = None
        if raw:
            name = str(raw).strip()
            if name != raw:
                logger.debug("[CONCEPT] name sanitized %r → %r", raw, name)
            if name:
                names.append(name)
            else:
                logger.warning("[CONCEPT] dropped empty name after strip raw=%r", raw)
    return names


def _select_target_concept(
    subject_id: str,
    difficulty: str,
    weak_concepts: List[str],
    last_concept: Optional[str] = None,
) -> str:
    from .knowledge_graph_service import get_concepts_by_difficulty, get_subject_graph

    concepts = get_concepts_by_difficulty(subject_id, difficulty)
    concept_names = _extract_concept_names(concepts)
    logger.info(
        "_select_target_concept subject_id=%s difficulty=%s graph_concepts=%d last_concept=%r",
        subject_id, difficulty, len(concept_names), last_concept,
    )

    # Widen to all graph tiers when the target difficulty band is empty.
    if not concept_names:
        graph = get_subject_graph(subject_id)
        if graph:
            for cat in ("core_concepts", "supporting_concepts", "minor_concepts"):
                concept_names = _extract_concept_names(graph.get(cat) or [])
                if concept_names:
                    break

    if not concept_names:
        raise ValueError(f"No concepts available for subject_id={subject_id}")

    # Prefer weak concepts; rotate away from last_concept to avoid back-to-back repeats.
    weak_set = set(weak_concepts)
    weak_matches = [name for name in concept_names if name in weak_set]
    if weak_matches:
        if last_concept and len(weak_matches) > 1:
            rotated = [c for c in weak_matches if c != last_concept]
            return rotated[0] if rotated else weak_matches[0]
        return weak_matches[0]

    # No weak match: skip last_concept when alternatives exist.
    if last_concept and len(concept_names) > 1:
        non_last = [n for n in concept_names if n != last_concept]
        return non_last[0] if non_last else concept_names[0]

    return concept_names[0]


def _get_domain_concepts(subject_id: str) -> Optional[set]:
    """Return the set of all concept names in the subject's knowledge graph, or None if not cached."""
    from .knowledge_graph_service import get_subject_graph
    graph = get_subject_graph(subject_id)
    if not graph:
        return None
    names: set = set()
    for cat in ("core_concepts", "supporting_concepts", "minor_concepts"):
        for c in graph.get(cat) or []:
            name = c.get("name") if isinstance(c, dict) else None
            if name:
                names.add(name)
    return names if names else None


def _filter_student_profile_to_domain(
    student: Dict[str, Any],
    subject_id: str,
) -> Dict[str, Any]:
    """
    Return a copy of the student profile with weak/strong concepts restricted to
    concepts present in the current subject's knowledge graph.  Global accuracy
    is kept unchanged — only the concept lists are domain-scoped.
    """
    domain = _get_domain_concepts(subject_id)
    weak_all: List[str] = list(student.get("weak_concepts") or [])
    strong_all: List[str] = list(student.get("strong_concepts") or [])

    if domain is None:
        logger.warning(
            "[ADAPTIVE_DOMAIN] subject=%s no knowledge graph — keeping unfiltered concepts "
            "weak=%d strong=%d",
            subject_id, len(weak_all), len(strong_all),
        )
        return student

    weak_filtered  = [c for c in weak_all  if c in domain]
    strong_filtered = [c for c in strong_all if c in domain]
    excluded_weak   = [c for c in weak_all  if c not in domain]
    excluded_strong = [c for c in strong_all if c not in domain]

    logger.info(
        "[ADAPTIVE_DOMAIN] subject=%s "
        "weak_filtered=%s excluded_weak=%s "
        "strong_filtered=%s excluded_strong=%s",
        subject_id, weak_filtered, excluded_weak, strong_filtered, excluded_strong,
    )

    return {
        **student,
        "weak_concepts": weak_filtered,
        "strong_concepts": strong_filtered,
    }


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
    from .generation import generate_validated_quiz_question
    from .redis_client import get_quiz_session, update_quiz_session

    ui_difficulty = "intermediate"  # Can be parameterized via API later
    session = get_quiz_session(user_id, subject_id) or _default_session(ui_difficulty)
    session["difficulty_history"] = _ensure_list(session.get("difficulty_history"))
    student = get_student(user_id)
    student = _filter_student_profile_to_domain(student, subject_id)

    difficulty = resolve_quiz_difficulty(
        mode="adaptive",
        ui_difficulty=ui_difficulty,
        session_state=session,
        student_profile=student,
        last_answer_correct=None
    )

    session["difficulty_history"] = [difficulty]
    # weak_concepts is loaded from the canonical Redis SET (student model, DB 1).
    # It is never stored in the session hash.
    weak_concepts = list(student.get("weak_concepts") or [])

    target_concept = _select_target_concept(
        subject_id, difficulty, weak_concepts,
        last_concept=session.get("last_concept"),
    )

    distractor_pool = []
    if target_concept:
        from .knowledge_graph_service import get_related_concepts
        distractor_pool = get_related_concepts(subject_id, target_concept)

    chunk_texts = _fetch_chunk_texts(db, subject_id, target_concept, top_k)

    question = generate_validated_quiz_question(
        chunks=chunk_texts,
        difficulty=difficulty,
        target_concept=target_concept,
        distractor_pool=distractor_pool,
        language=language,
    )

    # Must be set before persist so the first submit call reads the correct concept.
    session["last_concept"] = target_concept
    update_quiz_session(user_id, subject_id, session)

    logger.info(
        "next_question_only user=%s subject=%s difficulty=%s concept=%s",
        user_id, subject_id, difficulty, target_concept or "<none>",
    )

    return {
        "question": question,
        "progress": _build_progress(student, session, difficulty),
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
    from .generation import generate_validated_quiz_question
    from .redis_client import get_quiz_session, update_quiz_session

    # Step 1: Load session to retrieve the concept from the question that was just answered.
    session = get_quiz_session(user_id, subject_id) or _default_session("intermediate")
    session["difficulty_history"] = _ensure_list(session.get("difficulty_history"))
    raw_concept = session.get("last_concept")
    current_concept = str(raw_concept).strip() if raw_concept else None

    if not current_concept:
        raise ValueError(
            f"last_concept missing from session for user_id={user_id} subject_id={subject_id}"
        )

    # Persist answer to the student model; concept=None skips concept-level tracking.
    update_student_performance(
        user_id=user_id,
        is_correct=is_correct,
        response_time=float(response_time),
        concept=current_concept,
    )
    # Reload updated student profile (accuracy now reflects this answer).
    student = get_student(user_id)
    student = _filter_student_profile_to_domain(student, subject_id)

    # Step 2: Update session state
    session["total"] = int(session.get("total", 0)) + 1
    if is_correct:
        session["streak_count"] = int(session.get("streak_count", 0)) + 1
    else:
        session["streak_count"] = 0

    # weak_concepts is loaded from the canonical Redis SET (student model, DB 1).
    # It is never stored in the session hash.
    weak_concepts = list(student.get("weak_concepts") or [])
    ui_diff = session.get("ui_difficulty", "intermediate")

    # Step 3: Call resolver
    difficulty = resolve_quiz_difficulty(
        mode="adaptive",
        ui_difficulty=ui_diff,
        session_state=session,
        student_profile=student,
        last_answer_correct=is_correct
    )

    history = session.get("difficulty_history", [])
    history.append(difficulty)
    session["difficulty_history"] = history

    # Step 4: Generate the next question.
    target_concept = _select_target_concept(
        subject_id, difficulty, weak_concepts,
        last_concept=current_concept,
    )

    distractor_pool = []
    if target_concept:
        from .knowledge_graph_service import get_related_concepts
        distractor_pool = get_related_concepts(subject_id, target_concept)

    chunk_texts = _fetch_chunk_texts(db, subject_id, target_concept, top_k)

    question = generate_validated_quiz_question(
        chunks=chunk_texts,
        difficulty=difficulty,
        target_concept=target_concept,
        distractor_pool=distractor_pool,
        language=language,
    )

    # Must be set before persist so the next submit call reads the correct concept.
    session["last_concept"] = target_concept
    update_quiz_session(user_id, subject_id, session)

    logger.info(
        "submit_answer_and_get_next user=%s subject=%s correct=%s difficulty=%s concept=%s accuracy=%.3f",
        user_id, subject_id, is_correct, difficulty,
        target_concept or "<none>", float(student.get("accuracy", 0.5)),
    )

    return {
        "question": question,
        "progress": _build_progress(student, session, difficulty),
        "session": session,
    }

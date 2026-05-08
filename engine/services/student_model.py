import os
import logging
from typing import Dict, Any

import redis

from .redis_client import get_concepts, add_concept, remove_concept

logger = logging.getLogger("engine-student-model")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/1")

# Simple tuning knobs for concept classification.
STRONG_CONCEPT_MIN_CORRECT = int(os.getenv("STUDENT_STRONG_CONCEPT_MIN_CORRECT", "2"))
ACCURACY_STEP = float(os.getenv("STUDENT_ACCURACY_STEP", "0.05"))


def _get_redis_client() -> redis.Redis:
    return redis.from_url(REDIS_URL, decode_responses=True)


def _student_key(user_id: str) -> str:
    return f"student:{user_id}"


def _weak_concepts_key(user_id: str) -> str:
    return f"student:{user_id}:weak_concepts"


def _strong_concepts_key(user_id: str) -> str:
    return f"student:{user_id}:strong_concepts"


def _concept_correct_count_key(user_id: str) -> str:
    return f"student:{user_id}:concept_correct_count"


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def get_student(user_id: str) -> Dict[str, Any]:
    """Return student profile from Redis with safe defaults when missing."""
    if not user_id:
        raise ValueError("user_id is required")

    client = _get_redis_client()
    base_key = _student_key(user_id)

    data = client.hgetall(base_key)

    accuracy = float(data.get("accuracy", 0.5))
    avg_response_time = float(data.get("avg_response_time", 0.0))

    weak_concepts   = sorted(get_concepts(_weak_concepts_key(user_id),   client))
    strong_concepts = sorted(get_concepts(_strong_concepts_key(user_id), client))

    return {
        "accuracy": accuracy,
        "avg_response_time": avg_response_time,
        "weak_concepts": weak_concepts,
        "strong_concepts": strong_concepts,
    }


def update_student_performance(
    user_id: str,
    is_correct: bool,
    response_time: float,
    concept: str = None,
    topic: str = None,
) -> Dict[str, Any]:
    """Update student metrics using simple rule-based tracking in Redis."""
    if not user_id:
        raise ValueError("user_id is required")
    if response_time < 0:
        raise ValueError("response_time must be >= 0")

    client = _get_redis_client()
    base_key = _student_key(user_id)

    # Read current counters/metrics.
    current = client.hgetall(base_key)
    attempts = int(current.get("attempts", 0))
    correct_count = int(current.get("correct_count", 0))
    accuracy = float(current.get("accuracy", 0.5))
    avg_response_time = float(current.get("avg_response_time", 0.0))

    # Update counters.
    attempts += 1
    if is_correct:
        correct_count += 1

    # Rolling average response time.
    if attempts == 1:
        new_avg_response_time = float(response_time)
    else:
        new_avg_response_time = ((avg_response_time * (attempts - 1)) + float(response_time)) / attempts

    # Accuracy update: blend empirical accuracy with a small step signal.
    empirical_accuracy = correct_count / attempts
    step = ACCURACY_STEP if is_correct else -ACCURACY_STEP
    adjusted_accuracy = _clamp(accuracy + step, 0.0, 1.0)
    new_accuracy = (empirical_accuracy + adjusted_accuracy) / 2.0

    # Concept strength/weakness updates.
    resolved_concept = concept or topic
    if resolved_concept:
        weak_key = _weak_concepts_key(user_id)
        strong_key = _strong_concepts_key(user_id)

        if is_correct:
            concept_count = client.hincrby(_concept_correct_count_key(user_id), resolved_concept, 1)
            if concept_count >= STRONG_CONCEPT_MIN_CORRECT:
                add_concept(strong_key, resolved_concept, client)
                remove_concept(weak_key, resolved_concept, client)
        else:
            add_concept(weak_key, resolved_concept, client)
            remove_concept(strong_key, resolved_concept, client)

    # Persist updated metrics.
    client.hset(
        base_key,
        mapping={
            "attempts": attempts,
            "correct_count": correct_count,
            "accuracy": f"{new_accuracy:.6f}",
            "avg_response_time": f"{new_avg_response_time:.6f}",
        },
    )

    logger.debug(
        "Updated student model user_id=%s attempts=%d correct=%d accuracy=%.4f avg_response_time=%.4f",
        user_id,
        attempts,
        correct_count,
        new_accuracy,
        new_avg_response_time,
    )

    return get_student(user_id)

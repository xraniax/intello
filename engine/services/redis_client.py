import os
from typing import Optional, Dict, Any

import redis

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
QUIZ_SESSION_TTL_SECONDS = 3600

_client: Optional[redis.Redis] = None


def _get_client() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    return _client


def _quiz_session_key(user_id: str, subject_id: str) -> str:
    return f"quiz_session:{user_id}:{subject_id}"


def _stringify_value(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


def _parse_hash_value(value: str) -> Any:
    if value == "":
        return ""

    lowered = value.lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False

    try:
        if value.isdigit() or (value.startswith("-") and value[1:].isdigit()):
            return int(value)
        return float(value)
    except ValueError:
        return value


def get_quiz_session(user_id: str, subject_id: str) -> Optional[Dict[str, Any]]:
    key = _quiz_session_key(user_id, subject_id)
    raw = _get_client().hgetall(key)
    if not raw:
        return None

    parsed: Dict[str, Any] = {}
    for field, value in raw.items():
        parsed[field] = _parse_hash_value(value)
    return parsed


def update_quiz_session(user_id: str, subject_id: str, data: Dict[str, Any]) -> None:
    key = _quiz_session_key(user_id, subject_id)
    payload = {field: _stringify_value(value) for field, value in data.items()}
    client = _get_client()
    if payload:
        client.hset(key, mapping=payload)
    client.expire(key, QUIZ_SESSION_TTL_SECONDS)

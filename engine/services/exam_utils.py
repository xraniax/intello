import logging
from typing import Dict, Any

logger = logging.getLogger("engine-exam-utils")

def normalize_exam(exam: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes all exam formats into a unified runtime structure
    without modifying stored data.
    """
    if not isinstance(exam, dict):
        return {"questions": [], "answer_sheet": []}

    # Extract questions and answer_sheet according to requested logic
    if "content" in exam and isinstance(exam, dict):
        content = exam["content"]
        if isinstance(content, dict):
            questions = content.get("questions", [])
            answer_sheet = content.get("answer_sheet", [])
        else:
            # content is likely a raw string from fallback generation
            questions = []
            answer_sheet = []
    else:
        # Fallback / legacy format
        questions = exam.get("questions", [])
        answer_sheet = exam.get("answer_sheet", [])

    # Ensure they are lists
    if not isinstance(questions, list): questions = []
    if not isinstance(answer_sheet, list): answer_sheet = []

    # Apply ID normalization (preserving logic from routes/jobs.py)
    normalized_questions = []
    for idx, question in enumerate(questions, start=1):
        if isinstance(question, dict):
            normalized_questions.append({**question, "id": idx})
        else:
            normalized_questions.append(question)

    normalized_answer_sheet = []
    for idx, item in enumerate(answer_sheet, start=1):
        if isinstance(item, dict):
            normalized_answer_sheet.append({**item, "question_id": idx})
        else:
            normalized_answer_sheet.append(item)

    return {
        "questions": normalized_questions,
        "answer_sheet": normalized_answer_sheet
    }

def wrap_normalized_exam(exam_payload: Dict[str, Any], normalized_data: Dict[str, Any]) -> Dict[str, Any]:
    """Wraps normalized data back into the ExamOutput contract."""
    return {
        **exam_payload,
        "type": "exam",
        "content": {
            **(exam_payload.get("content") if isinstance(exam_payload.get("content"), dict) else {}),
            "questions": normalized_data["questions"],
            "answer_sheet": normalized_data["answer_sheet"]
        }
    }

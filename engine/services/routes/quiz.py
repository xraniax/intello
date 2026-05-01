"""Quiz routes: evaluation, adaptive next-question, and answer submission."""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .._route_utils import _stage_error_response, get_db
from ..generation import evaluate_quiz
from ..schemas import QuizEvaluateRequest, QuizEvaluateResponse, QuizNextRequest, QuizSubmitAnswerRequest

router = APIRouter()
logger = logging.getLogger("engine-api")


@router.post("/evaluate-quiz", response_model=QuizEvaluateResponse)
async def evaluate_quiz_route(body: QuizEvaluateRequest):
    """Evaluate user answers for a quiz."""
    logger.info("Evaluate quiz request: %d submissions", len(body.submissions))
    try:
        result = evaluate_quiz(
            [q.model_dump() for q in body.questions],
            [s.model_dump() for s in body.submissions],
        )
        return result
    except Exception as e:
        logger.exception("Quiz evaluation failed")
        return _stage_error_response("evaluation", "Quiz evaluation failed", details=str(e), status_code=500)


@router.post("/quiz/next")
async def quiz_next_route(body: QuizNextRequest, db: Session = Depends(get_db)):
    """Return the first adaptive question for a session."""
    from ..quiz_manager import next_question_only
    try:
        return next_question_only(user_id=body.user_id.strip(), subject_id=body.subject_id,
                                  topic=body.topic, language=body.language, top_k=body.top_k, db=db)
    except ValueError as exc:
        return _stage_error_response("quiz_next", str(exc), status_code=404)
    except Exception as exc:
        logger.exception("quiz/next failed")
        return _stage_error_response("quiz_next", "Failed to fetch question", details=str(exc), status_code=500)


@router.post("/quiz/submit-answer")
async def quiz_submit_answer_route(body: QuizSubmitAnswerRequest, db: Session = Depends(get_db)):
    """Record answer, update student model, return next adaptive question."""
    from ..quiz_manager import submit_answer_and_get_next
    try:
        return submit_answer_and_get_next(
            user_id=body.user_id.strip(), subject_id=body.subject_id, topic=body.topic,
            is_correct=body.is_correct, response_time=body.response_time,
            language=body.language, top_k=body.top_k, db=db,
        )
    except ValueError as exc:
        return _stage_error_response("quiz_submit", str(exc), status_code=404)
    except Exception as exc:
        logger.exception("quiz/submit-answer failed")
        return _stage_error_response("quiz_submit", "Failed to process answer", details=str(exc), status_code=500)

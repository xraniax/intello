import logging
import json
from fastapi import APIRouter, Depends, HTTPException
import httpx

from ..schemas import PlanGenerateRequest, StudyPlanOutput
from ..generation import OLLAMA_GENERATE_URL, OLLAMA_GENERATION_MODEL
from .._route_utils import _stage_error_response

router = APIRouter()
logger = logging.getLogger("engine-api-goals")

@router.post("/generate-plan", response_model=StudyPlanOutput)
async def generate_plan_route(body: PlanGenerateRequest):
    """Generate a study plan based on user goals using Ollama unstructured JSON generation."""
    logger.info("Generate plan request: goals=%s", len(body.goals))
    
    # Format goals for the prompt
    goals_text = "\n".join([
        f"- Goal '{g.title}' (Type: {g.type}, Target: {g.target}, Period: {g.period})" + 
        (f" Subject: {g.subject}" if g.subject else "")
        for g in body.goals
    ])
    
    prompt = f"""You are an advanced AI study assistant. The user wants a structured study plan based on their goals.
Here are the user's goals:
{goals_text}

They want to study {body.days_per_week} days a week, roughly {body.hours_per_day} hours per day.

Generate a JSON object conforming strictly to the following schema:
{{
  "type": "study_plan",
  "content": {{
    "summary": "A short motivational summary of the plan.",
    "sessions": [
      {{
        "day_of_week": "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday",
        "duration_minutes": 60,
        "focus_topic": "What to study",
        "goal_id": "optional goal id to link"
      }}
    ]
  }},
  "metadata": {{
    "difficulty": "intermediate",
    "version": "v1"
  }}
}}

Output ONLY valid JSON.
"""

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                OLLAMA_GENERATE_URL,
                json={
                    "model": OLLAMA_GENERATION_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                    "options": {
                        "temperature": 0.3
                    }
                }
            )
            
            if resp.status_code != 200:
                raise RuntimeError(f"Ollama returned {resp.status_code}: {resp.text}")
                
            result_json = resp.json()
            response_text = result_json.get("response", "{}")
            
            try:
                parsed_plan = json.loads(response_text)
                return StudyPlanOutput(**parsed_plan)
            except Exception as e:
                logger.error(f"Failed to parse Ollama JSON response: {response_text}")
                raise RuntimeError(f"Unstructured JSON parsing failed: {str(e)}")
                
    except Exception as e:
        logger.exception("Plan generation failed")
        return _stage_error_response("generate-plan", "Failed to generate study plan", details=str(e), status_code=500)

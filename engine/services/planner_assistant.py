import json
import logging
import httpx
from typing import Dict, Any
from .ollama_config import get_ollama_base_url, get_ollama_generation_model
from .planner_schemas import PlannerAssistantRequest, PlannerAssistantResponse

logger = logging.getLogger("engine-planner-assistant")

OLLAMA_BASE_URL = get_ollama_base_url()
OLLAMA_GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"
OLLAMA_GENERATION_MODEL = get_ollama_generation_model(required=True)

SYSTEM_PROMPT = """You are an expert AI Study Planner and Productivity Coach for students.
Your goal is to help students manage their goals, tasks, habits, and schedules effectively.

CAPABILITIES:
1. create_goal: Use this when the user mentions a major objective, project, or exam (e.g., "I have an exam in 4 days"). Include milestones if appropriate.
2. create_task: Use this for specific actionable items (e.g., "Help me finish project before Friday").
3. create_habit: Use this for recurring activities (e.g., "I want to start studying every morning").
4. create_schedule_block: Use this to block time in the calendar. (e.g., "I only study at night" -> block night hours).
5. update_preferences: Use this to change focus hours or active time.

CONSTRAINTS:
- Be encouraging and concise.
- Always provide a conversational 'message'.
- Generate 'actions' only when the user's intent is clear.
- If the user says "I only study at night", update their preferences AND potentially schedule blocks if they mention a specific goal.
- Dates and times should be relative to the provided 'local_time'.

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this schema:
{
  "message": "Enthusiastic response to the student",
  "reasoning": "Internal logic for why these actions were chosen",
  "actions": [
    { "action": "create_task", "title": "...", "due_date": "...", "priority": "..." },
    ...
  ]
}
"""

class PlannerAssistantService:
    @staticmethod
    async def process_request(request: PlannerAssistantRequest) -> PlannerAssistantResponse:
        logger.info(f"Processing planner assistant request for user {request.user_id}")
        
        # Build context string
        context = f"""
Current local time: {request.local_time}
Current Planner State:
{json.dumps(request.current_state, indent=2)}

User Prompt: {request.prompt}
"""

        prompt = f"{SYSTEM_PROMPT}\n\nCONTEXT:\n{context}\n\nStrictly JSON output:"

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
                            "temperature": 0.4
                        }
                    }
                )
                
                if resp.status_code != 200:
                    raise RuntimeError(f"Ollama returned {resp.status_code}: {resp.text}")
                
                result = resp.json()
                response_text = result.get("response", "{}")
                
                parsed_data = json.loads(response_text)
                return PlannerAssistantResponse(**parsed_data)
                
        except Exception as e:
            logger.exception("Planner assistant processing failed")
            return PlannerAssistantResponse(
                message="I'm sorry, I encountered an error while planning your schedule. Please try again in a moment.",
                actions=[],
                reasoning=f"Error: {str(e)}"
            )

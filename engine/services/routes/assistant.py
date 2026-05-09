from fastapi import APIRouter, HTTPException
from ..planner_schemas import PlannerAssistantRequest, PlannerAssistantResponse
from ..planner_assistant import PlannerAssistantService

router = APIRouter()

@router.post("/planner/assistant", response_model=PlannerAssistantResponse)
async def planner_assistant_route(body: PlannerAssistantRequest):
    """AI Assistant for the Planner module."""
    try:
        response = await PlannerAssistantService.process_request(body)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

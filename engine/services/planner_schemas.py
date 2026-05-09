from typing import List, Optional, Literal, Union
from pydantic import BaseModel, Field

class AICreateGoal(BaseModel):
    action: Literal["create_goal"] = "create_goal"
    title: str
    description: Optional[str] = None
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] = "MEDIUM"
    milestones: Optional[List[str]] = None

class AICreateTask(BaseModel):
    action: Literal["create_task"] = "create_task"
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None # ISO format
    priority: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM"
    goal_id: Optional[str] = None

class AICreateHabit(BaseModel):
    action: Literal["create_habit"] = "create_habit"
    title: str
    frequency: Literal["DAILY", "WEEKLY"] = "DAILY"
    target_count: int = 1

class AICreateScheduleBlock(BaseModel):
    action: Literal["create_schedule_block"] = "create_schedule_block"
    title: str
    start_time: str # HH:MM
    end_time: str # HH:MM
    day_of_week: Optional[int] = None # 1-7
    block_date: Optional[str] = None # YYYY-MM-DD
    color: str = "#4f46e5"

class AIUpdatePreferences(BaseModel):
    action: Literal["update_preferences"] = "update_preferences"
    active_hours_start: Optional[str] = None
    active_hours_end: Optional[str] = None
    focus_mode_duration: Optional[int] = None

PlannerAction = Union[
    AICreateGoal,
    AICreateTask,
    AICreateHabit,
    AICreateScheduleBlock,
    AIUpdatePreferences
]

class PlannerAssistantResponse(BaseModel):
    message: str = Field(..., description="The conversational response to the student.")
    actions: List[PlannerAction] = Field(default_factory=list, description="List of actions to apply to the planner.")
    reasoning: Optional[str] = Field(None, description="Internal reasoning for the planned actions.")

class PlannerAssistantRequest(BaseModel):
    user_id: str
    prompt: str
    current_state: dict = Field(..., description="The current state of the planner (goals, tasks, habits, etc.)")
    local_time: str = Field(..., description="The current local time of the user.")

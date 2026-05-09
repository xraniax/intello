import engineClient from '../services/engine.client.js';
import PlannerService from '../services/planner.service.js';
import { 
    createGoalSchema, 
    createTaskSchema, 
    createHabitSchema, 
    createScheduleBlockSchema, 
    updatePreferencesSchema 
} from '../dtos/planner.dto.js';

const normalizeKeys = (value) => {
    if (Array.isArray(value)) {
        return value.map(normalizeKeys);
    }

    if (value && typeof value === 'object') {
        return Object.entries(value).reduce((acc, [key, val]) => {
            const normalizedKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
            acc[normalizedKey] = normalizeKeys(val);
            return acc;
        }, {});
    }

    return value;
};

const normalizeAISchemaAction = (action) => {
    const normalized = normalizeKeys(action);

    if (normalized.milestones && Array.isArray(normalized.milestones)) {
        normalized.milestones = normalized.milestones.map((milestone) => {
            if (typeof milestone === 'string') {
                return { title: milestone };
            }
            return normalizeKeys(milestone);
        });
    }

    return normalized;
};

/**
 * Planner AI Controller
 * Manages interactions with the AI Planning Assistant.
 */
class PlannerAIController {
    /**
     * Handle AI Chat and Action Execution
     */
    static async chat(req, res, next) {
        try {
            const { prompt } = req.body;
            if (!prompt) {
                return res.status(400).json({ success: false, message: 'Prompt is required' });
            }

            // 1. Gather current context
            const overview = await PlannerService.getUserPlannerOverview(req.user.id);
            const preferences = await PlannerService.getPreferences(req.user.id);

            const currentState = {
                goals: overview.goals,
                tasks: overview.tasks,
                habits: overview.habits,
                preferences
            };

            // 2. Call Python Engine
            const engineResponse = await engineClient.post('/planner/assistant', {
                user_id: req.user.id,
                prompt,
                current_state: currentState,
                local_time: new Date().toISOString()
            });

            const { message, actions, reasoning } = engineResponse.data;

            // 3. Execute actions (optimistically or sequentially)
            // In a production app, we might want to ask for confirmation,
            // but for this "agentic" assistant, we'll execute and report back.
            const executionResults = [];

            for (const action of actions || []) {
                try {
                    const normalizedAction = normalizeAISchemaAction(action);
                    let result;
                    switch (normalizedAction.action) {
                        case 'create_goal':
                            result = await PlannerService.createGoalWithMilestones(req.user.id, createGoalSchema.parse(normalizedAction));
                            break;
                        case 'create_task':
                            result = await PlannerService.createTask(req.user.id, createTaskSchema.parse(normalizedAction));
                            break;
                        case 'create_habit':
                            result = await PlannerService.createHabit(req.user.id, createHabitSchema.parse(normalizedAction));
                            break;
                        case 'create_schedule_block':
                            result = await PlannerService.createScheduleBlock(req.user.id, createScheduleBlockSchema.parse(normalizedAction));
                            break;
                        case 'update_preferences':
                            result = await PlannerService.updatePreferences(req.user.id, updatePreferencesSchema.parse(normalizedAction));
                            break;
                        default:
                            console.warn(`Unknown action type: ${normalizedAction.action}`);
                    }
                    if (result) {
                        executionResults.push({ action: normalizedAction.action, status: 'success', data: result });
                    }
                } catch (err) {
                    console.error(`Failed to execute action ${action.action}:`, err);
                    executionResults.push({ action: action.action || 'unknown', status: 'error', error: err.message });
                }
            }

            res.json({
                success: true,
                data: {
                    message,
                    actions_executed: executionResults,
                    reasoning
                }
            });

        } catch (error) {
            next(error);
        }
    }
}

export default PlannerAIController;

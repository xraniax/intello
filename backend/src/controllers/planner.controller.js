import PlannerService from '../services/planner.service.js';
import { 
    createGoalSchema, 
    updateGoalSchema,
    createTaskSchema,
    updateTaskSchema,
    createHabitSchema,
    updateHabitSchema,
    createScheduleBlockSchema,
    updatePreferencesSchema
} from '../dtos/planner.dto.js';

/**
 * Planner Controller
 * Handles HTTP requests for the Planner module.
 */
class PlannerController {
    // --- Goals ---

    static async createGoal(req, res, next) {
        try {
            const validatedData = createGoalSchema.parse(req.body);
            const result = await PlannerService.createGoalWithMilestones(req.user.id, validatedData);
            res.status(201).json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async getGoal(req, res, next) {
        try {
            const result = await PlannerService.getGoalDetails(req.user.id, req.params.id);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async getUserOverview(req, res, next) {
        try {
            const result = await PlannerService.getUserPlannerOverview(req.user.id);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    // --- Tasks ---

    static async createTask(req, res, next) {
        try {
            const validatedData = createTaskSchema.parse(req.body);
            const result = await PlannerService.createTask(req.user.id, validatedData);
            res.status(201).json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async getTasks(req, res, next) {
        try {
            const result = await PlannerService.getUserTasks(req.user.id, req.query);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    // --- Habits ---

    static async createHabit(req, res, next) {
        try {
            const validatedData = createHabitSchema.parse(req.body);
            const result = await PlannerService.createHabit(req.user.id, validatedData);
            res.status(201).json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async getHabits(req, res, next) {
        try {
            const result = await PlannerService.getUserHabits(req.user.id);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    // --- Schedule ---

    static async createScheduleBlock(req, res, next) {
        try {
            const validatedData = createScheduleBlockSchema.parse(req.body);
            const result = await PlannerService.createScheduleBlock(req.user.id, validatedData);
            res.status(201).json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async getSchedule(req, res, next) {
        try {
            const result = await PlannerService.getUserSchedule(req.user.id);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    // --- Preferences ---

    static async getPreferences(req, res, next) {
        try {
            const result = await PlannerService.getPreferences(req.user.id);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async updatePreferences(req, res, next) {
        try {
            const validatedData = updatePreferencesSchema.parse(req.body);
            const result = await PlannerService.updatePreferences(req.user.id, validatedData);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
}

export default PlannerController;

import PlannerRepository from '../repositories/planner.repository.js';
import { withTransaction } from '../utils/config/db.js';

/**
 * Planner Service
 * Orchestrates business logic for the Planner module.
 */
class PlannerService {
    // --- Goals & Milestones ---

    /**
     * Create a goal with optional milestones in a single transaction.
     */
    static async createGoalWithMilestones(userId, goalData) {
        return await withTransaction(async (client) => {
            const { action, milestones, ...goalFields } = goalData;
            
            // Create the goal
            const goal = await PlannerRepository.createGoal(client, userId, goalFields);
            
            let createdMilestones = [];
            if (milestones && milestones.length > 0) {
                for (const milestoneData of milestones) {
                    const milestonePayload = typeof milestoneData === 'string'
                        ? { title: milestoneData }
                        : milestoneData;
                    const milestone = await PlannerRepository.createMilestone(client, goal.id, milestonePayload);
                    createdMilestones.push(milestone);
                }
            }
            
            return {
                ...goal,
                milestones: createdMilestones
            };
        });
    }

    static async getGoalDetails(userId, goalId) {
        const goal = await PlannerRepository.getGoalById(userId, goalId);
        if (!goal) throw new Error('Goal not found');
        
        const milestones = await PlannerRepository.getMilestonesByGoalId(goalId);
        return { ...goal, milestones };
    }

    static async getUserPlannerOverview(userId) {
        const [goals, tasks, habits, schedule, preferences] = await Promise.all([
            PlannerRepository.getUserGoals(userId, { status: 'IN_PROGRESS' }),
            PlannerRepository.getUserTasks(userId, { status: 'PENDING' }),
            PlannerRepository.getUserHabits(userId),
            PlannerRepository.getUserScheduleBlocks(userId),
            PlannerRepository.getPreferences(userId)
        ]);
        
        return { goals, tasks, habits, schedule, preferences };
    }

    // --- Tasks ---

    static async createTask(userId, taskData) {
        return await PlannerRepository.createTask(userId, taskData);
    }

    static async getUserTasks(userId, filters) {
        return await PlannerRepository.getUserTasks(userId, filters);
    }

    // --- Habits ---

    static async createHabit(userId, habitData) {
        return await PlannerRepository.createHabit(userId, habitData);
    }

    static async getUserHabits(userId) {
        return await PlannerRepository.getUserHabits(userId);
    }

    // --- Schedule ---

    static async createScheduleBlock(userId, blockData) {
        return await PlannerRepository.createScheduleBlock(userId, blockData);
    }

    static async getUserSchedule(userId) {
        return await PlannerRepository.getUserScheduleBlocks(userId);
    }

    // --- Preferences ---

    static async updatePreferences(userId, prefsData) {
        return await PlannerRepository.updatePreferences(userId, prefsData);
    }

    static async getPreferences(userId) {
        let prefs = await PlannerRepository.getPreferences(userId);
        if (!prefs) {
            // Return defaults if not set
            return {
                focusModeDuration: 25,
                breakDuration: 5,
                activeHoursStart: '09:00:00',
                activeHoursEnd: '17:00:00'
            };
        }
        return prefs;
    }
}

export default PlannerService;

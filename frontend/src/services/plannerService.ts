import axios from 'axios';
import { 
    PlannerOverview, 
    Goal, 
    Task, 
    Habit, 
    ScheduleBlock, 
    ProductivityPreferences 
} from '../features/planner/types/planner.types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

export const plannerService = {
    getOverview: async (): Promise<PlannerOverview> => {
        const response = await api.get('/planner/overview');
        return response.data.data;
    },

    // --- Goals ---
    createGoal: async (goalData: Partial<Goal>): Promise<Goal> => {
        const response = await api.post('/planner/goals', goalData);
        return response.data.data;
    },
    getGoal: async (id: string): Promise<Goal> => {
        const response = await api.get(`/planner/goals/${id}`);
        return response.data.data;
    },

    // --- Tasks ---
    createTask: async (taskData: Partial<Task>): Promise<Task> => {
        const response = await api.post('/planner/tasks', taskData);
        return response.data.data;
    },
    getTasks: async (filters?: any): Promise<Task[]> => {
        const response = await api.get('/planner/tasks', { params: filters });
        return response.data.data;
    },

    // --- Habits ---
    createHabit: async (habitData: Partial<Habit>): Promise<Habit> => {
        const response = await api.post('/planner/habits', habitData);
        return response.data.data;
    },
    getHabits: async (): Promise<Habit[]> => {
        const response = await api.get('/planner/habits');
        return response.data.data;
    },

    // --- Schedule ---
    createScheduleBlock: async (blockData: Partial<ScheduleBlock>): Promise<ScheduleBlock> => {
        const response = await api.post('/planner/schedule', blockData);
        return response.data.data;
    },
    getSchedule: async (): Promise<ScheduleBlock[]> => {
        const response = await api.get('/planner/schedule');
        return response.data.data;
    },

    // --- Preferences ---
    getPreferences: async (): Promise<ProductivityPreferences> => {
        const response = await api.get('/planner/preferences');
        return response.data.data;
    },
    updatePreferences: async (prefsData: Partial<ProductivityPreferences>): Promise<ProductivityPreferences> => {
        const response = await api.put('/planner/preferences', prefsData);
        return response.data.data;
    },
};

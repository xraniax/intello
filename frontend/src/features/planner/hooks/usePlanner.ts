import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plannerService } from '../../../services/plannerService';
import { Goal, Task, Habit, ScheduleBlock, ProductivityPreferences } from '../types/planner.types';

export const usePlannerOverview = () => {
    return useQuery({
        queryKey: ['planner', 'overview'],
        queryFn: plannerService.getOverview,
    });
};

export const usePlannerGoals = () => {
    const queryClient = useQueryClient();

    const goalsQuery = useQuery({
        queryKey: ['planner', 'goals'],
        queryFn: () => plannerService.getOverview().then(data => data.goals),
    });

    const createGoalMutation = useMutation({
        mutationFn: plannerService.createGoal,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['planner'] });
        },
    });

    return { goalsQuery, createGoalMutation };
};

export const usePlannerTasks = (filters?: any) => {
    const queryClient = useQueryClient();

    const tasksQuery = useQuery({
        queryKey: ['planner', 'tasks', filters],
        queryFn: () => plannerService.getTasks(filters),
    });

    const createTaskMutation = useMutation({
        mutationFn: plannerService.createTask,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['planner', 'tasks'] });
            queryClient.invalidateQueries({ queryKey: ['planner', 'overview'] });
        },
    });

    return { tasksQuery, createTaskMutation };
};

export const usePlannerHabits = () => {
    const queryClient = useQueryClient();

    const habitsQuery = useQuery({
        queryKey: ['planner', 'habits'],
        queryFn: plannerService.getHabits,
    });

    const createHabitMutation = useMutation({
        mutationFn: plannerService.createHabit,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['planner', 'habits'] });
            queryClient.invalidateQueries({ queryKey: ['planner', 'overview'] });
        },
    });

    return { habitsQuery, createHabitMutation };
};

export const usePlannerSchedule = () => {
    const queryClient = useQueryClient();

    const scheduleQuery = useQuery({
        queryKey: ['planner', 'schedule'],
        queryFn: plannerService.getSchedule,
    });

    const createBlockMutation = useMutation({
        mutationFn: plannerService.createScheduleBlock,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['planner', 'schedule'] });
            queryClient.invalidateQueries({ queryKey: ['planner', 'overview'] });
        },
    });

    return { scheduleQuery, createBlockMutation };
};

export const usePlannerPreferences = () => {
    const queryClient = useQueryClient();

    const prefsQuery = useQuery({
        queryKey: ['planner', 'preferences'],
        queryFn: plannerService.getPreferences,
    });

    const updatePrefsMutation = useMutation({
        mutationFn: plannerService.updatePreferences,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['planner', 'preferences'] });
            queryClient.invalidateQueries({ queryKey: ['planner', 'overview'] });
        },
    });

    return { prefsQuery, updatePrefsMutation };
};

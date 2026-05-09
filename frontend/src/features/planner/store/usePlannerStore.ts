import { create } from 'zustand';

interface PlannerState {
    isQuickAddModalOpen: boolean;
    quickAddType: 'task' | 'goal' | 'habit';
    selectedGoalId: string | null;
    currentTab: 'dashboard' | 'calendar' | 'tasks' | 'habits' | 'goals';
    
    setQuickAddModal: (open: boolean, type?: 'task' | 'goal' | 'habit') => void;
    setSelectedGoal: (goalId: string | null) => void;
    setCurrentTab: (tab: 'dashboard' | 'calendar' | 'tasks' | 'habits' | 'goals') => void;
}

export const usePlannerStore = create<PlannerState>((set) => ({
    isQuickAddModalOpen: false,
    quickAddType: 'task',
    selectedGoalId: null,
    currentTab: 'dashboard',

    setQuickAddModal: (open, type = 'task') => set({ isQuickAddModalOpen: open, quickAddType: type }),
    setSelectedGoal: (goalId) => set({ selectedGoalId: goalId }),
    setCurrentTab: (tab) => set({ currentTab: tab }),
}));

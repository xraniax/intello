export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type GoalStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
export type MilestoneStatus = 'PENDING' | 'COMPLETED';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type HabitFrequency = 'DAILY' | 'WEEKLY';
export type HabitStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface Milestone {
    id: string;
    goal_id: string;
    title: string;
    description?: string;
    due_date?: string;
    status: MilestoneStatus;
}

export interface Goal {
    id: string;
    user_id: string;
    subject_id?: string;
    title: string;
    description?: string;
    start_date: string;
    end_date?: string;
    status: GoalStatus;
    priority: Priority;
    milestones?: Milestone[];
    created_at: string;
    updated_at: string;
}

export interface Task {
    id: string;
    user_id: string;
    goal_id?: string;
    milestone_id?: string;
    title: string;
    description?: string;
    due_date?: string;
    status: TaskStatus;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    created_at: string;
    updated_at: string;
}

export interface Habit {
    id: string;
    user_id: string;
    title: string;
    description?: string;
    frequency: HabitFrequency;
    target_count: number;
    current_streak: number;
    status: HabitStatus;
    created_at: string;
    updated_at: string;
}

export interface ScheduleBlock {
    id: string;
    user_id: string;
    title: string;
    start_time: string;
    end_time: string;
    day_of_week?: number;
    block_date?: string;
    color: string;
    created_at: string;
    updated_at: string;
}

export interface ProductivityPreferences {
    user_id: string;
    focus_mode_duration: number;
    break_duration: number;
    active_hours_start: string;
    active_hours_end: string;
}

export interface PlannerOverview {
    goals: Goal[];
    tasks: Task[];
    habits: Habit[];
    schedule: ScheduleBlock[];
    preferences: ProductivityPreferences;
}

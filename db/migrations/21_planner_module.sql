-- 21_planner_module.sql
-- Planner Module: Goals, Milestones, Tasks, Habits, Schedule Blocks, Preferences

-- Planner goals table
CREATE TABLE IF NOT EXISTS planner_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT planner_goals_status_check CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED')),
    CONSTRAINT planner_goals_priority_check CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT'))
);

-- Planner milestones table
CREATE TABLE IF NOT EXISTS planner_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id UUID NOT NULL REFERENCES planner_goals(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT planner_milestones_status_check CHECK (status IN ('PENDING', 'COMPLETED'))
);

-- Planner tasks table
CREATE TABLE IF NOT EXISTS planner_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES planner_goals(id) ON DELETE SET NULL,
    milestone_id UUID REFERENCES planner_milestones(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT planner_tasks_status_check CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT planner_tasks_priority_check CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH'))
);

-- Planner habits table
CREATE TABLE IF NOT EXISTS planner_habits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    frequency VARCHAR(20) NOT NULL DEFAULT 'DAILY', -- DAILY, WEEKLY
    target_count INTEGER NOT NULL DEFAULT 1,
    current_streak INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT planner_habits_frequency_check CHECK (frequency IN ('DAILY', 'WEEKLY')),
    CONSTRAINT planner_habits_status_check CHECK (status IN ('ACTIVE', 'PAUSED', 'ARCHIVED'))
);

-- Planner schedule blocks table
CREATE TABLE IF NOT EXISTS planner_schedule_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    day_of_week INTEGER, -- 1=Monday, 7=Sunday. NULL for specific date.
    block_date DATE, -- Specific date if not recurring.
    color VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT planner_schedule_blocks_dow_check CHECK (day_of_week BETWEEN 1 AND 7)
);

-- User productivity preferences
CREATE TABLE IF NOT EXISTS user_productivity_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    focus_mode_duration INTEGER NOT NULL DEFAULT 25, -- in minutes (Pomodoro)
    break_duration INTEGER NOT NULL DEFAULT 5, -- in minutes
    active_hours_start TIME DEFAULT '09:00:00',
    active_hours_end TIME DEFAULT '17:00:00',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_planner_goals_user_id ON planner_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_planner_milestones_goal_id ON planner_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_planner_tasks_user_id ON planner_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_planner_tasks_goal_id ON planner_tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_planner_habits_user_id ON planner_habits(user_id);
CREATE INDEX IF NOT EXISTS idx_planner_schedule_blocks_user_id ON planner_schedule_blocks(user_id);

-- Triggers for updated_at
CREATE TRIGGER update_planner_goals_updated_at BEFORE UPDATE ON planner_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_planner_milestones_updated_at BEFORE UPDATE ON planner_milestones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_planner_tasks_updated_at BEFORE UPDATE ON planner_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_planner_habits_updated_at BEFORE UPDATE ON planner_habits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_planner_schedule_blocks_updated_at BEFORE UPDATE ON planner_schedule_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_productivity_preferences_updated_at BEFORE UPDATE ON user_productivity_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

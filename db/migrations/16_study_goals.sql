-- 16_study_goals.sql
-- Study Goals & Progress Tracking

-- Goal types enum
DO $$ BEGIN
    CREATE TYPE goal_type AS ENUM ('study_time', 'material_completion', 'quiz_completion', 'exam_score');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Goal periods enum
DO $$ BEGIN
    CREATE TYPE goal_period AS ENUM ('daily', 'weekly', 'monthly');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Goal status enum
DO $$ BEGIN
    CREATE TYPE goal_status AS ENUM ('active', 'paused', 'completed', 'abandoned');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Study goals table
CREATE TABLE IF NOT EXISTS study_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    
    -- Goal definition
    title VARCHAR(255) NOT NULL,
    description TEXT,
    goal_type goal_type NOT NULL DEFAULT 'study_time',
    goal_period goal_period NOT NULL DEFAULT 'weekly',
    status goal_status NOT NULL DEFAULT 'active',
    
    -- Target metrics
    target_value INTEGER NOT NULL,  -- e.g., minutes per day, number of quizzes
    target_score INTEGER,           -- for exam_score goals (percentage)
    
    -- Tracking
    current_value INTEGER NOT NULL DEFAULT 0,
    streak_count INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    
    -- Scheduling
    reminder_time TIME,             -- Daily reminder time
    reminder_days INTEGER[] DEFAULT '{1,2,3,4,5,6,7}',  -- Days of week (1=Monday)
    last_reminder_sent TIMESTAMPTZ,
    
    -- Metadata
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,                  -- Optional deadline
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Study sessions table (tracks actual study time)
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES study_goals(id) ON DELETE SET NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
    
    -- Session details
    session_type VARCHAR(50) NOT NULL DEFAULT 'study',  -- study, quiz, exam, review
    duration_minutes INTEGER NOT NULL,
    
    -- Content tracking
    materials_viewed INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    notes_taken TEXT,
    
    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Goal progress history (snapshots for trend analysis)
CREATE TABLE IF NOT EXISTS goal_progress_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id UUID NOT NULL REFERENCES study_goals(id) ON DELETE CASCADE,
    
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    target_value INTEGER NOT NULL,
    actual_value INTEGER NOT NULL,
    percentage_complete INTEGER NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_study_goals_user_id ON study_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_study_goals_subject_id ON study_goals(subject_id);
CREATE INDEX IF NOT EXISTS idx_study_goals_status ON study_goals(status);
CREATE INDEX IF NOT EXISTS idx_study_goals_period ON study_goals(goal_period);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_goal_id ON study_sessions(goal_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_started_at ON study_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_study_sessions_date ON study_sessions(user_id, started_at);

CREATE INDEX IF NOT EXISTS idx_goal_progress_goal_id ON goal_progress_history(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_period ON goal_progress_history(period_start, period_end);

-- Triggers
DROP TRIGGER IF EXISTS update_study_goals_updated_at ON study_goals;
CREATE TRIGGER update_study_goals_updated_at
    BEFORE UPDATE ON study_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Views for easier querying
CREATE OR REPLACE VIEW weekly_goal_progress AS
SELECT 
    g.id as goal_id,
    g.user_id,
    g.title,
    g.goal_type,
    g.goal_period,
    g.target_value,
    g.current_value,
    g.status,
    CASE 
        WHEN g.target_value > 0 THEN ROUND((g.current_value::numeric / g.target_value) * 100)
        ELSE 0
    END as completion_percentage,
    g.streak_count,
    g.start_date,
    DATE_TRUNC('week', CURRENT_DATE) as week_start,
    (SELECT COALESCE(SUM(duration_minutes), 0) 
     FROM study_sessions s 
     WHERE s.goal_id = g.id 
     AND s.started_at >= DATE_TRUNC('week', CURRENT_DATE)) as actual_this_week
FROM study_goals g
WHERE g.status = 'active';

-- Function to calculate study time for a user in a date range
CREATE OR REPLACE FUNCTION get_study_time(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(duration_minutes) 
         FROM study_sessions 
         WHERE user_id = p_user_id 
         AND DATE(started_at) BETWEEN p_start_date AND p_end_date),
        0
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update goal progress (call after study session ends)
CREATE OR REPLACE FUNCTION update_goal_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_goal RECORD;
    v_period_start DATE;
    v_period_end DATE;
    v_actual INTEGER;
BEGIN
    -- Update any linked goals
    FOR v_goal IN 
        SELECT * FROM study_goals 
        WHERE user_id = NEW.user_id 
        AND status = 'active'
        AND (subject_id IS NULL OR subject_id = NEW.subject_id)
    LOOP
        -- Calculate period boundaries
        v_period_start := CASE v_goal.goal_period
            WHEN 'daily' THEN CURRENT_DATE
            WHEN 'weekly' THEN DATE_TRUNC('week', CURRENT_DATE)::date
            WHEN 'monthly' THEN DATE_TRUNC('month', CURRENT_DATE)::date
        END;
        
        v_period_end := CASE v_goal.goal_period
            WHEN 'daily' THEN CURRENT_DATE
            WHEN 'weekly' THEN (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days')::date
            WHEN 'monthly' THEN (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date
        END;
        
        -- Calculate actual progress based on goal type
        IF v_goal.goal_type = 'study_time' THEN
            v_actual := get_study_time(NEW.user_id, v_period_start, v_period_end);
        ELSIF v_goal.goal_type = 'material_completion' THEN
            v_actual := (SELECT COUNT(*)::int FROM materials 
                       WHERE user_id = NEW.user_id 
                       AND status = 'COMPLETED'
                       AND DATE(updated_at) BETWEEN v_period_start AND v_period_end);
        ELSIF v_goal.goal_type = 'quiz_completion' THEN
            v_actual := (SELECT COUNT(*)::int FROM quiz_attempts 
                       WHERE user_id = NEW.user_id 
                       AND DATE(completed_at) BETWEEN v_period_start AND v_period_end);
        ELSE
            v_actual := v_goal.current_value;
        END IF;
        
        -- Update goal
        UPDATE study_goals SET
            current_value = v_actual,
            updated_at = NOW(),
            streak_count = CASE 
                WHEN v_actual >= v_goal.target_value THEN streak_count + 1
                ELSE 0
            END,
            longest_streak = CASE 
                WHEN v_actual >= v_goal.target_value AND streak_count + 1 > longest_streak 
                THEN streak_count + 1
                ELSE longest_streak
            END,
            status = CASE 
                WHEN v_goal.end_date IS NOT NULL AND v_goal.end_date < CURRENT_DATE 
                THEN 'completed'::goal_status
                ELSE status
            END
        WHERE id = v_goal.id;
        
        -- Record progress history
        INSERT INTO goal_progress_history (goal_id, period_start, period_end, target_value, actual_value, percentage_complete)
        VALUES (
            v_goal.id, 
            v_period_start, 
            v_period_end, 
            v_goal.target_value, 
            v_actual,
            CASE WHEN v_goal.target_value > 0 THEN (v_actual * 100 / v_goal.target_value) ELSE 0 END
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update goals when study session ends
DROP TRIGGER IF EXISTS trg_update_goal_progress ON study_sessions;
CREATE TRIGGER trg_update_goal_progress
    AFTER INSERT OR UPDATE ON study_sessions
    FOR EACH ROW
    WHEN (NEW.ended_at IS NOT NULL)
    EXECUTE FUNCTION update_goal_progress();

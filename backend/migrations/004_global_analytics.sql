-- Migration 004: Global Analytics Tables
-- Run once against the database: psql $DATABASE_URL -f migrations/004_global_analytics.sql

-- Subject-level analytics snapshot (aggregated from user_concept_mastery)
CREATE TABLE IF NOT EXISTS user_subject_analytics (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id       UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    crs_score        NUMERIC(5,2) DEFAULT 0,
    understanding    NUMERIC(5,2) DEFAULT 0,
    retention        NUMERIC(5,2) DEFAULT 0,
    mastery          NUMERIC(5,2) DEFAULT 0,
    confidence       NUMERIC(5,2) DEFAULT 0,
    concept_count    INT DEFAULT 0,
    mastered_count   INT DEFAULT 0,
    at_risk_count    INT DEFAULT 0,
    trend_7d         NUMERIC(5,2) DEFAULT 0,
    last_activity_at TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, subject_id)
);

-- Cross-subject global snapshot (aggregated from user_subject_analytics)
CREATE TABLE IF NOT EXISTS user_global_analytics (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    overall_readiness     NUMERIC(5,2) DEFAULT 0,
    momentum_score        NUMERIC(5,2) DEFAULT 1,
    consistency_score     NUMERIC(5,2) DEFAULT 0,
    study_streak          INT DEFAULT 0,
    active_days_30d       INT DEFAULT 0,
    strongest_subject_id  UUID REFERENCES subjects(id) ON DELETE SET NULL,
    weakest_subject_id    UUID REFERENCES subjects(id) ON DELETE SET NULL,
    total_mastered        INT DEFAULT 0,
    total_at_risk         INT DEFAULT 0,
    global_understanding  NUMERIC(5,2) DEFAULT 0,
    global_retention      NUMERIC(5,2) DEFAULT 0,
    global_mastery        NUMERIC(5,2) DEFAULT 0,
    updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Smart insight feed
CREATE TABLE IF NOT EXISTS user_insights (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id     UUID REFERENCES subjects(id) ON DELETE CASCADE,
    concept_name   TEXT,
    type           TEXT NOT NULL CHECK (type IN ('decay','momentum','error_pattern','forecast','cross_subject','streak')),
    priority       INT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    title          TEXT NOT NULL,
    body           TEXT NOT NULL,
    cta_label      TEXT,
    cta_action     JSONB,
    dismissed      BOOLEAN DEFAULT false,
    generated_at   TIMESTAMPTZ DEFAULT now(),
    expires_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_insights_user_active
    ON user_insights(user_id, dismissed, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_subject_analytics_user
    ON user_subject_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_global_analytics_user
    ON user_global_analytics(user_id);

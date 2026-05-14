-- ============================================================
-- Migration 22: Material Ratings & Satisfaction Analytics
-- ============================================================
-- Supports: per-user per-material ratings, engagement validation,
-- analytics aggregation, AI quality monitoring, adaptive learning.
-- ============================================================

-- Core ratings table: one row per (user, material) pair
CREATE TABLE IF NOT EXISTS material_ratings (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    material_id           UUID        NOT NULL REFERENCES materials(id) ON DELETE CASCADE,

    -- 1: Core satisfaction
    overall_rating        INTEGER     NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),

    -- 2: Learning effectiveness ("Did this material help you understand the topic?")
    learning_effectiveness BOOLEAN,

    -- 3: Difficulty appropriateness
    difficulty_level      VARCHAR(20) CHECK (difficulty_level IN ('too_easy', 'appropriate', 'too_difficult')),

    -- 4: Optional written feedback
    written_feedback      TEXT,

    -- 5: Issue flags (array of category strings)
    --    e.g. ["incorrect_information", "too_long", "poor_examples"]
    issue_flags           JSONB       NOT NULL DEFAULT '[]',

    -- Engagement metadata: used for validation & future analytics
    engagement_seconds    INTEGER     NOT NULL DEFAULT 0 CHECK (engagement_seconds >= 0),

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Enforce: one rating per user per material
    CONSTRAINT uq_material_ratings_user_material UNIQUE (user_id, material_id)
);

-- Pre-computed analytics cache per material (updated on each rating upsert)
CREATE TABLE IF NOT EXISTS material_rating_analytics (
    material_id               UUID        PRIMARY KEY REFERENCES materials(id) ON DELETE CASCADE,

    avg_rating                DECIMAL(3,2) NOT NULL DEFAULT 0,
    total_ratings             INTEGER      NOT NULL DEFAULT 0,
    rating_distribution       JSONB        NOT NULL DEFAULT '{"1":0,"2":0,"3":0,"4":0,"5":0}',

    -- % of raters who found material effective
    effectiveness_rate        DECIMAL(5,2) NOT NULL DEFAULT 0,

    -- counts per difficulty bucket
    difficulty_distribution   JSONB        NOT NULL DEFAULT '{"too_easy":0,"appropriate":0,"too_difficult":0}',

    -- occurrence count per issue flag category
    issue_frequency           JSONB        NOT NULL DEFAULT '{}',

    -- satisfaction trend: array of {week, avg} objects (last 12 weeks)
    satisfaction_trend        JSONB        NOT NULL DEFAULT '[]',

    last_computed_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_material_ratings_user_id
    ON material_ratings(user_id);

CREATE INDEX IF NOT EXISTS idx_material_ratings_material_id
    ON material_ratings(material_id);

CREATE INDEX IF NOT EXISTS idx_material_ratings_overall_rating
    ON material_ratings(overall_rating);

CREATE INDEX IF NOT EXISTS idx_material_ratings_created_at
    ON material_ratings(created_at DESC);

-- Composite: fast "has this user rated this material?" lookups
CREATE INDEX IF NOT EXISTS idx_material_ratings_user_material
    ON material_ratings(user_id, material_id);

-- Partial index for low-quality materials (admin monitoring)
CREATE INDEX IF NOT EXISTS idx_material_ratings_low
    ON material_ratings(material_id, overall_rating)
    WHERE overall_rating <= 2;

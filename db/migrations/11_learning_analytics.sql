-- ─── 11_learning_analytics.sql ───────────────────────────────────────────────
-- Learning analytics layer: concept taxonomy, interaction tracking,
-- per-topic mastery snapshots.

-- ─── Concept / Topic Taxonomy ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS concepts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    parent_id   UUID REFERENCES concepts(id) ON DELETE SET NULL,
    name        VARCHAR(120) NOT NULL,
    slug        VARCHAR(120) NOT NULL,
    depth       SMALLINT NOT NULL DEFAULT 0,  -- 0=topic, 1=subtopic, 2=leaf
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (subject_id, slug)
);

-- ─── Question Registry ────────────────────────────────────────────────────────
-- Links individual questions (from ai_generated_content JSONB) to this schema.
-- external_id is the question UUID from the material's JSONB.
CREATE TABLE IF NOT EXISTS questions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id  UUID REFERENCES materials(id) ON DELETE SET NULL,
    subject_id   UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    external_id  VARCHAR(255),
    body         TEXT NOT NULL,
    type         VARCHAR(20) NOT NULL DEFAULT 'single_choice'
                     CHECK (type IN ('single_choice','multiple_select','short_answer',
                                     'problem','fill_blank','matching','scenario')),
    difficulty   SMALLINT NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
    topic_name   VARCHAR(120),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (material_id, external_id)
);

CREATE TABLE IF NOT EXISTS question_concepts (
    question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    concept_id   UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    weight       NUMERIC(3,2) NOT NULL DEFAULT 1.0,
    PRIMARY KEY (question_id, concept_id)
);

-- ─── Flashcard Item Registry ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashcard_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id  UUID REFERENCES materials(id) ON DELETE SET NULL,
    subject_id   UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    external_id  VARCHAR(255),
    front        TEXT NOT NULL,
    back         TEXT NOT NULL,
    topic_name   VARCHAR(120),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (material_id, external_id)
);

CREATE TABLE IF NOT EXISTS flashcard_item_concepts (
    flashcard_item_id  UUID NOT NULL REFERENCES flashcard_items(id) ON DELETE CASCADE,
    concept_id         UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    PRIMARY KEY (flashcard_item_id, concept_id)
);

-- ─── Quiz Attempts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id     UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    material_id    UUID REFERENCES materials(id) ON DELETE SET NULL,
    score          SMALLINT NOT NULL,
    max_score      SMALLINT NOT NULL,
    difficulty_avg NUMERIC(3,2),
    started_at     TIMESTAMPTZ NOT NULL,
    completed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_quiz_score CHECK (score >= 0 AND score <= max_score)
);

-- topic_name is denormalized from the question's topic field to avoid
-- expensive JSONB joins during aggregation.
CREATE TABLE IF NOT EXISTS quiz_responses (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id           UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id          UUID REFERENCES questions(id) ON DELETE SET NULL,
    external_question_id VARCHAR(255),
    topic_name           VARCHAR(120),
    selected_answer      TEXT,
    is_correct           BOOLEAN NOT NULL,
    time_spent_ms        INT NOT NULL DEFAULT 0 CHECK (time_spent_ms >= 0),
    difficulty           SMALLINT NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5)
);

-- ─── Flashcard Reviews ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashcard_reviews (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    material_id       UUID REFERENCES materials(id) ON DELETE SET NULL,
    flashcard_item_id UUID REFERENCES flashcard_items(id) ON DELETE SET NULL,
    external_card_id  VARCHAR(255),
    topic_name        VARCHAR(120),
    outcome           VARCHAR(10) NOT NULL CHECK (outcome IN ('again','hard','good','easy')),
    ease_factor       NUMERIC(4,2) NOT NULL DEFAULT 2.50,
    interval_days     INT NOT NULL DEFAULT 1,
    days_since_last   INT,
    reviewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Mock Exam Attempts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mock_exam_attempts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id       UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    material_id      UUID REFERENCES materials(id) ON DELETE SET NULL,
    score            SMALLINT NOT NULL,
    max_score        SMALLINT NOT NULL,
    duration_seconds INT NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    attempt_number   SMALLINT NOT NULL DEFAULT 1,
    started_at       TIMESTAMPTZ NOT NULL,
    completed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_exam_score CHECK (score >= 0 AND score <= max_score)
);

CREATE TABLE IF NOT EXISTS exam_concept_scores (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id     UUID NOT NULL REFERENCES mock_exam_attempts(id) ON DELETE CASCADE,
    concept_id     UUID REFERENCES concepts(id) ON DELETE SET NULL,
    topic_name     VARCHAR(120) NOT NULL,
    score          SMALLINT NOT NULL,
    max_score      SMALLINT NOT NULL,
    question_count SMALLINT NOT NULL,
    CONSTRAINT valid_concept_score CHECK (score >= 0 AND score <= max_score)
);

-- ─── Mastery Snapshot ─────────────────────────────────────────────────────────
-- Recomputed after each interaction. Keyed on (user, subject, topic_name) so it
-- works before a formal concept tree is built for a subject.
CREATE TABLE IF NOT EXISTS user_concept_mastery (
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id          UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    concept_id          UUID REFERENCES concepts(id) ON DELETE SET NULL,
    topic_name          VARCHAR(120) NOT NULL,
    quiz_accuracy       NUMERIC(5,2),
    flashcard_retention NUMERIC(5,2),
    exam_accuracy       NUMERIC(5,2),
    mastery_score       NUMERIC(5,2),
    response_count      INT NOT NULL DEFAULT 0,
    last_activity_at    TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, subject_id, topic_name)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_concepts_subject                ON concepts(subject_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_time         ON quiz_attempts(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_subject           ON quiz_attempts(subject_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_attempt          ON quiz_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_topic            ON quiz_responses(topic_name);
CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_user_time     ON flashcard_reviews(user_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_user_material ON flashcard_reviews(user_id, material_id);
CREATE INDEX IF NOT EXISTS idx_mock_exam_user_subject          ON mock_exam_attempts(user_id, subject_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_concept_attempt            ON exam_concept_scores(attempt_id);
CREATE INDEX IF NOT EXISTS idx_mastery_user_subject            ON user_concept_mastery(user_id, subject_id);

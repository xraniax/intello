-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE subject_level AS ENUM ('Beginner', 'Intermediate', 'Advanced');
CREATE TYPE upload_type AS ENUM ('PDF', 'ScannedDoc');
CREATE TYPE source_type AS ENUM ('Note', 'Upload', 'Video');
CREATE TYPE chat_type AS ENUM ('text', 'voice');

-- ============================================
-- USERS
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SUBJECTS
-- ============================================

CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- USER-SUBJECT PROGRESS
-- ============================================

CREATE TABLE user_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,

    level subject_level NOT NULL,
    readiness_score FLOAT DEFAULT 0,
    metrics JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, subject_id)
);

-- ============================================
-- UPLOADS (PDF / SCANNED DOC)
-- ============================================

CREATE TABLE uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,

    type upload_type NOT NULL,
    temp_file_path TEXT,
    embedding vector(1536),  -- PGVector column

    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- VIDEOS (YouTube transcripts)
-- ============================================

CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,

    video_url TEXT NOT NULL,
    transcript TEXT,
    embedding vector(1536),  -- PGVector column

    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- NOTES (User text notes)
-- ============================================

CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,

    content TEXT NOT NULL,
    embedding vector(1536),  -- PGVector column

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- QUIZZES
-- ============================================

CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,

    questions JSONB NOT NULL,
    score FLOAT,
    metrics JSONB,
    embedding vector(1536), -- PGVector column for quiz embeddings if needed

    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- FLASHCARDS
-- ============================================

CREATE TABLE flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,

    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    mastery_level INT DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SUMMARIES
-- ============================================

CREATE TABLE summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,

    source_type source_type NOT NULL,
    source_id UUID NOT NULL,

    summary_text TEXT NOT NULL,
    embedding vector(1536),  -- PGVector column for summary embeddings

    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- MATERIALS (Consolidated table for Cognify)
-- ============================================

CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'summary', 'quiz', etc.
    ai_generated_content JSONB,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- CHAT HISTORY (TEXT + VOICE)
-- ============================================

CREATE TABLE chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,

    type chat_type NOT NULL,
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    embedding vector(1536),  -- PGVector column for chat embeddings

    created_at TIMESTAMP DEFAULT NOW()
);

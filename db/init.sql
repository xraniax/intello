-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE chat_type AS ENUM ('text', 'voice');

-- ============================================
-- USERS
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT, -- Nullable for social login users
    role user_role DEFAULT 'user',
    auth_provider VARCHAR(20) DEFAULT 'local',
    provider_id VARCHAR(255) UNIQUE,
    reset_token_hash TEXT,
    reset_token_expires TIMESTAMP,
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

-- Removed dead tables: user_subjects, uploads, videos, notes, quizzes, flashcards, summaries

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
    status VARCHAR(20) DEFAULT 'processing',
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


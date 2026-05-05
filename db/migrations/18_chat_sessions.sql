-- 18_chat_sessions.sql
-- Persistent chat sessions and structured message storage for production-grade
-- conversational experience (ChatGPT/Claude style).

CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence FLOAT NOT NULL DEFAULT 0,
    is_error BOOLEAN NOT NULL DEFAULT FALSE,
    feedback VARCHAR(10),
    bookmarked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chat_messages_role_check CHECK (role IN ('user', 'assistant')),
    CONSTRAINT chat_messages_feedback_check CHECK (feedback IN ('up', 'down') OR feedback IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_subject ON chat_sessions(user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_bookmarked ON chat_messages(session_id, bookmarked) WHERE bookmarked = TRUE;

DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

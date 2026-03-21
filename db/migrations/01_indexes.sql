-- Performance Indexes for Cognify

-- 1. Subjects: Index by user_id for fast dashboard loading
CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON subjects(user_id);

-- 2. Materials: Composite index for fetching materials within a subject
CREATE INDEX IF NOT EXISTS idx_materials_subject_user ON materials(subject_id, user_id);

-- 3. Materials: Index for duplicate title checking (Lower-case title for case-insensitivity)
CREATE INDEX IF NOT EXISTS idx_materials_title_lookup ON materials(user_id, subject_id, LOWER(title));

-- 4. Chat History: Index for fast history retrieval
CREATE INDEX IF NOT EXISTS idx_chat_history_lookup ON chat_history(user_id, subject_id);

-- 5. Chat History Vector Index (Requires pgvector)
-- Using HNSW for high performance similarity search on embeddings
CREATE INDEX IF NOT EXISTS idx_chat_history_embedding ON chat_history USING hnsw (embedding vector_cosine_ops);

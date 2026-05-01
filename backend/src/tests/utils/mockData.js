import { COMPLETED } from '../../constants/status.enum.js';

// Stable mock entities referenced by existing tests — do not change IDs/shapes.

export const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    status: 'ACTIVE',
    auth_provider: 'local',
    provider_id: null,
    password_hash: '$2b$12$hashedpassword',
    storage_limit_bytes: null,
    avatar_url: null,
    settings: {},
    achievements: [],
    last_login_at: null,
    last_active_at: null,
    created_at: '2024-01-01T00:00:00.000Z',
    reset_token_hash: null,
    reset_token_expires: null,
};

export const mockAdminUser = {
    ...mockUser,
    id: 'admin-uuid-0000-0000-000000000001',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
};

export const mockSubject = {
    id: 'abc-123',
    user_id: mockUser.id,
    name: 'Computer Science',
    description: 'CS context',
    color: '#6366f1',
    is_imported: false,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
};

export const mockMaterial = {
    id: '987f6543-e21b-7a89-c321-426614174000',
    user_id: mockUser.id,
    subject_id: mockSubject.id,
    title: 'Test Document',
    content: 'Mock content for testing',
    type: 'upload',
    status: COMPLETED,
    job_id: null,
    ai_result: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
};

export const mockLoginAttempt = {
    email: mockUser.email,
    ip_address: '127.0.0.1',
    user_agent_hash: 'sha256-test-hash',
    user_agent: 'Mozilla/5.0 (Test)',
    attempt_count: 1,
    window_started_at: new Date().toISOString(),
    last_attempt_at: new Date().toISOString(),
    locked_until: null,
    last_security_alert_sent_at: null,
};

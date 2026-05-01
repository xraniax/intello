/**
 * Test data factories.
 *
 * Use these to build realistic fake entities for tests.
 * Every field has a sensible default so callers only need to
 * override the fields they care about.
 *
 * Usage:
 *   const user = makeUser({ role: 'admin' });
 *   const material = makeMaterial({ status: 'FAILED', userId: user.id });
 */

import crypto from 'crypto';

let _idCounter = 1;
const uid = () => `test-uuid-${_idCounter++}`;
const nowIso = () => new Date().toISOString();

// ─── User ─────────────────────────────────────────────────────────────────────

export const makeUser = (overrides = {}) => ({
    id: uid(),
    email: `user-${_idCounter}@example.com`,
    name: 'Test User',
    role: 'user',
    status: 'ACTIVE',
    auth_provider: 'local',
    provider_id: null,
    password_hash: '$bcrypt$hashed$',
    storage_limit_bytes: null, // null → uses default from settings
    avatar_url: null,
    settings: {},
    achievements: [],
    last_login_at: null,
    last_active_at: null,
    created_at: nowIso(),
    reset_token_hash: null,
    reset_token_expires: null,
    ...overrides,
});

export const makeAdminUser = (overrides = {}) =>
    makeUser({ role: 'admin', email: 'admin@example.com', ...overrides });

export const makeSuspendedUser = (overrides = {}) =>
    makeUser({ status: 'SUSPENDED', ...overrides });

// ─── Material ─────────────────────────────────────────────────────────────────

export const makeMaterial = (overrides = {}) => ({
    id: uid(),
    user_id: uid(),
    subject_id: uid(),
    title: 'Test Material',
    content: 'Some extracted content.',
    type: 'summary',
    status: 'COMPLETED',
    job_id: null,
    ai_result: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    ...overrides,
});

export const makePendingMaterial = (overrides = {}) =>
    makeMaterial({ status: 'PENDING_JOB', job_id: `job-${uid()}`, ...overrides });

export const makeFailedMaterial = (overrides = {}) =>
    makeMaterial({ status: 'FAILED', ...overrides });

// ─── Subject ──────────────────────────────────────────────────────────────────

export const makeSubject = (overrides = {}) => ({
    id: uid(),
    user_id: uid(),
    name: 'Test Subject',
    description: null,
    color: '#6366f1',
    is_imported: false,
    created_at: nowIso(),
    updated_at: nowIso(),
    ...overrides,
});

// ─── File record ──────────────────────────────────────────────────────────────

export const makeFile = (overrides = {}) => ({
    id: uid(),
    user_id: uid(),
    subject_id: uid(),
    material_id: uid(),
    filename: 'document.pdf',
    original_name: 'Lecture Notes.pdf',
    mime_type: 'application/pdf',
    size_bytes: 1024 * 1024, // 1 MB
    path: '/uploads/document.pdf',
    created_at: nowIso(),
    ...overrides,
});

// ─── System Alert ─────────────────────────────────────────────────────────────

export const makeAlert = (overrides = {}) => ({
    id: uid(),
    type: 'UPLOAD_FAILURE',
    severity: 'WARNING',
    title: 'Test Alert',
    message: 'Something went wrong.',
    user_id: null,
    entity_id: null,
    resolved: false,
    created_at: nowIso(),
    ...overrides,
});

// ─── Login Attempt ────────────────────────────────────────────────────────────

export const makeLoginAttempt = (overrides = {}) => ({
    email: 'test@example.com',
    ip_address: '127.0.0.1',
    user_agent_hash: crypto.createHash('sha256').update('Mozilla/5.0').digest('hex'),
    user_agent: 'Mozilla/5.0',
    attempt_count: 1,
    window_started_at: nowIso(),
    last_attempt_at: nowIso(),
    locked_until: null,
    last_security_alert_sent_at: null,
    ...overrides,
});

export const makeLockedAttempt = (overrides = {}) =>
    makeLoginAttempt({
        attempt_count: 5,
        locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        ...overrides,
    });

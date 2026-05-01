import { jest } from '@jest/globals';

// ─── Environment ──────────────────────────────────────────────────────────────
process.env.JWT_SECRET   = 'test-secret-key';
process.env.ENGINE_URL   = 'http://localhost:8000';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.NODE_ENV     = 'test';

// ─── DB mock ──────────────────────────────────────────────────────────────────
//
// Routed by SQL content so that new service calls added to controllers
// don't silently consume queue slots and break unrelated tests.
//
// Tests can still override specific calls by using mockResolvedValueOnce —
// those always fire before the implementation below — but keep in mind that
// mockResolvedValueOnce is position-based, not content-based.  For complex
// flows, prefer jest.unstable_mockModule at the test-file level.
//
global.__mockDbQuery = jest.fn().mockImplementation((text, params) => {
    if (!text) return Promise.resolve({ rows: [] });

    // ── protect middleware: user lookup by id ──────────────────────────────
    if (text.includes('SELECT') && text.includes('FROM users') && text.includes('WHERE id = $1')) {
        return Promise.resolve({
            rows: [{ id: params[0], name: 'Test User', email: 'test@example.com', role: 'user', status: 'ACTIVE' }],
        });
    }

    // ── admin_settings (SettingsService) ──────────────────────────────────
    // Always returns empty → uses coded defaults (allow_public_registration=true, etc.)
    if (text.includes('admin_settings')) {
        return Promise.resolve({ rows: [] });
    }

    // ── login_attempts ────────────────────────────────────────────────────
    // SELECT → not locked; INSERT/UPDATE → 1 attempt recorded
    if (text.includes('login_attempts')) {
        if (text.includes('INSERT') || (text.includes('UPDATE') && text.includes('locked_until'))) {
            // lockTuple / markAlertSent
            return Promise.resolve({ rows: [], rowCount: 1 });
        }
        if (text.includes('INSERT') || text.includes('ON CONFLICT')) {
            // trackFailure UPSERT with RETURNING
            return Promise.resolve({
                rows: [{ attempt_count: 1, last_security_alert_sent_at: null, locked_until: null }],
            });
        }
        if (text.includes('DELETE')) {
            return Promise.resolve({ rows: [], rowCount: 1 });
        }
        // SELECT checkStatus → not locked
        return Promise.resolve({ rows: [] });
    }

    // ── catch-all ─────────────────────────────────────────────────────────
    return Promise.resolve({ rows: [] });
});

// Keep this reference so old tests that call global.__mockAxiosPost.mockResolvedValueOnce
// don't throw, even though engineClient is now mocked at module level in newer tests.
global.__mockAxiosPost = jest.fn();

global.generateTestToken = () => 'test-bypass-token';

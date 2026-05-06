import { jest } from '@jest/globals';
import request from 'supertest';

// --- Mocks (all must be declared before any imports) ---

const mockUserMethods = {
    findOrCreateByProvider: jest.fn(),
    findById: jest.fn(),
    updateLastLogin: jest.fn().mockResolvedValue(),
};

const mockSettingsService = {
    getStorageControls: jest.fn().mockResolvedValue({ allow_public_registration: true }),
};

const mockSendEmail = jest.fn().mockResolvedValue();

const mockPassport = {
    authenticateHandler: (req, res, next) => next(),
    authenticate: jest.fn((strategy, options) => (req, res, next) => {
        return mockPassport.authenticateHandler(req, res, next, strategy, options);
    }),
    initialize: jest.fn(() => (req, res, next) => next()),
    session: jest.fn(() => (req, res, next) => next()),
    serializeUser: jest.fn(),
    deserializeUser: jest.fn(),
    use: jest.fn(),
};

process.env.NODE_ENV = 'test';
process.env.PDF_STORAGE_PATH = './tmp_test_uploads';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GITHUB_CLIENT_ID = 'test-github-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.JWT_SECRET = 'test-jwt-secret';

// Mock passport module
jest.unstable_mockModule('passport', () => ({
    default: mockPassport,
}));

// Mock other modules
jest.unstable_mockModule('../../models/user.model.js', () => ({ default: mockUserMethods }));
jest.unstable_mockModule('../../services/settings.service.js', () => ({ default: mockSettingsService }));
jest.unstable_mockModule('../../utils/services/email.service.js', () => ({ default: mockSendEmail }));

// --- App import after mocks ---
const { default: app } = await import('../../app.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTIVE_USER = {
    id: 'uuid-1',
    email: 'alice@example.com',
    name: 'Alice Smith',
    role: 'user',
    status: 'ACTIVE',
    auth_provider: 'google',
    provider_id: 'google-123',
    isNewRecord: false,
};

const NEW_USER = {
    id: 'uuid-2',
    email: 'bob@example.com',
    name: 'Bob Johnson',
    role: 'user',
    status: 'ACTIVE',
    auth_provider: 'github',
    provider_id: 'github-456',
    isNewRecord: true,
};

const SUSPENDED_USER = {
    id: 'uuid-3',
    email: 'suspended@example.com',
    name: 'Suspended User',
    role: 'user',
    status: 'SUSPENDED',
    auth_provider: 'google',
    provider_id: 'google-789',
    isNewRecord: false,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OAuth Authentication', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.FRONTEND_URL = 'http://localhost:3000';
    });

    describe('Google OAuth', () => {
        describe('when OAuth is enabled', () => {
            beforeEach(() => {
                process.env.GOOGLE_CLIENT_ID = 'test-client-id';
                process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
            });

            it('initiates Google OAuth flow', async () => {
                mockPassport.authenticateHandler = (req, res, next) => {
                    res.redirect('https://accounts.google.com/oauth');
                };

                const res = await request(app).get('/api/auth/google');

                expect(res.status).toBe(302);
                expect(mockPassport.authenticate).toHaveBeenCalledWith('google', { scope: ['profile', 'email'] });
            });

            describe('callback success', () => {
                it('redirects to dashboard with token for existing user', async () => {
                    mockUserMethods.findOrCreateByProvider.mockResolvedValue({ user: ACTIVE_USER, isNew: false });
                    mockPassport.authenticateHandler = (req, res, next) => {
                        req.user = ACTIVE_USER;
                        next();
                    };

                    const res = await request(app).get('/api/auth/google/callback');

                    expect(res.status).toBe(302);
                    expect(res.headers.location).toMatch(/^http:\/\/localhost:3000\/dashboard\?token=.+$/);
                    expect(mockUserMethods.updateLastLogin).toHaveBeenCalledWith(ACTIVE_USER.id);
                });

                it('redirects to dashboard with token for new user and sends welcome email', async () => {
                    mockUserMethods.findOrCreateByProvider.mockResolvedValue({ user: NEW_USER, isNew: true });
                    mockPassport.authenticateHandler = (req, res, next) => {
                        req.user = NEW_USER;
                        next();
                    };

                    const res = await request(app).get('/api/auth/google/callback');

                    expect(res.status).toBe(302);
                    expect(res.headers.location).toMatch(/^http:\/\/localhost:3000\/dashboard\?token=.+$/);
                    expect(mockSendEmail).toHaveBeenCalledWith({
                        email: NEW_USER.email,
                        subject: 'Welcome to Cognify ✨',
                        message: expect.stringContaining('Welcome to **Cognify**')
                    });
                });

                it('blocks new user registration when public registration is disabled', async () => {
                    mockSettingsService.getStorageControls.mockResolvedValue({ allow_public_registration: false });
                    mockUserMethods.findOrCreateByProvider.mockResolvedValue({ user: NEW_USER, isNew: true });
                    mockPassport.authenticateHandler = (req, res, next) => {
                        req.user = NEW_USER;
                        next();
                    };

                    const res = await request(app).get('/api/auth/google/callback');

                    expect(res.status).toBe(302);
                    expect(res.headers.location).toBe('http://localhost:3000/login?error=registration_disabled');
                });

                it('redirects to login with error for suspended user', async () => {
                    mockUserMethods.findOrCreateByProvider.mockResolvedValue({ user: SUSPENDED_USER, isNew: false });
                    mockPassport.authenticateHandler = (req, res, next) => {
                        req.user = SUSPENDED_USER;
                        next();
                    };

                    const res = await request(app).get('/api/auth/google/callback');

                    expect(res.status).toBe(302);
                    expect(res.headers.location).toBe('http://localhost:3000/login?error=account_suspended');
                });
            });

            describe('callback failure', () => {
                it('redirects to login with auth_failed error when no user in request', async () => {
                    mockPassport.authenticateHandler = (req, res, next) => {
                        req.user = null;
                        next();
                    };

                    const res = await request(app).get('/api/auth/google/callback');

                    expect(res.status).toBe(302);
                    expect(res.headers.location).toBe('http://localhost:3000/login?error=auth_failed');
                });
            });
        });
    });

    describe('GitHub OAuth', () => {
        describe('when OAuth is enabled', () => {
            beforeEach(() => {
                process.env.GITHUB_CLIENT_ID = 'test-client-id';
                process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
            });

            it('initiates GitHub OAuth flow', async () => {
                mockPassport.authenticate.mockImplementation(() => (req, res, next) => {
                    res.redirect('https://github.com/login/oauth');
                });

                const res = await request(app).get('/api/auth/github');

                expect(res.status).toBe(302);
                expect(mockPassport.authenticate).toHaveBeenCalledWith('github', { scope: ['user:email'] });
            });

            describe('callback success', () => {
                it('redirects to dashboard with token for existing user', async () => {
                    mockUserMethods.findOrCreateByProvider.mockResolvedValue({ user: ACTIVE_USER, isNew: false });
                    mockPassport.authenticate.mockImplementation((strategy, options) => (req, res, next) => {
                        req.user = { ...ACTIVE_USER, auth_provider: 'github' };
                        next();
                    });

                    const res = await request(app).get('/api/auth/github/callback');

                    expect(res.status).toBe(302);
                    expect(res.headers.location).toMatch(/^http:\/\/localhost:3000\/dashboard\?token=.+$/);
                });

                it('redirects to dashboard with token for new user', async () => {
                    mockUserMethods.findOrCreateByProvider.mockResolvedValue({ user: NEW_USER, isNew: true });
                    mockPassport.authenticate.mockImplementation((strategy, options) => (req, res, next) => {
                        req.user = NEW_USER;
                        next();
                    });

                    const res = await request(app).get('/api/auth/github/callback');

                    expect(res.status).toBe(302);
                    expect(res.headers.location).toMatch(/^http:\/\/localhost:3000\/dashboard\?token=.+$/);
                });
            });

            describe('callback failure', () => {
                it('redirects to login with auth_failed error when authentication fails', async () => {
                    mockPassport.authenticate.mockImplementation((strategy, options) => (req, res, next) => {
                        req.user = null;
                        next();
                    });

                    const res = await request(app).get('/api/auth/github/callback');

                    expect(res.status).toBe(302);
                    expect(res.headers.location).toBe('http://localhost:3000/login?error=auth_failed');
                });
            });
        });

    });

    describe('OAuth error handling', () => {
        beforeEach(() => {
            process.env.GOOGLE_CLIENT_ID = 'test-client-id';
            process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
        });

        it('handles invalid tokens gracefully', async () => {
            mockUserMethods.findOrCreateByProvider.mockRejectedValue(new Error('Invalid token'));
            mockPassport.authenticate.mockImplementation((strategy, options) => (req, res, next) => {
                req.user = null;
                next();
            });

            const res = await request(app).get('/api/auth/google/callback');

            expect(res.status).toBe(302);
            expect(res.headers.location).toBe('http://localhost:3000/login?error=auth_failed');
        });

        it('handles denied permissions', async () => {
            // Simulate passport failure redirect
            mockPassport.authenticate.mockImplementation((strategy, options) => (req, res, next) => {
                if (options.failureRedirect) {
                    return res.redirect(options.failureRedirect);
                }
                next();
            });

            const res = await request(app).get('/api/auth/google/callback?error=access_denied');

            expect(res.status).toBe(302);
            expect(res.headers.location).toBe('http://localhost:3000/login?error=auth_failed');
        });
    });
});
import { jest } from '@jest/globals';
import request from 'supertest';

// --- Mocks (all must be declared before any imports) ---

process.env.NODE_ENV = 'test';
process.env.PDF_STORAGE_PATH = './tmp_test_uploads';

const mockAdminService = {
    getAllUsers: jest.fn(),
    updateUserStatus: jest.fn(),
    updateUserRole: jest.fn(),
    deleteUser: jest.fn(),
};

jest.unstable_mockModule('../../services/admin.service.js', () => ({ default: mockAdminService }));

// --- App import after mocks ---
const { default: app } = await import('../../app.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_USER = {
    id: 'admin-uuid',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
    status: 'ACTIVE',
};

const REGULAR_USER = {
    id: 'user-uuid',
    email: 'user@example.com',
    name: 'Regular User',
    role: 'user',
    status: 'ACTIVE',
};

const SUSPENDED_USER = {
    id: 'suspended-uuid',
    email: 'suspended@example.com',
    name: 'Suspended User',
    role: 'user',
    status: 'SUSPENDED',
};

const ADMIN_TOKEN = 'test-bypass-token-admin';
const USER_TOKEN = 'test-bypass-token-user';

const mockUsers = [
    {
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice Smith',
        role: 'user',
        status: 'ACTIVE',
        created_at: '2024-01-01T00:00:00Z',
        last_login: '2024-01-15T00:00:00Z'
    },
    {
        id: 'user-2',
        email: 'bob@example.com',
        name: 'Bob Johnson',
        role: 'user',
        status: 'ACTIVE',
        created_at: '2024-01-02T00:00:00Z',
        last_login: null
    }
];

const mockPaginatedUsers = {
    users: mockUsers,
    total: 2
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Admin User Management', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/admin/users', () => {
        it('returns paginated list of users for admin', async () => {
            mockAdminService.getAllUsers.mockResolvedValue(mockPaginatedUsers);

            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(mockUsers);
            expect(res.body.pagination).toBeDefined();
            expect(res.body.pagination.total).toBe(2);
            expect(mockAdminService.getAllUsers).toHaveBeenCalledWith({
                sortBy: undefined,
                order: undefined,
                page: 1,
                limit: 10,
                offset: 0
            });
        });

        it('supports pagination parameters', async () => {
            mockAdminService.getAllUsers.mockResolvedValue({
                users: [mockUsers[0]],
                total: 2
            });

            const res = await request(app)
                .get('/api/admin/users?page=2&limit=1&sortBy=name&order=desc')
                .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

            expect(res.status).toBe(200);
            expect(mockAdminService.getAllUsers).toHaveBeenCalledWith({
                sortBy: 'name',
                order: 'desc',
                page: 2,
                limit: 1,
                offset: 1
            });
        });

        it('returns 403 for non-admin users', async () => {
            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${USER_TOKEN}`);

            expect(res.status).toBe(403);
            expect(res.body.message).toBe('Admin access required');
        });

        it('returns 401 when not authenticated', async () => {
            const res = await request(app).get('/api/admin/users');

            expect(res.status).toBe(401);
        });
    });

    describe('PATCH /api/admin/users/:userId/status', () => {
        it('suspends user successfully', async () => {
            const updatedUser = { ...mockUsers[0], status: 'SUSPENDED' };
            mockAdminService.updateUserStatus.mockResolvedValue(updatedUser);

            const res = await request(app)
                .patch('/api/admin/users/user-1/status')
                .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
                .send({ status: 'SUSPENDED', reason: 'Violation of terms' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('SUSPENDED');
            expect(res.body.message).toBe('User status updated to SUSPENDED');
            expect(mockAdminService.updateUserStatus).toHaveBeenCalledWith(
                ADMIN_USER.id,
                'user-1',
                'SUSPENDED',
                'Violation of terms'
            );
        });

        it('activates user successfully', async () => {
            const updatedUser = { ...SUSPENDED_USER, status: 'ACTIVE' };
            mockAdminService.updateUserStatus.mockResolvedValue(updatedUser);

            const res = await request(app)
                .patch('/api/admin/users/suspended-uuid/status')
                .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
                .send({ status: 'ACTIVE' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('ACTIVE');
            expect(res.body.message).toBe('User status updated to ACTIVE');
        });

        it('returns 404 for non-existent user', async () => {
            mockAdminService.updateUserStatus.mockResolvedValue(null);

            const res = await request(app)
                .patch('/api/admin/users/non-existent/status')
                .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
                .send({ status: 'SUSPENDED' });

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('User not found');
        });

        it('returns 403 for non-admin users', async () => {
            const res = await request(app)
                .patch('/api/admin/users/user-1/status')
                .set('Authorization', `Bearer ${USER_TOKEN}`)
                .send({ status: 'SUSPENDED' });

            expect(res.status).toBe(403);
        });
    });

    describe('PATCH /api/admin/users/:userId/role', () => {
        it('promotes user to admin successfully', async () => {
            const updatedUser = { ...mockUsers[0], role: 'admin' };
            mockAdminService.updateUserRole.mockResolvedValue(updatedUser);

            const res = await request(app)
                .patch('/api/admin/users/user-1/role')
                .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
                .send({ role: 'admin' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.role).toBe('admin');
            expect(res.body.message).toBe('User role updated to admin');
            expect(mockAdminService.updateUserRole).toHaveBeenCalledWith(
                ADMIN_USER.id,
                'user-1',
                'admin'
            );
        });

        it('demotes admin to user successfully', async () => {
            const adminToDemote = { ...ADMIN_USER, role: 'user' };
            mockAdminService.updateUserRole.mockResolvedValue(adminToDemote);

            const res = await request(app)
                .patch('/api/admin/users/admin-uuid/role')
                .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
                .send({ role: 'user' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.role).toBe('user');
            expect(res.body.message).toBe('User role updated to user');
        });

        it('returns 403 for non-admin users', async () => {
            const res = await request(app)
                .patch('/api/admin/users/user-1/role')
                .set('Authorization', `Bearer ${USER_TOKEN}`)
                .send({ role: 'admin' });

            expect(res.status).toBe(403);
        });
    });

    describe('DELETE /api/admin/users/:id', () => {
        it('deletes user successfully', async () => {
            mockAdminService.deleteUser.mockResolvedValue(true);

            const res = await request(app)
                .delete('/api/admin/users/user-1')
                .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('User deleted permanently');
            expect(mockAdminService.deleteUser).toHaveBeenCalledWith(
                ADMIN_USER.id,
                'user-1'
            );
        });

        it('returns 404 for non-existent user', async () => {
            mockAdminService.deleteUser.mockResolvedValue(false);

            const res = await request(app)
                .delete('/api/admin/users/non-existent')
                .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('User not found or deletion failed');
        });

        it('returns 403 for non-admin users', async () => {
            const res = await request(app)
                .delete('/api/admin/users/user-1')
                .set('Authorization', `Bearer ${USER_TOKEN}`);

            expect(res.status).toBe(403);
        });
    });

    describe('RBAC - Role-Based Access Control', () => {
        it('blocks all admin routes for regular users', async () => {
            const routes = [
                { method: 'get', path: '/api/admin/users' },
                { method: 'patch', path: '/api/admin/users/user-1/status' },
                { method: 'patch', path: '/api/admin/users/user-1/role' },
                { method: 'delete', path: '/api/admin/users/user-1' }
            ];

            for (const route of routes) {
                const res = await request(app)[route.method](route.path)
                    .set('Authorization', `Bearer ${USER_TOKEN}`);

                expect(res.status).toBe(403);
                expect(res.body.message).toBe('Admin access required');
            }
        });

        it('allows admin access to all admin routes', async () => {
            mockAdminService.getAllUsers.mockResolvedValue(mockPaginatedUsers);
            mockAdminService.updateUserStatus.mockResolvedValue(mockUsers[0]);
            mockAdminService.updateUserRole.mockResolvedValue(mockUsers[0]);
            mockAdminService.deleteUser.mockResolvedValue(true);

            // Test GET users
            const getRes = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
            expect(getRes.status).toBe(200);

            // Test PATCH status
            const patchStatusRes = await request(app)
                .patch('/api/admin/users/user-1/status')
                .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
                .send({ status: 'SUSPENDED' });
            expect(patchStatusRes.status).toBe(200);

            // Test PATCH role
            const patchRoleRes = await request(app)
                .patch('/api/admin/users/user-1/role')
                .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
                .send({ role: 'admin' });
            expect(patchRoleRes.status).toBe(200);

            // Test DELETE
            const deleteRes = await request(app)
                .delete('/api/admin/users/user-1')
                .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
            expect(deleteRes.status).toBe(200);
        });
    });
});
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock external services before importing the store
vi.mock('@/features/auth/services/AuthService', () => ({
    authService: {
        getMe: vi.fn(),
        login: vi.fn(),
        register: vi.fn(),
    },
}));

vi.mock('@/features/user/services/ProfileService', () => ({
    profileService: {},
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { authService } from '@/features/auth/services/AuthService';
import toast from 'react-hot-toast';

// Reset both stores before each test
const resetStores = () => {
    useAuthStore.setState({
        data: { user: null, isInitialized: false },
        error: null,
    });
    useUIStore.setState({
        data: { loadingStates: {}, errors: {}, activeWorkspacePanel: 'content', modal: null, pendingAction: null },
        loading: false,
        error: null,
    });
};

// Stub localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: vi.fn((k) => store[k] ?? null),
        setItem: vi.fn((k, v) => { store[k] = v; }),
        removeItem: vi.fn((k) => { delete store[k]; }),
        clear: vi.fn(() => { store = {}; }),
    };
})();

beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
    resetStores();
});

const getStore = () => useAuthStore.getState();

// ─── logout ───────────────────────────────────────────────────────────────────

describe('logout', () => {
    it('removes the token from localStorage and clears user state', () => {
        useAuthStore.setState({ data: { user: { id: 1 }, isInitialized: true }, error: null });
        localStorageMock.setItem('token', 'some-token');

        act(() => getStore().actions.logout());

        expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
        expect(getStore().data.user).toBeNull();
    });
});

// ─── setUser ──────────────────────────────────────────────────────────────────

describe('setUser', () => {
    it('updates the user in state', () => {
        act(() => getStore().actions.setUser({ id: 42, name: 'Bob' }));
        expect(getStore().data.user).toMatchObject({ id: 42, name: 'Bob' });
    });
});

// ─── loadUser ─────────────────────────────────────────────────────────────────

describe('loadUser', () => {
    it('sets user to null and isInitialized=true when no token present', async () => {
        localStorageMock.getItem.mockReturnValue(null);

        await act(async () => {
            await getStore().actions.loadUser();
        });

        expect(getStore().data.user).toBeNull();
        expect(getStore().data.isInitialized).toBe(true);
    });

    it('fetches and stores user when token is present', async () => {
        localStorageMock.getItem.mockReturnValue('valid-token');
        authService.getMe.mockResolvedValue({ data: { data: { id: 1, name: 'Alice' } } });

        await act(async () => {
            await getStore().actions.loadUser();
        });

        expect(getStore().data.user).toMatchObject({ id: 1, name: 'Alice' });
        expect(getStore().data.isInitialized).toBe(true);
    });

    it('clears token and sets user null when getMe throws', async () => {
        localStorageMock.getItem.mockReturnValue('bad-token');
        authService.getMe.mockRejectedValue(new Error('Unauthorized'));

        await act(async () => {
            await expect(getStore().actions.loadUser()).rejects.toThrow();
        });

        expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
        expect(getStore().data.user).toBeNull();
        expect(getStore().data.isInitialized).toBe(true);
    });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe('login', () => {
    it('stores token, sets user, and shows success toast on success', async () => {
        authService.login.mockResolvedValue({
            data: { data: { id: 1, name: 'Alice', token: 'new-jwt' } },
        });

        await act(async () => {
            await getStore().actions.login('alice@example.com', 'pass');
        });

        expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'new-jwt');
        expect(getStore().data.user).toMatchObject({ id: 1, name: 'Alice' });
        expect(toast.success).toHaveBeenCalled();
    });

    it('does not store token in user data (token is stripped)', async () => {
        authService.login.mockResolvedValue({
            data: { data: { id: 1, name: 'Alice', role: 'user', token: 'jwt-xyz' } },
        });

        await act(async () => {
            await getStore().actions.login('a@b.com', 'pass');
        });

        expect(getStore().data.user?.token).toBeUndefined();
    });

    it('sets error state and re-throws on failure', async () => {
        authService.login.mockRejectedValue({ message: 'Invalid credentials' });

        await act(async () => {
            await expect(getStore().actions.login('a@b.com', 'wrong')).rejects.toMatchObject({
                message: 'Invalid credentials',
            });
        });

        expect(getStore().error).toBe('Invalid credentials');
    });
});

// ─── register ─────────────────────────────────────────────────────────────────

describe('register', () => {
    it('stores token, sets user, shows toast on success', async () => {
        authService.register.mockResolvedValue({
            data: { data: { id: 99, name: 'Bob', email: 'bob@test.com', token: 'reg-token' } },
        });

        await act(async () => {
            await getStore().actions.register({ name: 'Bob', email: 'bob@test.com', password: 'pass1234' });
        });

        expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'reg-token');
        expect(getStore().data.user).toMatchObject({ id: 99 });
        expect(toast.success).toHaveBeenCalled();
    });

    it('sets error and re-throws on failure', async () => {
        authService.register.mockRejectedValue({ message: 'Email already registered' });

        await act(async () => {
            await expect(getStore().actions.register({})).rejects.toBeDefined();
        });

        expect(getStore().error).toBe('Email already registered');
    });
});

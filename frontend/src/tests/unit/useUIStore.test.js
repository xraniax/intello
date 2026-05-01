import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../../store/useUIStore';

// Reset store state to initial values before every test
beforeEach(() => {
    useUIStore.setState({
        data: {
            loadingStates: {},
            errors: {},
            activeWorkspacePanel: 'content',
            modal: null,
            pendingAction: null,
        },
        loading: false,
        error: null,
    });
});

const getActions = () => useUIStore.getState().actions;
const getData = () => useUIStore.getState().data;

// ─── setLoading ───────────────────────────────────────────────────────────────

describe('setLoading', () => {
    it('sets loading state to true with message', () => {
        getActions().setLoading('auth', true, 'Signing in...');
        expect(getData().loadingStates['auth'].loading).toBe(true);
        expect(getData().loadingStates['auth'].message).toBe('Signing in...');
    });

    it('sets loading state to false', () => {
        getActions().setLoading('auth', true, 'Signing in...');
        getActions().setLoading('auth', false);
        expect(getData().loadingStates['auth'].loading).toBe(false);
    });

    it('tracks multiple independent loading keys', () => {
        getActions().setLoading('auth', true);
        getActions().setLoading('upload', true);
        expect(getData().loadingStates['auth'].loading).toBe(true);
        expect(getData().loadingStates['upload'].loading).toBe(true);
    });
});

// ─── setError / clearError ────────────────────────────────────────────────────

describe('setError and clearError', () => {
    it('stores an error message for a key', () => {
        getActions().setError('auth', 'Invalid credentials');
        expect(getData().errors['auth']).toBe('Invalid credentials');
    });

    it('sets loading to false when setting an error', () => {
        getActions().setLoading('auth', true);
        getActions().setError('auth', 'Something went wrong');
        expect(getData().loadingStates['auth'].loading).toBe(false);
    });

    it('clears the error for a specific key', () => {
        getActions().setError('auth', 'Some error');
        getActions().clearError('auth');
        expect(getData().errors['auth']).toBeNull();
    });

    it('does not affect errors for other keys when clearing one', () => {
        getActions().setError('auth', 'error A');
        getActions().setError('upload', 'error B');
        getActions().clearError('auth');
        expect(getData().errors['upload']).toBe('error B');
    });
});

// ─── setWorkspacePanel ────────────────────────────────────────────────────────

describe('setWorkspacePanel', () => {
    it('updates the active workspace panel', () => {
        getActions().setWorkspacePanel('files');
        expect(getData().activeWorkspacePanel).toBe('files');
    });

    it('switches back to content panel', () => {
        getActions().setWorkspacePanel('tutor');
        getActions().setWorkspacePanel('content');
        expect(getData().activeWorkspacePanel).toBe('content');
    });
});

// ─── setModal / clearPendingAction ────────────────────────────────────────────

describe('modal management', () => {
    it('sets the modal type', () => {
        getActions().setModal('authPrompt');
        expect(getData().modal).toBe('authPrompt');
    });

    it('sets modal to null to close', () => {
        getActions().setModal('authPrompt');
        getActions().setModal(null);
        expect(getData().modal).toBeNull();
    });
});

// ─── pendingAction ────────────────────────────────────────────────────────────

describe('pendingAction', () => {
    it('stores and executes a pending action', () => {
        let called = false;
        getActions().setPendingAction(() => { called = true; });
        getActions().runPendingAction();
        expect(called).toBe(true);
    });

    it('clears pending action after running it', () => {
        getActions().setPendingAction(() => {});
        getActions().runPendingAction();
        expect(getData().pendingAction).toBeNull();
    });

    it('clearPendingAction removes the action without running it', () => {
        let called = false;
        getActions().setPendingAction(() => { called = true; });
        getActions().clearPendingAction();
        expect(called).toBe(false);
        expect(getData().pendingAction).toBeNull();
    });
});

// ─── getGlobalLoading ─────────────────────────────────────────────────────────

describe('getGlobalLoading', () => {
    it('returns null when no tasks are loading', () => {
        expect(getActions().getGlobalLoading()).toBeNull();
    });

    it('returns the loading status object when a task is loading', () => {
        getActions().setLoading('auth', true, 'Working...', true);
        const status = getActions().getGlobalLoading();
        expect(status).toMatchObject({ loading: true, message: 'Working...' });
    });

    it('returns null when only non-blocking tasks are loading and onlyBlocking=true', () => {
        getActions().setLoading('upload', true, 'Uploading...', false);
        const status = getActions().getGlobalLoading([], true);
        expect(status).toBeNull();
    });
});

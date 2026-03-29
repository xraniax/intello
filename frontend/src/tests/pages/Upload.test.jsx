import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Upload from '../../pages/Upload';

// Mock Zustand Stores
vi.mock('../../store/useAuthStore', () => ({
    useAuthStore: vi.fn((selector) => {
        const state = { data: { user: { id: '123' } }, actions: {} };
        return selector(state);
    })
}));

vi.mock('../../store/useMaterialStore', () => ({
    useMaterialStore: vi.fn((selector) => {
        const state = { 
            data: { materials: [], isPublic: false }, 
            actions: { uploadMaterial: vi.fn(), fetchMaterials: vi.fn(), getSettings: vi.fn() } 
        };
        return selector(state);
    })
}));

vi.mock('../../store/useUIStore', () => ({
    useUIStore: vi.fn((selector) => {
        const state = { 
            data: { loadingStates: {}, errors: {} }, 
            actions: { setLoading: vi.fn(), clearError: vi.fn() } 
        };
        return selector(state);
    })
}));

vi.mock('../../store/useSubjectStore', () => ({
    useSubjectStore: vi.fn((selector) => {
        const state = { 
            data: { subjects: [] }, 
            actions: { fetchSubjects: vi.fn() } 
        };
        return selector(state);
    })
}));

describe('Upload Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the upload form', () => {
        render(
            <MemoryRouter>
                <Upload />
            </MemoryRouter>
        );
        expect(screen.getByPlaceholderText(/Machine Learning Basics/i)).toBeInTheDocument();
        expect(screen.getByText(/Grow Your Knowledge/i)).toBeInTheDocument();
    });

    it('handles file selection', () => {
        render(
            <MemoryRouter>
                <Upload />
            </MemoryRouter>
        );
        const file = new File(['hello'], 'hello.pdf', { type: 'application/pdf' });
        // The file input is hidden, but accessible by its ID or by the label text
        const input = screen.getByLabelText(/Drop file here/i);
        fireEvent.change(input, { target: { files: [file] } });
        expect(input.files[0].name).toBe('hello.pdf');
    });
});

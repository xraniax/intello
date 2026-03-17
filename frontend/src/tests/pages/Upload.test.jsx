import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Upload from '../../pages/Upload';

// Vitest mocks are better in ESM
vi.mock('../../services/api', () => ({
    materialService: {
        upload: vi.fn()
    },
    subjectService: {
        getAll: vi.fn().mockResolvedValue({ data: { data: [] } })
    }
}));

vi.mock('../../hooks/AuthContext', () => ({
    useAuth: () => ({
        user: { id: '123' }
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
        expect(screen.getByPlaceholderText(/e.g. Introduction/i)).toBeInTheDocument();
        expect(screen.getByText(/Upload Document/i)).toBeInTheDocument();
    });

    it('handles file selection', () => {
        render(
            <MemoryRouter>
                <Upload />
            </MemoryRouter>
        );
        const file = new File(['hello'], 'hello.pdf', { type: 'application/pdf' });
        const input = screen.getByLabelText(/Upload PDF file/i);
        fireEvent.change(input, { target: { files: [file] } });
        expect(input.files[0].name).toBe('hello.pdf');
    });
});

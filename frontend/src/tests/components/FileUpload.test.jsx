import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ─── Mock stores and services ─────────────────────────────────────────────────

const mockUploadMaterial = vi.fn();
const mockFetchSubjects  = vi.fn().mockResolvedValue();

vi.mock('@/store/useMaterialStore', () => ({
    useMaterialStore: (selector) =>
        selector({ actions: { uploadMaterial: mockUploadMaterial } }),
}));

vi.mock('@/store/useSubjectStore', () => ({
    useSubjectStore: (selector) =>
        selector({
            data: { subjects: [{ id: 's1', name: 'Biology' }] },
            actions: { fetchSubjects: mockFetchSubjects },
        }),
}));

vi.mock('@/store/useUIStore', () => ({
    useUIStore: (selector) =>
        selector({ data: { loadingStates: {}, errors: {} } }),
}));

vi.mock('@/services/MaterialService', () => ({
    MaterialService: {
        getSettings: vi.fn().mockResolvedValue({
            data: { data: { max_file_size_mb: 10, allowed_types: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'] } },
        }),
    },
}));

// ─── Component under test ─────────────────────────────────────────────────────

import FileUpload from '../../components/FileUpload';

const renderComponent = (props = {}) =>
    render(<FileUpload subjectId="s1" onSuccess={vi.fn()} onCancel={vi.fn()} {...props} />);

const TITLE_PLACEHOLDER = /machine learning basics/i;

const makePdf = (name = 'notes.pdf', sizeMb = 1) =>
    new File(['x'.repeat(sizeMb * 1024 * 1024)], name, { type: 'application/pdf' });
const makeImage = (name = 'diagram.png', sizeMb = 1) =>
    new File(['x'.repeat(sizeMb * 1024 * 1024)], name, { type: 'image/png' });

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FileUpload component', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the document title input', async () => {
        renderComponent();
        await waitFor(() => {
            expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toBeInTheDocument();
        });
    });

    it('auto-fills the title from the selected PDF file name', async () => {
        renderComponent();
        await waitFor(() => screen.getByPlaceholderText(TITLE_PLACEHOLDER));

        const fileInput = document.querySelector('input[type="file"]');
        await userEvent.upload(fileInput, makePdf('lecture-notes.pdf'));

        await waitFor(() => {
            const titleInput = screen.getByPlaceholderText(TITLE_PLACEHOLDER);
            expect(titleInput.value).toBe('lecture-notes');
        });
    });

    it('accepts image files and auto-fills title from image name', async () => {
        renderComponent();
        await waitFor(() => screen.getByPlaceholderText(TITLE_PLACEHOLDER));

        const fileInput = document.querySelector('input[type="file"]');
        await userEvent.upload(fileInput, makeImage('chapter-graph.png'));

        await waitFor(() => {
            const titleInput = screen.getByPlaceholderText(TITLE_PLACEHOLDER);
            expect(titleInput.value).toBe('chapter-graph');
        });
    });

    it('shows a size error when the uploaded file exceeds the limit', async () => {
        renderComponent();
        await waitFor(() => screen.getByPlaceholderText(TITLE_PLACEHOLDER));

        const fileInput = document.querySelector('input[type="file"]');
        await userEvent.upload(fileInput, makePdf('huge.pdf', 15)); // 15 MB > 10 MB limit

        await waitFor(() => {
            expect(screen.getByText(/too large/i)).toBeInTheDocument();
        });
    });

    it('shows a type error for disallowed file types', async () => {
        renderComponent();
        await waitFor(() => screen.getByPlaceholderText(TITLE_PLACEHOLDER));

        const fileInput = document.querySelector('input[type="file"]');
        const exeFile = new File(['x'], 'virus.exe', { type: 'application/x-msdownload' });

        // userEvent respects the input's accept attribute and drops non-matching files.
        // Use fireEvent to bypass that so we can test the component's own type validation.
        Object.defineProperty(fileInput, 'files', { value: [exeFile], configurable: true });
        fireEvent.change(fileInput);

        await waitFor(() => {
            expect(screen.getByText(/only/i)).toBeInTheDocument();
        });
    });

    it('clears errors for a valid PDF within the size limit', async () => {
        renderComponent();
        await waitFor(() => screen.getByPlaceholderText(TITLE_PLACEHOLDER));

        const fileInput = document.querySelector('input[type="file"]');
        await userEvent.upload(fileInput, makePdf('valid.pdf', 2));

        await waitFor(() => {
            expect(screen.queryByText(/too large/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/only.*files are accepted/i)).not.toBeInTheDocument();
        });
    });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { vi } from 'vitest';

// Mock Zustand useAuthStore
vi.mock('../../store/useAuthStore', () => ({
    useAuthStore: vi.fn((selector) => {
        const state = {
            data: { user: { name: 'Test User' } },
            actions: { logout: vi.fn() }
        };
        return selector(state);
    })
}));

describe('Navbar Component', () => {
    it('renders the brand name', () => {
        render(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>
        );
        expect(screen.getByText(/Cognify/i)).toBeInTheDocument();
    });

    it('renders navigation links', () => {
        render(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>
        );
        expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
        expect(screen.getByText(/Sign out/i)).toBeInTheDocument();
    });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { vi } from 'vitest';

// Mock AuthContext
vi.mock('../../hooks/AuthContext', () => ({
    useAuth: () => ({
        user: { name: 'Test User' },
        logout: vi.fn()
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
        expect(screen.getByText(/Upload/i)).toBeInTheDocument();
        expect(screen.getByText(/History/i)).toBeInTheDocument();
    });
});

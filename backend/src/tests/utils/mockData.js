export const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User'
};

export const mockMaterial = {
    id: '987f6543-e21b-7a89-c321-426614174000',
    user_id: mockUser.id,
    subject_id: 'abc-123',
    title: 'Test Document',
    content: 'Mock content for testing',
    type: 'upload',
    status: 'completed'
};

export const mockSubject = {
    id: 'abc-123',
    user_id: mockUser.id,
    name: 'Computer Science',
    description: 'CS context'
};

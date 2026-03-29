/**
 * Centralized Validation System
 * Returns { valid: boolean, message: string }
 */

export const validateEmail = (email) => {
    if (!email) return { valid: false, message: 'Email is required' };
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) return { valid: false, message: 'Please enter a valid email address' };
    return { valid: true, message: '' };
};

export const validatePassword = (password) => {
    if (!password) return { valid: false, message: 'Password is required' };
    if (password.length < 8) return { valid: false, message: 'Password must be at least 8 characters long' };
    return { valid: true, message: '' };
};

export const validateName = (name) => {
    if (!name) return { valid: false, message: 'Name is required' };
    if (name.trim().length < 2) return { valid: false, message: 'Name must be at least 2 characters long' };
    return { valid: true, message: '' };
};

export const validateRequired = (value, fieldName = 'This field') => {
    if (!value || (typeof value === 'string' && !value.trim())) {
        return { valid: false, message: `${fieldName} is required` };
    }
    return { valid: true, message: '' };
};

export const validateSubjectName = (name) => {
    if (!name) return { valid: false, message: 'Subject name is required' };
    if (name.trim().length < 2) return { valid: false, message: 'Subject name is too short' };
    if (name.trim().length > 50) return { valid: false, message: 'Subject name is too long (max 50 chars)' };
    return { valid: true, message: '' };
};

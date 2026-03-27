import { z } from 'zod';

export const registerSchema = z.object({
    email: z.string().email({ message: 'Invalid email address' }),
    password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
    name: z.string().min(2, { message: 'Name must be at least 2 characters long' }),
});

export const loginSchema = z.object({
    email: z.string().email({ message: 'Invalid email address' }),
    password: z.string().min(1, { message: 'Password is required' }),
});

export const forgotPasswordSchema = z.object({
    email: z.string().email({ message: 'Invalid email address' }),
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1, { message: 'Token is required' }),
    password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
});

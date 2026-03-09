import rateLimit from 'express-rate-limit';

// Global API rate limiter (100 requests per 15 minutes per IP)
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { status: 'error', message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict rate limiter for authentication endpoints (10 requests per 10 minutes per IP)
export const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    message: { status: 'error', message: 'Too many login attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict rate limiter for AI generating tasks (20 requests per hour per IP)
export const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { status: 'error', message: 'AI processing limit reached, please try again in an hour.' },
    standardHeaders: true,
    legacyHeaders: false,
});

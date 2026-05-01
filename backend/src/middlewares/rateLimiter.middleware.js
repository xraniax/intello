import rateLimit from 'express-rate-limit';

// Global API rate limiter (100 requests per 15 minutes per IP)
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { status: 'error', message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict rate limiter for authentication endpoints (50 req/10 min in dev, 10/10 min in prod)
export const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 10 : 50,
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

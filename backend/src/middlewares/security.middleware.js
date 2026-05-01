/**
 * Security Middleware
 * Additional security hardening beyond Helmet
 */

// XSS Pattern Detection - Common attack vectors to block
const XSS_PATTERNS = [
    /<script\b[^>]*>/i,
    /<\/script\s*>/i,
    /javascript:/i,
    /on\w+\s*=/i,  // onclick, onload, etc.
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
    /url\s*\(\s*['"]\s*javascript:/i,
];

// SQL Injection Pattern Detection (basic)
const SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE|CAST)\b.*\b(FROM|INTO|TABLE|DATABASE|SCHEMA|WHERE|AND|OR)\b)/i,
    /(\-\-|\#|\/\*|\*\/)/, // SQL comments
    /(\b1\s*=\s*1\b|\b0\s*=\s*0\b)/i, // Common tautologies
    /(\bOR\b.*\bOR\b|\bAND\b.*\bAND\b)/i, // Multiple conditions
];

// Command Injection Patterns
const COMMAND_INJECTION_PATTERNS = [
    /[;&|`$]\s*\w+/, // Shell metacharacters
    /\$\{.*\}/, // Shell interpolation
    /\$\(.*\)/, // Command substitution
];

/**
 * Recursively scan an object for XSS patterns
 * @param {*} obj - Object to scan
 * @param {number} depth - Current recursion depth
 * @returns {boolean} - True if XSS patterns found
 */
function containsXSSPatterns(obj, depth = 0) {
    if (depth > 5) return false; // Limit recursion depth
    
    if (typeof obj === 'string') {
        return XSS_PATTERNS.some(pattern => pattern.test(obj));
    }
    
    if (Array.isArray(obj)) {
        return obj.some(item => containsXSSPatterns(item, depth + 1));
    }
    
    if (obj && typeof obj === 'object') {
        return Object.values(obj).some(value => containsXSSPatterns(value, depth + 1));
    }
    
    return false;
}

/**
 * Recursively scan an object for SQL injection patterns
 * @param {*} obj - Object to scan
 * @param {number} depth - Current recursion depth
 * @returns {boolean} - True if SQL injection patterns found
 */
function containsSQLInjection(obj, depth = 0) {
    if (depth > 5) return false;
    
    if (typeof obj === 'string') {
        return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(obj));
    }
    
    if (Array.isArray(obj)) {
        return obj.some(item => containsSQLInjection(item, depth + 1));
    }
    
    if (obj && typeof obj === 'object') {
        return Object.values(obj).some(value => containsSQLInjection(value, depth + 1));
    }
    
    return false;
}

/**
 * Sanitize user input - removes dangerous characters but preserves content
 * @param {string} input - Input to sanitize
 * @returns {string} - Sanitized input
 */
export function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    // Remove null bytes
    let sanitized = input.replace(/\x00/g, '');
    
    // Normalize unicode to prevent bypasses
    sanitized = sanitized.normalize('NFC');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    return sanitized;
}

/**
 * XSS Detection Middleware
 * Blocks requests containing common XSS patterns
 */
export const xssDetection = (req, res, next) => {
    // Check query parameters
    if (containsXSSPatterns(req.query)) {
        console.warn(`[Security] XSS pattern detected in query: ${req.method} ${req.path}`, {
            ip: req.ip,
            userAgent: req.headers['user-agent']?.slice(0, 100)
        });
        return res.status(403).json({
            status: 'error',
            code: 'SECURITY_VIOLATION',
            message: 'Request blocked due to security policy violation.'
        });
    }
    
    // Check body (for JSON payloads)
    if (req.body && containsXSSPatterns(req.body)) {
        console.warn(`[Security] XSS pattern detected in body: ${req.method} ${req.path}`, {
            ip: req.ip,
            userAgent: req.headers['user-agent']?.slice(0, 100)
        });
        return res.status(403).json({
            status: 'error',
            code: 'SECURITY_VIOLATION',
            message: 'Request blocked due to security policy violation.'
        });
    }
    
    next();
};

/**
 * SQL Injection Detection Middleware
 * Blocks requests containing common SQL injection patterns
 */
export const sqlInjectionDetection = (req, res, next) => {
    // Only check certain parameters that might reach raw queries
    const suspiciousParams = ['search', 'filter', 'query', 'sort', 'order'];
    
    for (const param of suspiciousParams) {
        const value = req.query[param] || req.body?.[param];
        if (value && typeof value === 'string' && containsSQLInjection(value)) {
            console.warn(`[Security] SQL injection pattern detected: ${req.method} ${req.path}`, {
                param,
                ip: req.ip
            });
            return res.status(403).json({
                status: 'error',
                code: 'SECURITY_VIOLATION',
                message: 'Request blocked due to security policy violation.'
            });
        }
    }
    
    next();
};

/**
 * Request Sanitization Middleware
 * Sanitizes common input fields
 */
export const sanitizeRequest = (req, res, next) => {
    // Sanitize query parameters
    if (req.query) {
        for (const key of Object.keys(req.query)) {
            if (typeof req.query[key] === 'string') {
                req.query[key] = sanitizeInput(req.query[key]);
            }
        }
    }
    
    // Sanitize body fields (only top-level string fields)
    if (req.body && typeof req.body === 'object') {
        for (const key of Object.keys(req.body)) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeInput(req.body[key]);
            }
        }
    }
    
    next();
};

/**
 * Security Headers Middleware
 * Additional security headers beyond Helmet
 */
export const additionalSecurityHeaders = (req, res, next) => {
    // Permissions Policy (formerly Feature Policy)
    // Restricts browser features that can be used
    res.setHeader(
        'Permissions-Policy',
        'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
    );
    
    // Ensure no caching of authenticated responses
    if (req.user) {
        res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    
    next();
};

/**
 * Rate Limit bypass detection
 * Detects attempts to bypass rate limiting via headers
 */
export const rateLimitBypassDetection = (req, res, next) => {
    const suspiciousHeaders = [
        'x-forwarded-for',
        'x-real-ip',
        'cf-connecting-ip',
        'true-client-ip'
    ];
    
    // Check for multiple IP spoofing headers (may indicate bypass attempt)
    const spoofingHeaders = suspiciousHeaders.filter(h => req.headers[h]);
    
    if (spoofingHeaders.length > 2) {
        console.warn(`[Security] Multiple IP spoofing headers detected`, {
            headers: spoofingHeaders,
            ip: req.ip,
            path: req.path
        });
    }
    
    next();
};

export default {
    xssDetection,
    sqlInjectionDetection,
    sanitizeRequest,
    additionalSecurityHeaders,
    rateLimitBypassDetection
};

/**
 * Centralized error handling middleware.
 * - Logs the full stack trace on the server for debugging.
 * - Returns a clean JSON body to the client without internal details in production.
 */
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

    // Always log the full error server-side for observability
    if (statusCode >= 500) {
        console.error(`[Error] ${err.stack}`);
    } else {
        console.warn(`[${statusCode}] ${err.message}`);
    }

    res.status(statusCode).json({
        status: 'error',
        code: err.code || statusCode || 'UNKNOWN_ERROR',
        message:
            statusCode >= 500 && process.env.NODE_ENV === 'production'
                ? 'An unexpected server error occurred. Please try again later.'
                : err.message || 'Internal Server Error',
        // Only include the stack trace in non-production environments
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
};

export default errorHandler;

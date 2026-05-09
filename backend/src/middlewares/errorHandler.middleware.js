/**
 * Centralized error handling middleware.
 */
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

    // Logging...
    if (statusCode >= 500) {
        console.error(`[Error Boundary] ${err.stack}`);
    } else {
        console.warn(`[${statusCode}] ${err.message}`);
    }

    // Helper to safely serialize objects with potential circular references
    const getCircularReplacer = () => {
        const seen = new WeakSet();
        return (key, value) => {
            if (typeof value === "object" && value !== null) {
                if (seen.has(value)) {
                    return "[Circular Reference]";
                }
                seen.add(value);
            }
            return value;
        };
    };

    const errorResponse = {
        success: false,
        status: 'error',
        code: err.code || statusCode || 'UNKNOWN_ERROR',
        message: err.message || 'Internal Server Error',
        ...(err.data !== undefined && { data: err.data }),
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    };

    try {
        // Use the circular replacer to prevent "cyclic object value" crashes
        const safeJson = JSON.stringify(errorResponse, getCircularReplacer());
        res.status(statusCode).set('Content-Type', 'application/json').send(safeJson);
    } catch (serializeErr) {
        console.error(`[Fatal] Even safe serialization failed: ${serializeErr.message}`);
        res.status(statusCode).send('Critical Server Error: Circular data detected in error reporting.');
    }
};

export default errorHandler;

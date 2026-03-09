/**
 * Simple wrapper to eliminate try-catch boilerplate in express controllers
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;

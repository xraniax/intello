const validate = (schema) => (req, res, next) => {
    try {
        req.body = schema.parse(req.body);
        next();
    } catch (error) {
        return res.status(400).json({
            status: 'error',
            message: 'Validation Error',
            errors: error.errors,
        });
    }
};

export default validate;

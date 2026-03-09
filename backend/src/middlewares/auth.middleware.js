import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            if (!process.env.JWT_SECRET) {
                throw new Error('FATAL ERROR: JWT_SECRET is not defined.');
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = await User.findById(decoded.id);

            if (!req.user) {
                return res.status(401).json({ status: 'error', message: 'User not found' });
            }

            return next();
        } catch (error) {
            return res.status(401).json({ status: 'error', message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ status: 'error', message: 'Not authorized, no token' });
    }
};

export { protect };

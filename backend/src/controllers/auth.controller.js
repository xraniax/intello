import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
        expiresIn: '30d',
    });
};

class AuthController {
    static async register(req, res, next) {
        try {
            const { email, password, name } = req.body;

            const userExists = await User.findByEmail(email);
            if (userExists) {
                return res.status(400).json({ status: 'error', message: 'User already exists' });
            }

            const user = await User.create(email, password, name);

            res.status(201).json({
                status: 'success',
                data: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    token: generateToken(user.id),
                },
            });
        } catch (error) {
            next(error);
        }
    }

    static async login(req, res, next) {
        try {
            const { email, password } = req.body;

            const user = await User.findByEmail(email);
            if (user && (await User.comparePassword(password, user.password_hash))) {
                res.json({
                    status: 'success',
                    data: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        token: generateToken(user.id),
                    },
                });
            } else {
                res.status(401).json({ status: 'error', message: 'Invalid email or password' });
            }
        } catch (error) {
            next(error);
        }
    }

    static async getMe(req, res, next) {
        try {
            const user = await User.findById(req.user.id);
            res.json({
                status: 'success',
                data: user,
            });
        } catch (error) {
            next(error);
        }
    }
}

export default AuthController;

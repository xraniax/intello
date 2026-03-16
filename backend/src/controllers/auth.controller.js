import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import asyncHandler from '../utils/asyncHandler.js';

const generateToken = (id) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('FATAL ERROR: JWT_SECRET is not defined.');
    }
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

class AuthController {
    static register = asyncHandler(async (req, res) => {
        const { email, password, name } = req.body;

        const userExists = await User.findByEmail(email);
        if (userExists) {
            res.status(409);
            throw new Error('An account with that email already exists.');
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
    });

    static login = asyncHandler(async (req, res) => {
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
            res.status(401);
            throw new Error('Invalid email or password');
        }
    });

    static getMe = asyncHandler(async (req, res) => {
        const user = await User.findById(req.user.id);
        res.json({
            status: 'success',
            data: user,
        });
    });

    /**
     * Successful social auth callback.
     * Generates a token and redirects back to frontend with the token.
     */
    static socialAuthCallback = asyncHandler(async (req, res) => {
        if (!req.user) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
        }

        const user = req.user;
        const token = generateToken(user.id);

        // Redirect to frontend with token in URL (Login.jsx will handle it)
        const redirectUrl = `${process.env.FRONTEND_URL}/login?token=${token}`;
        res.redirect(redirectUrl);
    });
}

export default AuthController;

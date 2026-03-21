import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendEmail from '../utils/services/email.service.js';

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
            res.status(400);
            throw new Error('Email already registered');
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

        // Redirect to frontend dashboard with token in URL
        const redirectUrl = `${process.env.FRONTEND_URL}/dashboard?token=${token}`;
        res.redirect(redirectUrl);
    });

    static forgotPassword = asyncHandler(async (req, res) => {
        const { email } = req.body;
        const user = await User.findByEmail(email);

        // Requirement: Return generic success message even if email is not registered
        const genericSuccess = {
            status: 'success',
            message: 'If an account exists with that email, a reset link has been sent.',
        };

        if (!user) {
            return res.status(200).json(genericSuccess);
        }

        const resetToken = await User.createResetToken(user.id);
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        const message = `You are receiving this email because you (or someone else) have requested the reset of a password. Please use the following link to reset your password: \n\n ${resetUrl}`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Password Reset Token (Valid for 30 minutes)',
                message,
            });

            res.status(200).json({
                status: 'success',
                message: 'If an account exists with that email, a reset link has been sent.',
            });
        } catch (error) {
            // If email fails, clear the reset fields
            await User.clearResetToken(user.id);
            res.status(500);
            throw new Error('Email could not be sent. Please try again later.');
        }
    });

    /**
     * GET /auth/reset-password/:token
     * Validates a password reset token without changing any data.
     */
    static validateResetToken = asyncHandler(async (req, res) => {
        const { token } = req.params;
        const user = await User.findByResetToken(token);

        if (!user) {
            res.status(400);
            return res.json({
                status: 'error',
                message: 'Token is invalid or has expired.',
                valid: false,
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Token is valid.',
            valid: true,
        });
    });

    /**
     * POST /auth/reset-password
     * Resets password using a token and new password in request body.
     */
    static resetPassword = asyncHandler(async (req, res) => {
        const { password, token } = req.body;

        const user = await User.findByResetToken(token);

        if (!user) {
            console.warn(`[ResetPassword] Failed attempt with token: ${token?.substring(0, 8)}...`);
            res.status(400);
            throw new Error('Token is invalid or has expired.');
        }

        await User.updatePassword(user.id, password);
        console.log(`[ResetPassword] Successfully updated password for user: ${user.id}`);

        res.status(200).json({
            status: 'success',
            message: 'Password reset successful. You can now log in.',
        });
    });
}

export default AuthController;

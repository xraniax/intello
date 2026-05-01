import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/user.model.js';
import LoginAttempt from '../models/login_attempt.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendEmail from '../utils/services/email.service.js';
import SettingsService from '../services/settings.service.js';
import { normalizeStatus } from '../constants/status.enum.js';

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
        console.log(`[AUTH] Registration attempt for email: ${email}`);

        // Check if public registration is allowed
        const controls = await SettingsService.getStorageControls();
        if (controls.allow_public_registration === false) {
            console.warn(`[AUTH] Registration blocked: Public registration is disabled.`);
            res.status(403);
            throw new Error('Public registration is currently disabled. Please contact an administrator.');
        }

        const userExists = await User.findByEmail(email);
        if (userExists) {
            console.warn(`[AUTH] Registration failed: Email already registered: ${email}`);
            res.status(400);
            throw new Error('Email already registered');
        }

        const user = await User.create(email, password, name);
        console.log(`[AUTH] Registration successful for email: ${email}, id: ${user.id}`);

        const firstName = user.name.split(' ')[0];
        const welcomeMessage = `Hi ${firstName},

Welcome to **Cognify** <3

We’re excited to have you join our learning community.

Your account has been successfully created, and your personalized learning space is now ready. From here, you can:

• Access your courses and learning materials
• Take quizzes, review flashcards, explore summaries, and complete mock exams while tracking your progress
• Interact with AI-powered learning tools
• Stay organized with a workspace built for focus and growth

At Cognify, learning is designed to feel **engaging, intelligent, and enjoyable** — helping you build skills at your own pace.

Your account details:
**Email:** ${user.email}
**Role:** ${user.role}

If you ever need help, our team is here to support you.

We’re glad you’re here,
**The Cognify Team**

*Learn smarter. Grow confidently.* 🌱`;
        sendEmail({
            email: user.email,
            subject: 'Welcome to Cognify <3',
            message: welcomeMessage
        }).catch(err => console.error('[AUTH] Failed to send welcome email:', err.message));

        res.status(201).json({
            status: 'success',
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                token: generateToken(user.id),
            },
        });
    });

    static login = asyncHandler(async (req, res) => {
        const { email, password } = req.body;
        console.log(`[AUTH] Login attempt for email: ${email}`);
        
        const ip_address = req.ip || req.connection?.remoteAddress || '127.0.0.1';
        const user_agent = req.headers['user-agent'] || 'Unknown Browser';
        const user_agent_hash = crypto.createHash('sha256').update(user_agent).digest('hex');

        // Check if this connection tuple is strictly locked (e.g. 5 failures within 15 min window)
        const attemptState = await LoginAttempt.checkStatus(email, ip_address, user_agent_hash);
        if (attemptState && attemptState.locked_until && new Date(attemptState.locked_until) > new Date()) {
            console.warn(`[AUTH] Login blocked: Tuple locked for email: ${email}`);
            res.status(401);
            throw new Error('Invalid email or password');
        }

        const handleFailedLogin = async (userObj) => {
            const record = await LoginAttempt.trackFailure(email, ip_address, user_agent_hash, user_agent);
            
            if (record.attempt_count >= 5) {
                await LoginAttempt.lockTuple(email, ip_address, user_agent_hash);
                console.warn(`[AUTH] Tuple locked for email: ${email} from IP: ${ip_address} due to 5 failures.`);
            } else if (record.attempt_count === 3 && userObj) {
                // Determine if we should send an email based on cooldown
                const alertSentAt = record.last_security_alert_sent_at ? new Date(record.last_security_alert_sent_at) : null;
                const cooldownPassed = !alertSentAt || (new Date() - alertSentAt > 15 * 60 * 1000);
                
                if (cooldownPassed) {
                    const firstName = userObj.name.split(' ')[0];
                    const time = new Date().toUTCString();
                    const resetUrl = `${process.env.FRONTEND_URL}/login`; // Force them to review account / reset via forgot password if needed
                    
                    const message = `Hi ${firstName},

We detected **multiple unsuccessful attempts** to sign in to your **Cognify** account.

For your security, we wanted to let you know in case this activity was not you.

**Attempt details:**
• Email: ${email}
• Time: ${time}
• Device / Browser: ${user_agent}
• Location: IP ${ip_address}

### If this was you

No action is needed — you can simply try signing in again or reset your password if needed.

### If this was NOT you

We strongly recommend that you secure your account immediately by resetting your password.
Review account activity by visiting:
${resetUrl}

As an extra precaution, please make sure:
• Your password is unique to Cognify
• You do not share your login credentials
• Your device is secure

Your account security matters to us.

Stay safe,
**The Cognify Team**

*Smart learning starts with secure learning.* 🔐`;

                    await sendEmail({
                        email: userObj.email,
                        subject: 'Security Alert: Failed Login Attempts',
                        message
                    }).catch(err => console.error('[AUTH] Failed to send security email:', err.message));
                    
                    await LoginAttempt.markAlertSent(email, ip_address, user_agent_hash);
                }
            }
        };

        const user = await User.findByEmail(email);
        if (!user) {
            console.warn(`[AUTH] Login failed: User not found for email: ${email}`);
            await handleFailedLogin(null);
            res.status(401);
            throw new Error('Invalid email or password'); // Generic message
        }

        console.log(`[AUTH] User found: ${user.id}, status: ${user.status}, provider: ${user.auth_provider}`);

        const isMatch = await User.comparePassword(password, user.password_hash);
        if (!isMatch) {
            console.warn(`[AUTH] Login failed: Password mismatch for email: ${email}`);
            await handleFailedLogin(user);
            res.status(401);
            throw new Error('Invalid email or password'); // Generic message
        }

        if (normalizeStatus(user.status) !== 'ACTIVE') {
            console.warn(`[AUTH] Login failed: Account ${user.status} for email: ${email}`);
            res.status(403);
            const errorMessage = normalizeStatus(user.status) === 'SUSPENDED'
                ? 'Your account has been suspended. Please contact support.'
                : 'Your account is currently inactive. Please contact support.';
            throw new Error(errorMessage);
        }

        console.log(`[AUTH] Login successful for email: ${email}`);
        
        // Update login and activity timestamps
        User.updateLastLogin(user.id).catch(err => console.error('[AUTH] Failed to update login timestamp:', err.message));
        
        // Success clears the tracking tuple entirely
        await LoginAttempt.clearTuple(email, ip_address, user_agent_hash);

        res.json({
            status: 'success',
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                token: generateToken(user.id),
            },
        });
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
        console.log('[AUTH] Social Auth Callback reached');
        if (!req.user) {
            console.warn('[AUTH] Social Auth failed: No user profile in request');
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
        }

        const user = req.user;
        console.log(`[AUTH] Social Auth profile: ${user.email}, provider: ${user.auth_provider}, status: ${user.status}`);

        if (normalizeStatus(user.status) !== 'ACTIVE') {
            console.warn(`[AUTH] Social Auth failed: Account ${user.status} for email: ${user.email}`);
            const errorType = normalizeStatus(user.status) === 'SUSPENDED' ? 'account_suspended' : 'account_inactive';
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=${errorType}`);
        }

        const token = generateToken(user.id);
        console.log(`[AUTH] Social Auth successful, redirecting user: ${user.id}`);

        if (user.isNewRecord) {
            const firstName = user.name.split(' ')[0];
            const welcomeMessage = `Hi ${firstName},

Welcome to **Cognify** ✨

We’re excited to have you join our learning community.

Your account has been successfully created, and your personalized learning space is now ready. From here, you can:

• Access your courses and learning materials
• Take quizzes, review flashcards, explore summaries, and complete mock exams while tracking your progress
• Interact with AI-powered learning tools
• Stay organized with a workspace built for focus and growth

At Cognify, learning is designed to feel **engaging, intelligent, and enjoyable** — helping you build skills at your own pace.

Your account details:
**Email:** ${user.email}
**Role:** ${user.role}

If you ever need help, our team is here to support you.

We’re glad you’re here,
**The Cognify Team**

*Learn smarter. Grow confidently.* 🌱`;
            sendEmail({
                email: user.email,
                subject: 'Welcome to Cognify ✨',
                message: welcomeMessage
            }).catch(err => console.error('[AUTH] Failed to send welcome email:', err.message));
        }

        // Update login and activity timestamps (fire and forget)
        User.updateLastLogin(user.id).catch(err => console.error('[AUTH] Failed to update login timestamp:', err.message));

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

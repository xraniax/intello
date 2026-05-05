import express from 'express';
import passport from 'passport';
import AuthController from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimiter.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../middlewares/auth.validator.js';

const router = express.Router();
const googleOAuthEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const githubOAuthEnabled = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

router.post('/register', validate(registerSchema), AuthController.register);
router.post('/verify-email', protect, AuthController.verifyEmail);
router.post('/resend-verification', protect, AuthController.resendOTP);
router.post('/login', authLimiter, validate(loginSchema), AuthController.login);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), AuthController.forgotPassword);
router.get('/reset-password/:token', authLimiter, AuthController.validateResetToken);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), AuthController.resetPassword);
router.get('/me', protect, AuthController.getMe);

// --- Google OAuth ---
if (googleOAuthEnabled) {
  router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  router.get('/google/callback',
    passport.authenticate('google', {
      failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed`,
      session: false
    }),
    AuthController.socialAuthCallback
  );
} else {
  router.get('/google', (_req, res) => {
    res.status(503).json({
      status: 'error',
      code: 'OAUTH_GOOGLE_DISABLED',
      message: 'Google OAuth is not configured for this environment.'
    });
  });

  router.get('/google/callback', (_req, res) => {
    res.status(503).json({
      status: 'error',
      code: 'OAUTH_GOOGLE_DISABLED',
      message: 'Google OAuth is not configured for this environment.'
    });
  });
}

// --- GitHub OAuth ---
if (githubOAuthEnabled) {
  router.get('/github',
    passport.authenticate('github', { scope: ['user:email'] })
  );

  router.get('/github/callback',
    passport.authenticate('github', {
      failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed`,
      session: false
    }),
    AuthController.socialAuthCallback
  );
} else {
  router.get('/github', (_req, res) => {
    res.status(503).json({
      status: 'error',
      code: 'OAUTH_GITHUB_DISABLED',
      message: 'GitHub OAuth is not configured for this environment.'
    });
  });

  router.get('/github/callback', (_req, res) => {
    res.status(503).json({
      status: 'error',
      code: 'OAUTH_GITHUB_DISABLED',
      message: 'GitHub OAuth is not configured for this environment.'
    });
  });
}

export default router;

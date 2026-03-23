import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import passport from './utils/config/passport.js';
import session from 'express-session';
import errorHandler from './middlewares/errorHandler.middleware.js';
import { apiLimiter } from './middlewares/rateLimiter.middleware.js';

dotenv.config();

const app = express();

// Middlewares
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://frontend:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'cognify-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using https
        maxAge: 10 * 60 * 1000 // 10 minutes session for OAuth flow
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// Apply rate limiter to all api routes
app.use('/api/', apiLimiter);

// Static files (for uploads)
app.use('/uploads', express.static('uploads'));

// Routes
import authRoutes from './routes/auth.routes.js';
import materialRoutes from './routes/material.routes.js';
import subjectRoutes from './routes/subject.routes.js';
import AuthController from './controllers/auth.controller.js';

// Root-level OAuth routes (Direct backend callback support)
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/google/callback', 
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    AuthController.socialAuthCallback
);

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
app.get('/google/callback/github', // Keeping GitHub callback separate if needed, or follow same root pattern
    passport.authenticate('github', { session: false, failureRedirect: '/login' }),
    AuthController.socialAuthCallback
);

app.use('/api/auth', authRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/subjects', subjectRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Cognify Backend API', version: '1.0.0', endpoints: { auth: '/api/auth', materials: '/api/materials', subjects: '/api/subjects', health: '/health' } });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Cognify Backend is healthy' });
});

// Error handling
app.use(errorHandler);

export default app;

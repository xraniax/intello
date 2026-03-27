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
  origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://127.0.0.1:3000'],
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
import adminRoutes from './routes/admin.routes.js';
import profileRoutes from './routes/profile.routes.js';

app.use('/api/auth', authRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Cognify Backend is healthy' });
});

// Error handling
app.use(errorHandler);

export default app;

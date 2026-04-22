import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import passport from './utils/config/passport.js';
import session from 'express-session';
import errorHandler from './middlewares/errorHandler.middleware.js';
import { apiLimiter } from './middlewares/rateLimiter.middleware.js';

dotenv.config();

const app = express();
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const uploadStoragePath = process.env.PDF_STORAGE_PATH || 'uploads';
const normalizedUploadPath = path.isAbsolute(uploadStoragePath)
  ? uploadStoragePath
  : path.resolve(uploadStoragePath);

// Middlewares
app.use(cors({
  origin: [frontendUrl, 'http://127.0.0.1:3000', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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
app.use('/uploads', express.static(normalizedUploadPath));
// Backward-compatibility: older records may store absolute container paths.
app.use('/app/data/uploads', express.static(normalizedUploadPath));

// Routes
import authRoutes from './routes/auth.routes.js';
import materialRoutes from './routes/material.routes.js';
import subjectRoutes from './routes/subject.routes.js';
import adminRoutes from './routes/admin.routes.js';
import profileRoutes from './routes/profile.routes.js';
import examRoutes from './routes/exam.routes.js';

app.use('/api/auth', authRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/exams', examRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Cognify Backend API', version: '1.0.0', endpoints: { auth: '/api/auth', materials: '/api/materials', subjects: '/api/subjects', health: '/health' } });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Cognify Backend is healthy' });
});

// Error handling
app.use(errorHandler);

export default app;

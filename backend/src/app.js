import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import passport from './utils/config/passport.js';
import session from 'express-session';
import errorHandler from './middlewares/errorHandler.middleware.js';
import { apiLimiter } from './middlewares/rateLimiter.middleware.js';
import helmetConfig from './middlewares/helmet.middleware.js';
import {
    xssDetection,
    sqlInjectionDetection,
    sanitizeRequest,
    additionalSecurityHeaders,
    rateLimitBypassDetection
} from './middlewares/security.middleware.js';
import fs from 'fs';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const app = express();
app.set('trust proxy', 1); // Enable trust proxy for absolute URL generation in Passport
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const uploadStoragePath = process.env.PDF_STORAGE_PATH || 'uploads';
const normalizedUploadPath = path.isAbsolute(uploadStoragePath)
  ? uploadStoragePath
  : path.resolve(uploadStoragePath);

// Security middleware - must be before other middleware
app.use(helmetConfig);

// Middlewares
app.use(cors({
  origin: isProduction 
    ? [frontendUrl, 'http://127.0.0.1:3000', 'http://localhost:3000']
    : true, // Allow all origins in development for troubleshooting
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(session({
  // SESSION_SECRET must be set in production - strong random string (32+ chars)
  // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  secret: process.env.SESSION_SECRET || (isProduction ? null : 'dev-session-secret-not-for-production'),
  resave: false,
  // Don't save uninitialized sessions (reduces session store bloat, security best practice)
  // OAuth state is explicitly set during OAuth flow, so this works fine
  saveUninitialized: false,
  cookie: {
    // httpOnly: prevents XSS from stealing session cookie via JavaScript
    httpOnly: true,
    // secure: true in production (requires HTTPS), false in dev for localhost
    // Google OAuth requires secure cookies in production
    secure: isProduction,
    // sameSite: 'lax' - allows OAuth redirects (cross-origin GET) but blocks CSRF on POSTs
    // strict would break OAuth; none would require secure:true and reduce security
    sameSite: 'lax',
    // 10 minutes maxAge for OAuth flow - short-lived for security
    // OAuth sessions should be brief; JWT handles long-term auth
    maxAge: 10 * 60 * 1000
  },
  name: 'cognify.session.id' // Custom session name (security through obscurity, minor)
}));
app.use(passport.initialize());
app.use(passport.session());

// Additional security middleware (XSS detection, input sanitization, security headers)
app.use(rateLimitBypassDetection);
app.use(xssDetection);
app.use(sqlInjectionDetection);
app.use(sanitizeRequest);
app.use(additionalSecurityHeaders);

// Apply rate limiter to all api routes
app.use('/api/', apiLimiter);

// Static files (for uploads)
// Remove frame-blocking headers so PDFs and images can be previewed in browser tabs/iframes.
// The global Helmet sets these headers for all routes; we explicitly unset them here only.
// All other security headers (noSniff, HSTS, XSS filter, etc.) remain active.
const relaxFramingHeaders = (req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.removeHeader('Content-Security-Policy');
  next();
};

/**
 * Comprehensive logging middleware for file access attempts.
 * Logs requested URL, resolved filesystem path, file existence, size, and authorization.
 */
const fileAccessLogger = (req, res, next) => {
  const requestedUrl = req.originalUrl;
  const requestedPath = req.path;
  
  // Extract filename from request path (e.g., /uploads/1777475471119-320681748.pdf -> 1777475471119-320681748.pdf)
  const filename = requestedPath.split('/').pop();
  
  // Resolve the full filesystem path
  const resolvedPath = path.resolve(normalizedUploadPath, filename);
  
  // Check file existence and size
  const exists = fs.existsSync(resolvedPath);
  let fileSize = 'N/A';
  let fileSizeBytes = 0;
  if (exists) {
    try {
      const stats = fs.statSync(resolvedPath);
      fileSizeBytes = stats.size;
      fileSize = `${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size} bytes)`;
    } catch (err) {
      fileSize = `Error reading: ${err.message}`;
    }
  }
  
  // Log the access attempt
  console.log(`
[FileAccessLog] ${new Date().toISOString()}
  Requested URL: ${requestedUrl}
  Requested Path: ${requestedPath}
  Filename: ${filename}
  Upload Storage Path (env): ${uploadStoragePath}
  Normalized Upload Path: ${normalizedUploadPath}
  Resolved Filesystem Path: ${resolvedPath}
  File Exists (fs.existsSync): ${exists}
  File Size: ${fileSize}
  User: ${req.user?.id || 'anonymous'}
  Auth Status: ${req.isAuthenticated ? 'authenticated' : 'not authenticated'}
`);
  
  // Store in request object for later use if needed
  req.fileAccessInfo = {
    requestedUrl,
    resolvedPath,
    exists,
    fileSizeBytes,
    filename
  };
  
  next();
};

app.use('/uploads', fileAccessLogger, relaxFramingHeaders, express.static(normalizedUploadPath));
// Backward-compatibility: older records may store absolute container paths.
app.use('/app/data/uploads', fileAccessLogger, relaxFramingHeaders, express.static(normalizedUploadPath));

// Routes
import authRoutes from './routes/auth.routes.js';
import materialRoutes from './routes/material.routes.js';
import subjectRoutes from './routes/subject.routes.js';
import adminRoutes from './routes/admin.routes.js';
import profileRoutes from './routes/profile.routes.js';
import examRoutes from './routes/exam.routes.js';
import quizRoutes from './routes/quiz.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import chatRoutes from './routes/chat.routes.js';
import goalRoutes from './routes/goal.routes.js';
import fileRoutes from './routes/file.routes.js';

app.use('/api/auth', authRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/goals', goalRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Cognify Backend API', version: '1.0.0', endpoints: { auth: '/api/auth', materials: '/api/materials', subjects: '/api/subjects', health: '/health' } });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Cognify Backend is healthy' });
});

// Error handling
app.use(errorHandler);

export default app;

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import errorHandler from './middlewares/errorHandler.middleware.js';

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

// Static files (for uploads)
app.use('/uploads', express.static('storage'));

// Routes
import authRoutes from './routes/auth.routes.js';
import materialRoutes from './routes/material.routes.js';

app.use('/api/auth', authRoutes);
app.use('/api/materials', materialRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Cognify Backend is healthy' });
});

// Error handling
app.use(errorHandler);

export default app;

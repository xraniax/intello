import express from 'express';
import ChatController from '../controllers/chat.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { aiLimiter } from '../middlewares/rateLimiter.middleware.js';

const router = express.Router();

// All chat routes are protected and rate-limited
// The endpoint is mounted at /api/chat in app.js
router.post('/', protect, aiLimiter, ChatController.proxyChat);

export default router;

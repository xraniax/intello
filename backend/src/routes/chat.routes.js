import express from 'express';
import ChatController from '../controllers/chat.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { aiLimiter } from '../middlewares/rateLimiter.middleware.js';

const router = express.Router();

// All chat routes require authentication
router.use(protect);

// Standard (non-streaming) chat — kept for backward compatibility
router.post('/', aiLimiter, ChatController.proxyChat);

// Streaming chat (SSE)
router.post('/stream', aiLimiter, ChatController.streamChat);

// Session CRUD
router.get('/sessions', ChatController.getSessions);
router.post('/sessions', ChatController.createSession);
router.patch('/sessions/:id', ChatController.renameSession);
router.delete('/sessions/:id', ChatController.deleteSession);

// Session messages
router.get('/sessions/:id/messages', ChatController.getMessages);

// Per-message actions
router.patch('/messages/:id/feedback', ChatController.updateFeedback);
router.patch('/messages/:id/bookmark', ChatController.updateBookmark);
router.get('/bookmarks', ChatController.getBookmarks);

export default router;

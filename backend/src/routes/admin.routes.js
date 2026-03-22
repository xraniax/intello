import express from 'express';
import AdminController from '../controllers/admin.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * All admin routes require authentication and admin privileges
 */
router.use(protect);
router.use(adminOnly);

// User Management
router.get('/users', AdminController.getUsers);
router.patch('/users/:userId/status', AdminController.updateStatus);
router.patch('/users/:userId/role', AdminController.updateRole);
router.patch('/users/:userId/storage-limit', AdminController.updateStorageLimit);
router.delete('/users/:id', AdminController.deleteUser);

// File Management
router.get('/files', AdminController.getAllFiles);
router.delete('/files/:id', AdminController.deleteFile);

// System Settings
router.get('/settings', AdminController.getSettings);
router.patch('/settings', AdminController.updateSettings);

// Audit Logs
router.get('/logs', AdminController.getLogs);

export default router;

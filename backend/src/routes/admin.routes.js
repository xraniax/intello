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
router.get('/files/:id/download', AdminController.downloadFile);
router.delete('/files/:id', AdminController.deleteFile);

// System Settings & Maintenance
router.get('/settings', AdminController.getSettings);
router.put('/settings', AdminController.updateSettings);
router.get('/quota-impact', AdminController.getQuotaImpact);
router.put('/users/:userId/storage-limit', AdminController.updateStorageLimit);
router.post('/storage/cleanup', AdminController.cleanupStorage);

// Audit Logs
router.get('/logs', AdminController.getLogs);

// Incident Alerts
router.get('/alerts', AdminController.getAlerts);
router.get('/alerts/stats', AdminController.getAlertStats);
router.patch('/alerts/:id/resolve', AdminController.resolveAlert);
router.delete('/alerts/:id', AdminController.deleteAlert);

export default router;

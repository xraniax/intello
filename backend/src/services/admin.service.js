import User from '../models/user.model.js';
import File from '../models/file.model.js';
import Log from '../models/log.model.js';
import SettingsService from './settings.service.js';
import QuotaService from './quota.service.js';
import { query } from '../utils/config/db.js';
import fs from 'fs';
import { performStorageCleanup } from '../utils/cleanup.util.js';

class AdminService {
    /**
     * Get all users with stats
     */
    static async getAllUsers(filters = {}) {
        return await User.findAll(filters);
    }

    /**
     * Suspend or activate a user
     */
    static async updateUserStatus(adminId, targetUserId, status, reason = '') {
        const normalizedStatus = status.toUpperCase();
        const updatedUser = await User.adminUpdate(targetUserId, { status: normalizedStatus });
        
        await this.logAction(adminId, 'UPDATE_STATUS', 'users', targetUserId, {
            status: normalizedStatus,
            reason
        });

        return updatedUser;
    }

    /**
     * Promote a user to a new role
     */
    static async updateUserRole(adminId, targetUserId, role) {
        const updatedUser = await User.adminUpdate(targetUserId, { role });
        
        await this.logAction(adminId, 'UPDATE_ROLE', 'users', targetUserId, { role });

        return updatedUser;
    }

    /**
     * Update user-specific storage limit
     */
    static async updateUserStorageLimit(adminId, targetUserId, limitBytes) {
        const updatedUser = await User.adminUpdate(targetUserId, { storage_limit_bytes: limitBytes });
        await this.logAction(adminId, 'UPDATE_STORAGE_LIMIT', 'users', targetUserId, { limit_bytes: limitBytes });
        return updatedUser;
    }

    /**
     * Permanently delete a user
     */
    static async deleteUser(adminId, targetUserId) {
        // Prevent self-deletion
        if (adminId === targetUserId) {
            throw new Error('Admins cannot delete their own accounts.');
        }

        const success = await User.delete(targetUserId);
        
        if (success) {
            await this.logAction(adminId, 'DELETE_USER', 'users', targetUserId, { deleted: true });
        }

        return success;
    }

    /**
     * Get all files for management
     */
    static async getAllFiles(filters = {}) {
        return await File.findAll(filters);
    }

    /**
     * Administrative file deletion
     */
    static async deleteFile(adminId, fileId) {
        const file = await File.findById(fileId);
        if (!file) throw new Error('File not found');

        // Delete physical file
        try {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        } catch (err) {
            console.warn(`[AdminService] Physical file deletion failed: ${file.path}`, err.message);
        }

        const success = await File.delete(fileId);
        if (success) {
            await this.logAction(adminId, 'DELETE_FILE', 'files', fileId, { original_name: file.original_name });
        }
        return success;
    }

    /**
     * System Settings Management
     */
    static async getSettings() {
        const globalStats = await QuotaService.getGlobalStorageStats();

        return {
            storage: await SettingsService.getStorageControls(),
            stats: {
                total_storage_bytes: globalStats.totalUsedBytes
            }
        };
    }

    static async updateSettings(adminId, settings) {
        if (settings.storage) {
            await SettingsService.update('storage_controls', settings.storage);
            await this.logAction(adminId, 'UPDATE_SETTINGS', 'system', 'global', { storage: settings.storage });
        }
        return await this.getSettings();
    }

    /**
     * Record an administrative action in the audit log
     */
    static async logAction(adminId, action, targetType, targetId, details) {
        await Log.create(adminId, action, targetType, targetId, details);
    }

    /**
     * Get audit logs for the admin panel
     */
    static async getAdminLogs(filters = {}) {
        return await Log.findAll(filters);
    }

    /**
     * Run system-wide storage cleanup
     */
    static async cleanupStorage(adminId) {
        const stats = await performStorageCleanup();
        
        await this.logAction(adminId, 'STORAGE_CLEANUP', 'system', 'storage', {
            orphans_deleted: stats.orphansDeleted,
            space_freed_bytes: stats.spaceFreedBytes,
            broken_links_found: stats.brokenLinksFound
        });

        return stats;
    }
}

export default AdminService;

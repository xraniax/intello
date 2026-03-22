import User from '../models/user.model.js';
import File from '../models/file.model.js';
import SettingsService from './settings.service.js';
import { query } from '../utils/config/db.js';
import fs from 'fs';

class AdminService {
    /**
     * Get all users with stats
     */
    static async getAllUsers() {
        return await User.findAll();
    }

    /**
     * Suspend or activate a user
     */
    static async updateUserStatus(adminId, targetUserId, status, reason = '') {
        const updatedUser = await User.adminUpdate(targetUserId, { status });
        
        await this.logAction(adminId, 'UPDATE_STATUS', 'users', targetUserId, {
            status,
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
        await this.logAction(adminId, 'UPDATE_STORAGE_LIMIT', 'users', targetUserId, { limitBytes });
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
        const result = await query('SELECT COALESCE(SUM(size_bytes), 0)::bigint as total_bytes FROM files');
        const totalStorageBytes = result.rows[0].total_bytes;

        return {
            storage: await SettingsService.getStorageControls(),
            stats: {
                total_storage_bytes: totalStorageBytes
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
        await query(
            'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
            [adminId, action, targetType, targetId, JSON.stringify(details)]
        );
    }

    /**
     * Get audit logs for the admin panel
     */
    static async getAdminLogs() {
        const result = await query(
            `SELECT l.*, u.name as admin_name, u.email as admin_email
             FROM admin_logs l
             JOIN users u ON l.admin_id = u.id
             ORDER BY l.created_at DESC
             LIMIT 100`
        );
        return result.rows;
    }
}

export default AdminService;

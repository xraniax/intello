import { query } from '../utils/config/db.js';
import SettingsService from './settings.service.js';
import User from '../models/user.model.js';

class QuotaService {
    /**
     * Get detailed storage usage stats for a user.
     * Excludes files linked to materials that are in 'FAILED' state.
     */
    static async getUserStorageStats(userId) {
        // Enforce UUID or handle nulls
        if (!userId) throw new Error('User ID is required for quota check.');

        const sql = `
            SELECT 
                (COALESCE((SELECT SUM(f.size_bytes) FROM files f WHERE f.user_id = u.id), 0) +
                 COALESCE((SELECT SUM(OCTET_LENGTH(COALESCE(m.content, ''))) FROM materials m WHERE m.user_id = u.id AND UPPER(m.status) != 'FAILED'), 0))::bigint as used_bytes,
                u.storage_limit_bytes,
                u.status
            FROM users u
            WHERE u.id = $1
            GROUP BY u.id, u.storage_limit_bytes, u.status
        `;
        
        const result = await query(sql, [userId]);
        
        if (result.rows.length === 0) {
            // User might exist but haven't uploaded anything
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found.');
            
            const controls = await SettingsService.getStorageControls();
            return {
                usedBytes: 0,
                limitBytes: user.storage_limit_bytes || (controls.default_user_quota_mb * 1024 * 1024),
                status: user.status || 'ACTIVE'
            };
        }

        const row = result.rows[0];
        const controls = await SettingsService.getStorageControls();
        const limitBytes = row.storage_limit_bytes || (controls.default_user_quota_mb * 1024 * 1024);

        return {
            usedBytes: parseInt(row.used_bytes),
            limitBytes: parseInt(limitBytes),
            status: row.status.toUpperCase()
        };
    }

    /**
     * Pre-upload check: Determine if an upload of size bytes is allowed.
     * Throws an error with a clear message if not allowed.
     */
    static async checkUploadAllowance(userId, incomingSizeBytes) {
        const stats = await this.getUserStorageStats(userId);

        // 1. Suspension Check
        if (stats.status === 'SUSPENDED') {
            const error = new Error('Upload blocked: your account has been suspended by an administrator.');
            error.statusCode = 403;
            error.code = 'ACCOUNT_SUSPENDED';
            throw error;
        }

        // 2. Capacity Check
        const remainingBytes = stats.limitBytes - stats.usedBytes;
        if (incomingSizeBytes > remainingBytes) {
            const incomingMb = (incomingSizeBytes / (1024 * 1024)).toFixed(2);
            const remainingMb = (remainingBytes / (1024 * 1024)).toFixed(2);
            const usedMb = (stats.usedBytes / (1024 * 1024)).toFixed(2);
            const limitMb = (stats.limitBytes / (1024 * 1024)).toFixed(2);

            const error = new Error(`Upload rejected: your file is ${incomingMb}MB but your remaining quota is ${remainingMb}MB (Used: ${usedMb}MB / Total: ${limitMb}MB).`);
            error.statusCode = 403;
            error.code = 'QUOTA_EXCEEDED';
            throw error;
        }

        return true;
    }

    /**
     * Admin helper: Reconcile/validate all users against a global threshold (optional audit).
     */
    static async getGlobalStorageStats() {
        const result = await query(`
            SELECT 
                (COALESCE((SELECT SUM(f.size_bytes) FROM files f), 0) +
                 COALESCE((SELECT SUM(OCTET_LENGTH(COALESCE(m.content, ''))) FROM materials m), 0))::bigint as total_used_bytes
        `);
        return {
            totalUsedBytes: parseInt(result.rows[0].total_used_bytes)
        };
    }
}

export default QuotaService;

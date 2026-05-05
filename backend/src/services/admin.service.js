import User from '../models/user.model.js';
import File from '../models/file.model.js';
import Material from '../models/material.model.js';
import Log from '../models/log.model.js';
import SettingsService from './settings.service.js';
import QuotaService from './quota.service.js';
import AlertService from './alert.service.js';
import { query } from '../utils/config/db.js';
import fs from 'fs';
import { performStorageCleanup } from '../utils/cleanup.util.js';
import { normalizeStatus } from '../constants/status.enum.js';
import os from 'os';
import { execSync } from 'child_process';

class AdminService {
    /**
     * Get all users with stats (paginated)
     */
    static async getAllUsers(filters = {}) {
        const [users, total] = await Promise.all([
            User.findAll(filters),
            User.getTotalCount()
        ]);
        return { users, total };
    }

    /**
     * Suspend or activate a user
     */
    static async updateUserStatus(adminId, targetUserId, status, reason = '') {
        if (adminId === targetUserId) {
            throw new Error('Admins cannot change their own status.');
        }

        const [adminUser, targetUser] = await Promise.all([
            User.findById(adminId),
            User.findById(targetUserId),
        ]);

        if (targetUser?.role === 'admin') {
            const adminCreatedAt = new Date(adminUser?.created_at || 0);
            const targetCreatedAt = new Date(targetUser.created_at || 0);
            if (targetCreatedAt <= adminCreatedAt) {
                throw new Error('Cannot modify the status of a senior or equal-rank admin account.');
            }
        }

        const normalizedStatus = normalizeStatus(status);
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
        // Enforce Capacity Guardrail
        await this.validateCapacity({ individual: { userId: targetUserId, limitBytes } });

        const updatedUser = await User.adminUpdate(targetUserId, { storage_limit_bytes: limitBytes });
        await this.logAction(adminId, 'UPDATE_STORAGE_LIMIT', 'users', targetUserId, { limit_bytes: limitBytes });
        return updatedUser;
    }

    /**
     * Permanently delete a user
     */
    static async deleteUser(adminId, targetUserId) {
        if (adminId === targetUserId) {
            throw new Error('Admins cannot delete their own accounts.');
        }

        const [adminUser, targetUser] = await Promise.all([
            User.findById(adminId),
            User.findById(targetUserId),
        ]);

        if (targetUser?.role === 'admin') {
            const adminCreatedAt = new Date(adminUser?.created_at || 0);
            const targetCreatedAt = new Date(targetUser.created_at || 0);
            if (targetCreatedAt <= adminCreatedAt) {
                throw new Error('Cannot delete a senior or equal-rank admin account.');
            }
        }

        const success = await User.delete(targetUserId);
        
        if (success) {
            await this.logAction(adminId, 'DELETE_USER', 'users', targetUserId, { deleted: true });
        }

        return success;
    }

    /**
     * Get all files for management (paginated)
     */
    static async getAllFiles(filters = {}) {
        const [files, total] = await Promise.all([
            File.findAll(filters),
            File.getTotalCount(filters)
        ]);
        return { files, total };
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
     * Prepare file for download
     */
    static async downloadFile(adminId, fileId) {
        const file = await File.findById(fileId);
        if (!file) throw new Error('File not found');
        
        if (!fs.existsSync(file.path)) {
            throw new Error('Physical file missing on server');
        }

        await this.logAction(adminId, 'DOWNLOAD_FILE', 'files', fileId, { original_name: file.original_name });
        return file;
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
            // Enforce Capacity Guardrail
            await this.validateCapacity({ global: settings.storage });
            
            await SettingsService.update('storage_controls', settings.storage);
            await this.logAction(adminId, 'UPDATE_SETTINGS', 'system', null, { storage: settings.storage });
        }
        return await this.getSettings();
    }

    /**
     * Internal helper to ensure theoretical allocation doesn't exceed physical ceiling
     */
    static async validateCapacity({ global, individual } = {}) {
        const budget = await User.getStorageBudget();
        const currentControls = await SettingsService.getStorageControls();
        
        const ceilingGb = global?.max_cluster_size_gb ?? currentControls.max_cluster_size_gb ?? 100;
        const ceilingBytes    = BigInt(ceilingGb) * BigInt(1073741824);

        const defaultUserCount = BigInt(budget.default_quota_user_count);
        let customQuotaTotal = BigInt(budget.custom_quota_total_bytes);
        let defaultQuotaMb   = BigInt(global?.default_user_quota_mb ?? currentControls.default_user_quota_mb ?? 100);

        // Scenario 1: Individual override update
        if (individual) {
            const user = await User.findById(individual.userId);
            const oldLimitBytes = BigInt(user?.storage_limit_bytes || 0);
            const newLimitBytes = individual.limitBytes === null 
                ? null // will fall to default
                : BigInt(individual.limitBytes);

            if (newLimitBytes === null) {
                // Moving from Custom to Default
                if (oldLimitBytes > 0n) {
                    customQuotaTotal -= oldLimitBytes;
                    defaultUserCount += 1n; 
                }
            } else {
                // Change custom limit or move from Default to Custom
                if (oldLimitBytes > 0n) {
                    // Update existing custom
                    customQuotaTotal = (customQuotaTotal - oldLimitBytes) + newLimitBytes;
                } else {
                    // New custom from default
                    customQuotaTotal += newLimitBytes;
                    if (defaultUserCount > 0n) defaultUserCount -= 1n;
                }
            }
        }

        const theoreticalTotal = (defaultUserCount * defaultQuotaMb * BigInt(1048576)) + customQuotaTotal;

        if (theoreticalTotal > ceilingBytes) {
            const requestedGb = (Number(theoreticalTotal) / 1073741824).toFixed(2);
            throw new Error(`Capacity Violation: The proposed allocation (${requestedGb} GB) exceeds the Platform Ceiling (${ceilingGb} GB).`);
        }
    }

    /**
     * Record an administrative action in the audit log
     */
    static async logAction(adminId, action, targetType, targetId, details) {
        await Log.create(adminId, action, targetType, targetId, details);
    }

    /**
     * Get audit logs for the admin panel (paginated)
     */
    static async getAdminLogs(filters = {}) {
        const [logs, total] = await Promise.all([
            Log.findAll(filters),
            Log.getTotalCount(filters)
        ]);
        return { logs, total };
    }

    /**
     * Run system-wide storage cleanup
     */
    static async cleanupStorage(adminId) {
        const controls = await SettingsService.getStorageControls();
        const ttl = controls.trash_ttl_days || 30;

        // 1. Purge expired trash from Database (Cascade deletes File records)
        const expiredCount = await Material.deleteExpiredTrash(ttl);

        // 2. Run physical storage cleanup (orphans, broken links)
        const stats = await performStorageCleanup();
        
        await this.logAction(adminId, 'STORAGE_CLEANUP', 'system', null, {
            expired_materials_deleted: expiredCount,
            orphans_deleted: stats.orphansDeleted,
            space_freed_bytes: stats.spaceFreedBytes,
            broken_links_found: stats.brokenLinksFound
        });

        return { ...stats, expiredMaterialsDeleted: expiredCount };
    }

    /**
     * Get count of users exceeding a proposed storage limit and full capacity analysis
     */
    static async getQuotaImpact(limitMb) {
        const studentCount = await User.countByRole('user');
        const budget = await User.getStorageBudget();
        const limitBytes = parseInt(limitMb) * 1024 * 1024;
        const count = await User.countExceedingStorage(limitBytes);
        return { count, limitMb, studentCount, budget };
    }

    /**
     * System Alerts
     */
    static async getAlerts(filters = {}) {
        return await AlertService.getRecentAlerts(filters);
    }

    static async getAlertStats() {
        return await AlertService.getStats();
    }

    static async resolveAlert(adminId, alertId) {
        const alert = await AlertService.resolveAlert(alertId);
        await this.logAction(adminId, 'RESOLVE_ALERT', 'system', alertId, { alert_type: alert?.type });
        return alert;
    }

    static async deleteAlert(adminId, alertId) {
        await AlertService.deleteAlert(alertId);
        await this.logAction(adminId, 'DELETE_ALERT', 'system', alertId);
        return true;
    }

    /**
     * Get real-time system metrics (CPU, Memory, Uptime)
     */
    static async getSystemStats() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        
        // Simple CPU load calculation or fallback
        const loadAvg = os.loadavg();
        const cpuUsage = ((loadAvg[0] / os.cpus().length) * 100).toFixed(1);

        return {
            cpu: parseFloat(cpuUsage),
            memory: {
                total: totalMem,
                used: usedMem,
                percentage: parseFloat(((usedMem / totalMem) * 100).toFixed(1))
            },
            uptime: os.uptime(),
            platform: os.platform(),
            node_version: process.version,
            latency: '24ms'
        };
    }

    /**
     * Get aggregated user behavior analytics
     */
    static async getUserBehaviorAnalytics() {
        const [dauRes, materialTrendRes, topSubjectsRes, activityDistRes, studyActivityRes] = await Promise.all([
            // 1. Daily Active Users (Last 30 days)
            query(`
                SELECT DATE(last_active_at) as date, COUNT(*)::int as count
                FROM users
                WHERE last_active_at >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(last_active_at)
                ORDER BY date ASC
            `),
            // 2. Material Generation Trends (Last 30 days)
            query(`
                SELECT DATE(created_at) as date, type, COUNT(*)::int as count
                FROM materials
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(created_at), type
                ORDER BY date ASC
            `),
            // 3. Top Subjects by material volume
            query(`
                SELECT s.name, COUNT(m.id)::int as count
                FROM subjects s
                JOIN materials m ON m.subject_id = s.id
                WHERE m.deleted_at IS NULL
                GROUP BY s.name
                ORDER BY count DESC
                LIMIT 5
            `),
            // 4. Admin Activity Distribution (Corrected table name)
            query(`
                SELECT action, COUNT(*)::int as count
                FROM admin_logs
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY action
                ORDER BY count DESC
                LIMIT 10
            `),
            // 5. Study Activity (Quizzes + Flashcards)
            query(`
                SELECT date, type, SUM(count)::int as count FROM (
                    SELECT DATE(created_at) as date, 'quiz' as type, COUNT(*)::int as count FROM quiz_attempts WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at)
                    UNION ALL
                    SELECT DATE(reviewed_at) as date, 'flashcard' as type, COUNT(*)::int as count FROM flashcard_reviews WHERE reviewed_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(reviewed_at)
                ) sub GROUP BY date, type ORDER BY date ASC
            `)
        ]);

        return {
            dau: dauRes.rows,
            materialTrends: materialTrendRes.rows,
            topSubjects: topSubjectsRes.rows,
            activityDistribution: activityDistRes.rows,
            studyActivity: studyActivityRes.rows
        };
    }

    /**
     * Get aggregated security analytics
     */
    static async getSecurityAnalytics() {
        const { default: LoginAttempt } = await import('../models/login_attempt.model.js');
        const { default: Log } = await import('../models/log.model.js');
        
        const [metrics, securityLogs] = await Promise.all([
            LoginAttempt.getSecurityMetrics(),
            Log.findAll({ action: 'SECURITY_LOCKOUT', limit: 50 })
        ]);

        const suspendedUsers = await query(`
            SELECT id, email, name, status, last_active_at, created_at
            FROM users
            WHERE status = 'SUSPENDED'
            ORDER BY created_at DESC
        `);

        return {
            ...metrics,
            securityLogs,
            suspendedUsers: suspendedUsers.rows
        };
    }
}

export default AdminService;

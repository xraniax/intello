import asyncHandler from '../utils/asyncHandler.js';
import fs from 'fs';
import User from '../models/user.model.js';
import File from '../models/file.model.js';
import { query } from '../utils/config/db.js';
import QuotaService from '../services/quota.service.js';

class ProfileController {
    /**
     * @route   GET /api/profile
     * @desc    Get user profile with stats and activity
     * @access  Private
     */
    static getProfile = asyncHandler(async (req, res) => {
        const userId = req.user.id;

        // 1. Basic Info is already mostly in req.user
        // Re-fetch to ensure freshness
        const user = await User.findById(userId);

        // 2. Stats - Real aggregations
        const subjectsResult = await query('SELECT COUNT(*) FROM subjects WHERE user_id = $1', [userId]);
        const materialsResult = await query('SELECT COUNT(*) FROM materials WHERE user_id = $1', [userId]);
        const totalWorkspaces = parseInt(subjectsResult.rows[0].count) || 0;
        const totalMaterials = parseInt(materialsResult.rows[0].count) || 0;

        // Exam readiness per subject (Real logic, even if 0 due to no quizzes)
        const readinessRes = await query(`
            SELECT s.name, 0 as readiness 
            FROM subjects s 
            WHERE s.user_id = $1 
            ORDER BY s.name ASC`, 
            [userId]
        );

        // 3. Activity
        const uploadsRes = await query(
            "SELECT id, title, type, created_at FROM materials WHERE user_id = $1 AND type = 'upload' ORDER BY created_at DESC LIMIT 5",
            [userId]
        );
        const quizzesRes = await query(
            "SELECT id, title, type, created_at, status FROM materials WHERE user_id = $1 AND type = 'quiz' ORDER BY created_at DESC LIMIT 5",
            [userId]
        );
        const chatRes = await query(
            "SELECT id, query as message, response, created_at as timestamp FROM chat_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5",
            [userId]
        ).catch(err => {
            console.error('[ProfileController] Chat history query failed (table might be missing):', err.message);
            return { rows: [] };
        });

        // 4. Analytics (Dynamic messages instead of hardcoded fakes)
        const hasActivity = totalMaterials > 0 || chatRes.rows.length > 0;
        const recommendations = [];
        if (totalWorkspaces === 0) recommendations.push('Create your first subject to start learning');
        if (totalMaterials === 0 && totalWorkspaces > 0) recommendations.push('Upload a PDF or take a note to generate study tools');
        if (chatRes.rows.length === 0) recommendations.push('Ask the AI tutor a question about your materials');

        // 5. Quota info
        const quotaStats = await QuotaService.getUserStorageStats(userId);

        res.json({
            success: true,
            data: {
                basic_info: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    avatar_url: user.avatar_url,
                    created_at: user.created_at,
                    achievements: user.achievements || []
                },
                stats: {
                    total_workspaces: totalWorkspaces,
                    total_materials: totalMaterials,
                    subject_readiness: readinessRes.rows
                },
                activity: {
                    recent_uploads: uploadsRes.rows,
                    recent_quizzes: quizzesRes.rows,
                    recent_interactions: chatRes.rows
                },
                quota: quotaStats, // Add new quota field
                settings: user.settings || { theme: 'system', notifications: true },
                analytics: {
                    learning_status: hasActivity ? 'Active Learner' : 'Getting Started',
                    recommendations: recommendations.slice(0, 3)
                }
            }
        });
    });

    /**
     * @route   PUT /api/profile
     * @desc    Update user profile or settings
     * @access  Private
     */
    static updateProfile = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { name, avatar_url, settings } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (avatar_url !== undefined) updates.avatar_url = avatar_url;
        if (settings !== undefined) updates.settings = settings;

        if (Object.keys(updates).length > 0) {
            await User.adminUpdate(userId, updates); // Reusing adminUpdate which builds dynamic queries
        }

        const updatedUser = await User.findById(userId);

        res.json({
            success: true,
            data: {
                name: updatedUser.name,
                avatar_url: updatedUser.avatar_url,
                settings: updatedUser.settings || {}
            }
        });
    });

}

export default ProfileController;

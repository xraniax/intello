import RatingModel, { VALID_ISSUE_FLAGS } from '../models/rating.model.js';
import { query } from '../utils/config/db.js';

// Minimum engagement before a rating is accepted (configurable)
const MIN_ENGAGEMENT_SECONDS = parseInt(process.env.RATING_MIN_ENGAGEMENT_SECONDS || '30', 10);

class RatingService {
    /**
     * Submit or update a rating.
     * Enforces: material ownership check, engagement gate, duplicate prevention via upsert.
     * Recomputes analytics cache asynchronously after write.
     */
    static async submitRating(userId, materialId, data) {
        await this._assertMaterialAccessible(userId, materialId);
        this._validateEngagement(data.engagement_seconds);
        this._sanitizeIssueFlags(data);

        const rating = await RatingModel.upsert(userId, materialId, data);

        // Fire-and-forget analytics recomputation — never blocks response
        RatingModel.computeAndCacheAnalytics(materialId).catch((err) =>
            console.error('[RatingService] Analytics recomputation failed:', err.message)
        );

        return rating;
    }

    /**
     * Get the authenticated user's own rating for a material (or null).
     */
    static async getUserRating(userId, materialId) {
        return RatingModel.findByUserAndMaterial(userId, materialId);
    }

    /**
     * Check if a rating already exists — used by the frontend to decide whether
     * to auto-show the popup.
     */
    static async checkExists(userId, materialId) {
        return RatingModel.existsByUserAndMaterial(userId, materialId);
    }

    /**
     * Return cached analytics for a single material.
     * Falls back to live computation when the cache is cold (e.g. first request).
     */
    static async getMaterialAnalytics(materialId) {
        let cached = await RatingModel.getCachedAnalytics(materialId);
        if (!cached) {
            cached = await RatingModel.computeAndCacheAnalytics(materialId);
        }
        return cached;
    }

    /**
     * Subject-level analytics — all materials in a subject with their ratings.
     */
    static async getSubjectAnalytics(subjectId) {
        return RatingModel.getSubjectAnalytics(subjectId);
    }

    /**
     * Platform-wide admin overview.
     */
    static async getAdminOverview(options = {}) {
        return RatingModel.getAdminOverview(options);
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    /**
     * Verify the material exists and is not deleted.
     * We intentionally do NOT check user_id ownership here so that any user
     * who can view a shared material can also rate it.
     */
    static async _assertMaterialAccessible(userId, materialId) {
        const result = await query(
            `SELECT id FROM materials WHERE id = $1 AND deleted_at IS NULL`,
            [materialId]
        );
        if (result.rowCount === 0) {
            const err = new Error('Material not found or has been deleted.');
            err.statusCode = 404;
            throw err;
        }
    }

    static _validateEngagement(seconds) {
        if (!Number.isFinite(seconds) || seconds < MIN_ENGAGEMENT_SECONDS) {
            const err = new Error(
                `Minimum engagement of ${MIN_ENGAGEMENT_SECONDS}s required before rating.`
            );
            err.statusCode = 422;
            throw err;
        }
    }

    static _sanitizeIssueFlags(data) {
        if (!Array.isArray(data.issue_flags)) {
            data.issue_flags = [];
            return;
        }
        data.issue_flags = data.issue_flags.filter((f) => VALID_ISSUE_FLAGS.includes(f));
    }
}

export default RatingService;

import RatingService from '../services/rating.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import { VALID_ISSUE_FLAGS } from '../models/rating.model.js';

class RatingController {
    /**
     * POST /api/ratings
     * Submit or update a rating for a material.
     */
    static submit = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { materialId, ...ratingData } = req.body;

        const rating = await RatingService.submitRating(userId, materialId, ratingData);

        res.status(201).json({
            status: 'success',
            message: 'Rating submitted successfully.',
            data: { rating },
        });
    });

    /**
     * GET /api/ratings/check/:materialId
     * Returns { exists: bool } — used by the frontend to skip the auto-popup
     * when the user has already rated.
     */
    static checkExists = asyncHandler(async (req, res) => {
        const exists = await RatingService.checkExists(req.user.id, req.params.materialId);
        res.json({ status: 'success', data: { exists } });
    });

    /**
     * GET /api/ratings/:materialId
     * Returns the authenticated user's own rating (or null).
     */
    static getMyRating = asyncHandler(async (req, res) => {
        const rating = await RatingService.getUserRating(req.user.id, req.params.materialId);
        res.json({ status: 'success', data: { rating } });
    });

    /**
     * GET /api/ratings/:materialId/analytics
     * Material-level analytics (requires admin role).
     */
    static getMaterialAnalytics = asyncHandler(async (req, res) => {
        const analytics = await RatingService.getMaterialAnalytics(req.params.materialId);
        res.json({ status: 'success', data: { analytics } });
    });

    /**
     * GET /api/ratings/subject/:subjectId/analytics
     * All materials in a subject with their rating summaries (requires admin role).
     */
    static getSubjectAnalytics = asyncHandler(async (req, res) => {
        const materials = await RatingService.getSubjectAnalytics(req.params.subjectId);
        res.json({ status: 'success', data: { materials } });
    });

    /**
     * GET /api/ratings/admin/overview
     * Platform-wide overview: worst materials, per-subject stats, global KPIs.
     */
    static getAdminOverview = asyncHandler(async (req, res) => {
        const limit = parseInt(req.query.limit, 10) || 20;
        const minRatings = parseInt(req.query.minRatings, 10) || 1;
        const data = await RatingService.getAdminOverview({ limit, minRatings });
        res.json({ status: 'success', data });
    });

    /**
     * GET /api/ratings/meta/flags
     * Returns the list of valid issue flag keys — consumed by the frontend
     * to render checkboxes without hardcoding.
     */
    static getValidFlags = asyncHandler(async (req, res) => {
        res.json({ status: 'success', data: { flags: VALID_ISSUE_FLAGS } });
    });
}

export default RatingController;

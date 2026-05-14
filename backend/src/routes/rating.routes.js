import express from 'express';
import RatingController from '../controllers/rating.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { submitRatingSchema } from '../middlewares/rating.validator.js';

const router = express.Router();

// All rating routes require authentication
router.use(protect);

// ── Student routes ─────────────────────────────────────────────────────────────
// Static segments first to avoid collision with /:materialId
router.get('/meta/flags',                        RatingController.getValidFlags);
router.get('/admin/overview',                    RatingController.getAdminOverview);
router.get('/subject/:subjectId/analytics',      RatingController.getSubjectAnalytics);

router.post('/', validate(submitRatingSchema),   RatingController.submit);
router.get('/check/:materialId',                 RatingController.checkExists);
router.get('/:materialId',                       RatingController.getMyRating);

// ── Admin routes ───────────────────────────────────────────────────────────────
router.get('/:materialId/analytics', adminOnly,  RatingController.getMaterialAnalytics);

export default router;

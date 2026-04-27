import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import analyticsController from '../controllers/analytics.controller.js';

const router = Router();

router.use(protect);

// ── Global analytics (must be before /:subjectId pattern) ─────────────────────
router.get('/global',          analyticsController.getGlobalDashboard);
router.get('/global/subjects', analyticsController.getSubjectsList);
router.get('/global/heatmap',  analyticsController.getActivityHeatmap);
router.get('/insights',                     analyticsController.getInsights);
router.patch('/insights/:id/dismiss',       analyticsController.dismissInsight);

// ── Write endpoints ────────────────────────────────────────────────────────────
router.post('/quiz-attempt',     analyticsController.recordQuizAttempt);
router.post('/flashcard-review', analyticsController.recordFlashcardReview);
router.post('/exam-attempt',     analyticsController.recordExamAttempt);

// ── Bulk summary (body payload — must come before /:subjectId routes) ─────────
router.post('/summaries', analyticsController.getBulkSummaries);

// ── Subject-scoped routes ──────────────────────────────────────────────────────
router.get('/:subjectId/dashboard', analyticsController.getDashboard);
router.get('/:subjectId/summary',   analyticsController.getSummary);

// Concept routes — /weak must be registered before /:name
router.get('/:subjectId/concepts',       analyticsController.getConcepts);
router.get('/:subjectId/concepts/weak',  analyticsController.getWeakConcepts);
router.get('/:subjectId/concepts/:name', analyticsController.getConceptDetail);

// Progress routes
router.get('/:subjectId/progress',          analyticsController.getProgress);
router.get('/:subjectId/progress/concepts', analyticsController.getProgressConcepts);
router.get('/:subjectId/progress/exams',    analyticsController.getProgressExams);

// ── Legacy routes (kept for backwards compatibility) ───────────────────────────
router.get('/readiness/:subjectId', analyticsController.getReadinessScore);
router.get('/mastery/:subjectId',   analyticsController.getConceptMastery);
router.get('/trends/:subjectId',    analyticsController.getTrends);
router.get('/full/:subjectId',      analyticsController.getFullAnalytics);

export default router;

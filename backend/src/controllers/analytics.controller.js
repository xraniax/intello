import AnalyticsService from '../services/analytics.service.js';

const analyticsController = {

    // ── Write endpoints ────────────────────────────────────────────────────────

    async recordQuizAttempt(req, res, next) {
        try {
            const userId = req.user.id;
            const { materialId, subjectId, responses, startedAt, completedAt } = req.body;

            if (!subjectId || !Array.isArray(responses) || responses.length === 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'subjectId and a non-empty responses array are required.',
                });
            }

            const attemptId = await AnalyticsService.recordQuizAttempt(userId, {
                materialId, subjectId, responses, startedAt, completedAt,
            });

            res.status(201).json({ status: 'ok', data: { attemptId } });
        } catch (err) {
            next(err);
        }
    },

    async recordFlashcardReview(req, res, next) {
        try {
            const userId = req.user.id;
            const { materialId, cardId, topicName, outcome, easeFactor, intervalDays, daysSinceLast } = req.body;

            const VALID_OUTCOMES = ['again', 'hard', 'good', 'easy'];
            if (!outcome || !VALID_OUTCOMES.includes(outcome)) {
                return res.status(400).json({
                    status: 'error',
                    message: `outcome must be one of: ${VALID_OUTCOMES.join(', ')}.`,
                });
            }

            const reviewId = await AnalyticsService.recordFlashcardReview(userId, {
                materialId, cardId, topicName, outcome, easeFactor, intervalDays, daysSinceLast,
            });

            res.status(201).json({ status: 'ok', data: { reviewId } });
        } catch (err) {
            next(err);
        }
    },

    async recordExamAttempt(req, res, next) {
        try {
            const userId = req.user.id;
            const { materialId, subjectId, score, maxScore,
                durationSeconds, startedAt, details, examQuestions } = req.body;

            if (!subjectId || score === undefined || maxScore === undefined) {
                return res.status(400).json({
                    status: 'error',
                    message: 'subjectId, score, and maxScore are required.',
                });
            }

            const attemptId = await AnalyticsService.recordExamAttempt(userId, {
                materialId, subjectId, score, maxScore,
                durationSeconds, startedAt, details, examQuestions,
            });

            res.status(201).json({ status: 'ok', data: { attemptId } });
        } catch (err) {
            next(err);
        }
    },

    // ── Dashboard & summary ────────────────────────────────────────────────────

    async getDashboard(req, res, next) {
        try {
            const userId    = req.user.id;
            const subjectId = req.params.subjectId;
            const refresh   = req.query.refresh === 'true';

            const result = await AnalyticsService.getDashboard(userId, subjectId, { refresh });
            res.json({ status: 'ok', data: result });
        } catch (err) {
            next(err);
        }
    },

    async getSummary(req, res, next) {
        try {
            const userId    = req.user.id;
            const subjectId = req.params.subjectId;

            const result = await AnalyticsService.getSummary(userId, subjectId);
            res.json({ status: 'ok', data: result });
        } catch (err) {
            next(err);
        }
    },

    async getBulkSummaries(req, res, next) {
        try {
            const userId     = req.user.id;
            const subjectIds = req.body.subjectIds;

            if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'subjectIds must be a non-empty array.',
                });
            }
            if (subjectIds.length > 50) {
                return res.status(400).json({
                    status: 'error',
                    message: 'subjectIds may contain at most 50 entries.',
                });
            }

            const result = await AnalyticsService.getBulkSummaries(userId, subjectIds);
            res.json({ status: 'ok', data: result });
        } catch (err) {
            next(err);
        }
    },

    // ── Concept endpoints ──────────────────────────────────────────────────────

    async getConcepts(req, res, next) {
        try {
            const userId    = req.user.id;
            const subjectId = req.params.subjectId;

            const VALID_SORTS  = ['crs', 'mastery_score', 'last_updated', 'interaction_count'];
            const VALID_ORDERS = ['asc', 'desc'];
            const VALID_STATES = ['critical', 'weak', 'developing', 'mastered', 'unstarted'];

            const sort            = VALID_SORTS.includes(req.query.sort)   ? req.query.sort   : 'crs';
            const order           = VALID_ORDERS.includes(req.query.order) ? req.query.order  : 'desc';
            const state           = VALID_STATES.includes(req.query.state) ? req.query.state  : null;
            const minInteractions = parseInt(req.query.minInteractions, 10) || 0;

            const result = await AnalyticsService.getConcepts(userId, subjectId, {
                sort, order, state, minInteractions,
            });
            res.json({ status: 'ok', data: result });
        } catch (err) {
            next(err);
        }
    },

    async getWeakConcepts(req, res, next) {
        try {
            const userId    = req.user.id;
            const subjectId = req.params.subjectId;

            const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
            const state = req.query.state || null;

            const result = await AnalyticsService.getWeakConcepts(userId, subjectId, { limit, state });
            res.json({ status: 'ok', data: result });
        } catch (err) {
            next(err);
        }
    },

    async getConceptDetail(req, res, next) {
        try {
            const userId      = req.user.id;
            const subjectId   = req.params.subjectId;
            const conceptName = decodeURIComponent(req.params.name);

            const result = await AnalyticsService.getConceptDetail(userId, subjectId, conceptName);
            res.json({ status: 'ok', data: result });
        } catch (err) {
            next(err);
        }
    },

    // ── Progress endpoints ─────────────────────────────────────────────────────

    async getProgress(req, res, next) {
        try {
            const userId    = req.user.id;
            const subjectId = req.params.subjectId;

            const VALID_GRANULARITIES = ['day', 'week', 'month'];
            const VALID_SOURCES       = new Set(['quiz', 'flashcard', 'exam']);

            const from        = req.query.from  || null;
            const to          = req.query.to    || null;
            const granularity = VALID_GRANULARITIES.includes(req.query.granularity)
                ? req.query.granularity : 'week';

            const rawSources = req.query.sources
                ? req.query.sources.split(',').filter((s) => VALID_SOURCES.has(s))
                : ['quiz', 'flashcard', 'exam'];

            const result = await AnalyticsService.getProgress(userId, subjectId, {
                from, to, granularity, sources: rawSources,
            });
            res.json({ status: 'ok', data: result });
        } catch (err) {
            next(err);
        }
    },

    async getProgressConcepts(req, res, next) {
        try {
            const userId    = req.user.id;
            const subjectId = req.params.subjectId;

            const VALID_GRANULARITIES = ['day', 'week', 'month'];

            const from        = req.query.from  || null;
            const to          = req.query.to    || null;
            const granularity = VALID_GRANULARITIES.includes(req.query.granularity)
                ? req.query.granularity : 'week';

            const result = await AnalyticsService.getProgressConcepts(userId, subjectId, {
                from, to, granularity,
            });
            res.json({ status: 'ok', data: result });
        } catch (err) {
            next(err);
        }
    },

    async getProgressExams(req, res, next) {
        try {
            const userId    = req.user.id;
            const subjectId = req.params.subjectId;

            const from = req.query.from || null;
            const to   = req.query.to   || null;

            const result = await AnalyticsService.getProgressExams(userId, subjectId, { from, to });
            res.json({ status: 'ok', data: result });
        } catch (err) {
            next(err);
        }
    },

    // ── Global analytics ────────────────────────────────────────────────────────

    async getGlobalDashboard(req, res, next) {
        try {
            const result = await AnalyticsService.getGlobalDashboard(req.user.id);
            res.json({ status: 'ok', data: result });
        } catch (err) { next(err); }
    },

    async getSubjectsList(req, res, next) {
        try {
            const result = await AnalyticsService.getSubjectsList(req.user.id);
            res.json({ status: 'ok', data: result });
        } catch (err) { next(err); }
    },

    async getActivityHeatmap(req, res, next) {
        try {
            const days   = Math.min(parseInt(req.query.days, 10) || 365, 365);
            const result = await AnalyticsService.getActivityHeatmap(req.user.id, days);
            res.json({ status: 'ok', data: result });
        } catch (err) { next(err); }
    },

    async getInsights(req, res, next) {
        try {
            const limit  = Math.min(parseInt(req.query.limit, 10) || 5, 20);
            const type   = req.query.type || null;
            const result = await AnalyticsService.getInsights(req.user.id, { limit, type });
            res.json({ status: 'ok', data: result });
        } catch (err) { next(err); }
    },

    async dismissInsight(req, res, next) {
        try {
            const ok = await AnalyticsService.dismissInsight(req.user.id, req.params.id);
            if (!ok) return res.status(404).json({ status: 'error', message: 'Insight not found.' });
            res.json({ status: 'ok' });
        } catch (err) { next(err); }
    },

    // ── Legacy delegates (keep old routes working) ─────────────────────────────

    async getReadinessScore(req, res, next) {
        try {
            const result = await AnalyticsService.getSummary(req.user.id, req.params.subjectId);
            res.json({ status: 'ok', data: result });
        } catch (err) {
            next(err);
        }
    },

    async getConceptMastery(req, res, next) {
        try {
            const topics = await AnalyticsService.getConcepts(req.user.id, req.params.subjectId, {});
            res.json({ status: 'ok', data: topics });
        } catch (err) {
            next(err);
        }
    },

    async getTrends(req, res, next) {
        try {
            const trends = await AnalyticsService.getProgress(req.user.id, req.params.subjectId, {});
            res.json({ status: 'ok', data: trends });
        } catch (err) {
            next(err);
        }
    },

    async getFullAnalytics(req, res, next) {
        try {
            const result = await AnalyticsService.getDashboard(req.user.id, req.params.subjectId, { refresh: true });
            res.json({ status: 'ok', data: result });
        } catch (err) {
            next(err);
        }
    },
};

export default analyticsController;

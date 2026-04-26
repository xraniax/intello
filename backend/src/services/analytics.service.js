import { query } from '../utils/config/db.js';
import pool from '../utils/config/db.js';
import {
    computeAllScores,
    computeConceptReport,
    computeTrend,
    computeWeaknessScore,
    classifyCRS,
    trendLabel,
    dataQualityLabel,
    computeConfidence,
} from '../analytics/index.js';

// ─── Internal helpers ─────────────────────────────────────────────────────────

const W = { quiz: 0.35, flashcard: 0.25, exam: 0.40 };

/** Weighted composite from 0-100 source scores; skips missing sources. */
const weightedComposite = (quizAcc, flashAcc, examAcc) => {
    let score = 0, total = 0;
    if (quizAcc  !== null) { score += quizAcc  * W.quiz;      total += W.quiz;      }
    if (flashAcc !== null) { score += flashAcc * W.flashcard; total += W.flashcard; }
    if (examAcc  !== null) { score += examAcc  * W.exam;      total += W.exam;      }
    return total > 0 ? Math.round((score / total) * 100) / 100 : 0;
};

const f = (v) => (v !== null && v !== undefined ? parseFloat(v) : null);
const i = (v) => parseInt(v, 10) || 0;

/** Classify a DB-scale (0-100) mastery_score into a state label. */
const classifyDBScore = (score100, confidence = 1, trend = null) =>
    classifyCRS(score100 / 100, confidence, trend);

/** Weakness score from a DB-scale mastery_score. */
const weaknessFromDB = (score100, trend, nInteractions) =>
    computeWeaknessScore(score100 / 100, trend, nInteractions);

const GRANULARITY_MAP = { day: 'day', week: 'week', month: 'month' };
const validGranularity = (g) => GRANULARITY_MAP[g] ?? 'week';

const DEFAULT_WINDOW_DAYS = 30;
const toDate = (s) => (s ? new Date(s) : null);
const windowFrom = (from, days = DEFAULT_WINDOW_DAYS) =>
    toDate(from) ?? new Date(Date.now() - days * 86_400_000);
const windowTo   = (to)   => toDate(to)   ?? new Date();

// ─── Analytics Service ────────────────────────────────────────────────────────

class AnalyticsService {

    // ═══════════════════════════════════════════════════════════════════════════
    // WRITE
    // ═══════════════════════════════════════════════════════════════════════════

    static async recordQuizAttempt(userId, payload) {
        const { materialId, subjectId, responses, startedAt, completedAt = new Date() } = payload;
        if (!Array.isArray(responses) || responses.length === 0) return null;

        const diffToInt = (d) => ({ Introductory: 1, easy: 2, Intermediate: 3, medium: 3, hard: 4, Advanced: 5 }[d] ?? 3);
        const score        = responses.filter((r) => r.isCorrect).length;
        const maxScore     = responses.length;
        const difficultyAvg = responses.reduce((s, r) => s + diffToInt(r.difficulty), 0) / maxScore;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { rows: [{ id: attemptId }] } = await client.query(
                `INSERT INTO quiz_attempts
                    (user_id, subject_id, material_id, score, max_score, difficulty_avg, started_at, completed_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
                [userId, subjectId, materialId ?? null, score, maxScore,
                    difficultyAvg.toFixed(2), new Date(startedAt), new Date(completedAt)]
            );
            for (const r of responses) {
                await client.query(
                    `INSERT INTO quiz_responses
                        (attempt_id, external_question_id, topic_name, selected_answer, is_correct, time_spent_ms, difficulty)
                     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    [attemptId, r.questionId ?? null, r.topicName ?? null,
                        r.selectedAnswer ?? null, r.isCorrect, r.timeSpentMs ?? 0, diffToInt(r.difficulty)]
                );
            }
            await client.query('COMMIT');
            this.#refreshMastery(userId, subjectId).catch((e) =>
                console.error('[Analytics] mastery refresh failed after quiz:', e.message));
            return attemptId;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    static async recordFlashcardReview(userId, payload) {
        const { materialId, cardId, topicName, outcome, easeFactor, intervalDays, daysSinceLast } = payload;
        const { rows: [{ id: reviewId }] } = await query(
            `INSERT INTO flashcard_reviews
                (user_id, material_id, external_card_id, topic_name, outcome, ease_factor, interval_days, days_since_last)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            [userId, materialId ?? null, cardId ?? null, topicName ?? null,
                outcome, easeFactor ?? 2.50, intervalDays ?? 1, daysSinceLast ?? null]
        );
        if (topicName && materialId) {
            const { rows } = await query(
                'SELECT subject_id FROM materials WHERE id = $1 AND user_id = $2 LIMIT 1',
                [materialId, userId]
            );
            if (rows[0]) {
                this.#refreshMastery(userId, rows[0].subject_id).catch((e) =>
                    console.error('[Analytics] mastery refresh failed after flashcard:', e.message));
            }
        }
        return reviewId;
    }

    static async recordExamAttempt(userId, payload) {
        const { materialId, subjectId, score, maxScore, durationSeconds, startedAt, details, examQuestions } = payload;
        if (!subjectId) return null;

        const { rows: [{ cnt }] } = await query(
            'SELECT COUNT(*) AS cnt FROM mock_exam_attempts WHERE user_id = $1 AND subject_id = $2',
            [userId, subjectId]
        );
        const attemptNumber     = parseInt(cnt, 10) + 1;
        const questionTopicMap  = new Map((examQuestions || []).map((q) => [q.id, q.topic || 'General']));
        const topicStats        = new Map();

        for (const d of (details || [])) {
            const topic    = questionTopicMap.get(d.questionId) || 'General';
            const existing = topicStats.get(topic) || { score: 0, max_score: 0, question_count: 0 };
            existing.score         += d.isCorrect ? 1 : 0;
            existing.max_score     += 1;
            existing.question_count += 1;
            topicStats.set(topic, existing);
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { rows: [{ id: attemptId }] } = await client.query(
                `INSERT INTO mock_exam_attempts
                    (user_id, subject_id, material_id, score, max_score, duration_seconds, attempt_number, started_at, completed_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING id`,
                [userId, subjectId, materialId ?? null, score, maxScore,
                    durationSeconds ?? 0, attemptNumber, new Date(startedAt)]
            );
            for (const [topicName, stats] of topicStats.entries()) {
                await client.query(
                    `INSERT INTO exam_concept_scores (attempt_id, topic_name, score, max_score, question_count)
                     VALUES ($1,$2,$3,$4,$5)`,
                    [attemptId, topicName, stats.score, stats.max_score, stats.question_count]
                );
            }
            await client.query('COMMIT');
            this.#refreshMastery(userId, subjectId).catch((e) =>
                console.error('[Analytics] mastery refresh failed after exam:', e.message));
            return attemptId;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DASHBOARD
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Full readiness dashboard. Reads from the mastery snapshot for speed.
     * Pass refresh=true to recompute from raw data via the analytics engine.
     */
    static async getDashboard(userId, subjectId, { refresh = false } = {}) {
        // When refresh is requested, delegate to the full engine pipeline
        if (refresh) {
            return this.#buildDashboardFromEngine(userId, subjectId);
        }

        const [snapshotRes, recentQuizRes, recentExamRes, subjectRes] = await Promise.all([
            query(
                `SELECT
                    ROUND(AVG(mastery_score), 1)       AS readiness,
                    ROUND(AVG(quiz_accuracy), 1)        AS understanding,
                    ROUND(AVG(flashcard_retention), 1)  AS retention,
                    ROUND(AVG(exam_accuracy), 1)        AS mastery,
                    COUNT(*)                            AS topic_count,
                    SUM(response_count)                 AS total_interactions,
                    MAX(last_activity_at)               AS last_activity_at,
                    MAX(updated_at)                     AS snapshot_updated_at
                 FROM user_concept_mastery
                 WHERE user_id = $1 AND subject_id = $2`,
                [userId, subjectId]
            ),
            // Recent quiz session accuracies for trend computation
            query(
                `SELECT ROUND(score::numeric / NULLIF(max_score,0) * 100, 1) AS accuracy
                 FROM quiz_attempts
                 WHERE user_id = $1 AND subject_id = $2
                 ORDER BY completed_at DESC LIMIT 10`,
                [userId, subjectId]
            ),
            // Recent exam accuracies for trend
            query(
                `SELECT ROUND(score::numeric / NULLIF(max_score,0) * 100, 1) AS accuracy
                 FROM mock_exam_attempts
                 WHERE user_id = $1 AND subject_id = $2
                 ORDER BY completed_at DESC LIMIT 5`,
                [userId, subjectId]
            ),
            query('SELECT name FROM subjects WHERE id = $1 AND user_id = $2 LIMIT 1', [subjectId, userId]),
        ]);

        const snap = snapshotRes.rows[0];
        if (!snap || snap.readiness === null) return this.#emptyDashboard(subjectId);

        const readiness        = f(snap.readiness)    ?? 0;
        const understanding    = f(snap.understanding);
        const retention        = f(snap.retention);
        const mastery          = f(snap.mastery);
        const totalInteractions = i(snap.total_interactions);

        // Confidence from total interaction count
        const confidence = computeConfidence({
            quizCount:      totalInteractions,   // approximate — snapshot only has total
            flashcardCount: 0,
            examCount:      0,
        });

        // Trend from recent sessions (ordered oldest→newest)
        const quizAccuracies = recentQuizRes.rows.map((r) => f(r.accuracy)).reverse();
        const examAccuracies = recentExamRes.rows.map((r) => f(r.accuracy)).reverse();
        const trendValue     = computeTrend([...quizAccuracies, ...examAccuracies]);

        const snapshotAgeMs = snap.snapshot_updated_at
            ? Date.now() - new Date(snap.snapshot_updated_at).getTime()
            : null;

        // Weak concepts from snapshot, weakness score computed in JS
        const weakConceptsRes = await query(
            `SELECT topic_name, mastery_score, quiz_accuracy, flashcard_retention,
                    exam_accuracy, response_count, last_activity_at
             FROM user_concept_mastery
             WHERE user_id = $1 AND subject_id = $2
               AND mastery_score < 60
             ORDER BY mastery_score ASC
             LIMIT 5`,
            [userId, subjectId]
        );

        const weakConcepts = weakConceptsRes.rows
            .map((r) => {
                const score  = f(r.mastery_score) ?? 0;
                const n      = i(r.response_count);
                const state  = classifyDBScore(score);
                const wScore = weaknessFromDB(score, null, n);
                return {
                    name:           r.topic_name,
                    crs:            score,
                    state,
                    weakness_score: Math.round(wScore * 1000) / 1000,
                    trend:          null,   // not computed in fast path
                    action:         wScore > 0.5 ? 'urgent_review' : wScore > 0.3 ? 'scheduled_review' : 'monitor',
                };
            })
            .filter((c) => c.state === 'critical' || c.state === 'weak');

        return {
            subject: {
                id:   subjectId,
                name: subjectRes.rows[0]?.name ?? null,
            },
            readiness: {
                score:              readiness,
                label:              classifyDBScore(readiness),
                confidence:         Math.round(confidence * 100) / 100,
                data_quality:       dataQualityLabel(confidence),
                snapshot_age_hours: snapshotAgeMs ? Math.round(snapshotAgeMs / 3_600_000 * 10) / 10 : null,
            },
            breakdown: {
                understanding: understanding !== null ? { score: understanding, source: 'quizzes',    based_on: null } : null,
                retention:     retention     !== null ? { score: retention,     source: 'flashcards', based_on: null } : null,
                mastery:       mastery       !== null ? { score: mastery,       source: 'exams',      based_on: null } : null,
            },
            meta: {
                consistency:       null,   // not in snapshot — use refresh=true
                trend: {
                    value: trendValue,
                    label: trendLabel(trendValue),
                    based_on: `last_${quizAccuracies.length + examAccuracies.length}_sessions`,
                },
                total_interactions: totalInteractions,
                last_activity_at:   snap.last_activity_at,
            },
            weak_concepts:          weakConcepts,
            next_suggested_action:  weakConcepts[0]
                ? this.#suggestAction(weakConcepts[0])
                : null,
        };
    }

    /** Lightweight single-number summary for subject cards. */
    static async getSummary(userId, subjectId) {
        const [snapshotRes, recentRes] = await Promise.all([
            query(
                `SELECT ROUND(AVG(mastery_score), 1) AS readiness, MAX(last_activity_at) AS last_activity_at
                 FROM user_concept_mastery
                 WHERE user_id = $1 AND subject_id = $2`,
                [userId, subjectId]
            ),
            query(
                `SELECT ROUND(score::numeric / NULLIF(max_score,0) * 100, 1) AS accuracy
                 FROM quiz_attempts
                 WHERE user_id = $1 AND subject_id = $2
                 ORDER BY completed_at DESC LIMIT 8`,
                [userId, subjectId]
            ),
        ]);

        const row       = snapshotRes.rows[0];
        const readiness = f(row?.readiness) ?? 0;
        const accuracies = recentRes.rows.map((r) => f(r.accuracy)).reverse();
        const trend      = computeTrend(accuracies);

        return {
            subject_id:       subjectId,
            readiness,
            label:            classifyDBScore(readiness),
            trend:            trendLabel(trend),
            last_activity_at: row?.last_activity_at ?? null,
        };
    }

    /** Bulk summaries — single query for N subjects. Avoids N+1 on list pages. */
    static async getBulkSummaries(userId, subjectIds) {
        if (!subjectIds?.length) return [];

        const { rows } = await query(
            `SELECT subject_id,
                    ROUND(AVG(mastery_score), 1)  AS readiness,
                    MAX(last_activity_at)          AS last_activity_at
             FROM user_concept_mastery
             WHERE user_id = $1 AND subject_id = ANY($2::uuid[])
             GROUP BY subject_id`,
            [userId, subjectIds]
        );

        // Index by subject_id to respond in the same order as the request
        const bySubject = new Map(rows.map((r) => [r.subject_id, r]));

        return subjectIds.map((id) => {
            const r         = bySubject.get(id);
            const readiness = f(r?.readiness) ?? 0;
            return {
                subject_id:       id,
                readiness,
                label:            classifyDBScore(readiness),
                trend:            null,   // not computed in bulk path
                last_activity_at: r?.last_activity_at ?? null,
            };
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONCEPTS
    // ═══════════════════════════════════════════════════════════════════════════

    /** All concepts with scores. Backed entirely by the mastery snapshot. */
    static async getConcepts(userId, subjectId, {
        sort            = 'weakness',
        order           = 'asc',
        state           = null,
        minInteractions = 3,
    } = {}) {
        const SORT_COLS = {
            weakness:      'mastery_score',
            name:          'topic_name',
            crs:           'mastery_score',
            last_activity: 'last_activity_at',
        };
        const col = SORT_COLS[sort] ?? 'mastery_score';
        const dir = order === 'desc' ? 'DESC' : 'ASC';

        const { rows } = await query(
            `SELECT topic_name, mastery_score, quiz_accuracy, flashcard_retention,
                    exam_accuracy, response_count, last_activity_at
             FROM user_concept_mastery
             WHERE user_id = $1 AND subject_id = $2
               AND response_count >= $3
             ORDER BY ${col} ${dir} NULLS LAST`,
            [userId, subjectId, minInteractions]
        );

        const concepts = rows.map((r) => {
            const score      = f(r.mastery_score) ?? 0;
            const n          = i(r.response_count);
            const conceptState = classifyDBScore(score);
            return {
                name:            r.topic_name,
                crs:             score,
                state:           conceptState,
                scores: {
                    understanding: f(r.quiz_accuracy),
                    retention:     f(r.flashcard_retention),
                    mastery:       f(r.exam_accuracy),
                },
                interactions: {
                    total: n,
                },
                weakness_score:  Math.round(weaknessFromDB(score, null, n) * 1000) / 1000,
                trend:           null,
                last_activity_at: r.last_activity_at,
            };
        });

        const filtered = state
            ? concepts.filter((c) => state.split(',').includes(c.state))
            : concepts;

        const distribution = { critical: 0, weak: 0, developing: 0, mastered: 0 };
        for (const c of concepts) {
            if (c.state in distribution) distribution[c.state]++;
        }

        return {
            subject_id:     subjectId,
            total_concepts: filtered.length,
            concepts:       filtered,
            distribution,
        };
    }

    /** Weak concepts only — fast, minimal payload for widgets/notifications. */
    static async getWeakConcepts(userId, subjectId, { limit = 5, state = 'critical,weak' } = {}) {
        const { rows } = await query(
            `SELECT topic_name, mastery_score, response_count, last_activity_at
             FROM user_concept_mastery
             WHERE user_id = $1 AND subject_id = $2
               AND mastery_score < 60
               AND response_count >= 3
             ORDER BY mastery_score ASC
             LIMIT $3`,
            [userId, subjectId, Math.min(limit, 50)]
        );

        const allowedStates = state.split(',');
        return rows
            .map((r) => {
                const score          = f(r.mastery_score) ?? 0;
                const n              = i(r.response_count);
                const conceptState   = classifyDBScore(score);
                const wScore         = weaknessFromDB(score, null, n);
                const lastAt         = r.last_activity_at ? new Date(r.last_activity_at) : null;
                const daysSinceLast  = lastAt ? Math.floor((Date.now() - lastAt.getTime()) / 86_400_000) : null;
                return {
                    name:                       r.topic_name,
                    crs:                        score,
                    state:                      conceptState,
                    weakness_score:             Math.round(wScore * 1000) / 1000,
                    trend:                      null,
                    action:                     wScore > 0.5 ? 'urgent_review' : wScore > 0.3 ? 'scheduled_review' : 'monitor',
                    days_since_last_activity:   daysSinceLast,
                };
            })
            .filter((c) => allowedStates.includes(c.state));
    }

    /** Single-concept deep-dive with raw interaction history for trend. */
    static async getConceptDetail(userId, subjectId, conceptName) {
        const [snapshotRes, quizHistoryRes, examHistoryRes, flashScheduleRes] = await Promise.all([
            query(
                `SELECT mastery_score, quiz_accuracy, flashcard_retention, exam_accuracy,
                        response_count, last_activity_at, updated_at
                 FROM user_concept_mastery
                 WHERE user_id = $1 AND subject_id = $2 AND topic_name = $3`,
                [userId, subjectId, conceptName]
            ),
            // Last 50 quiz responses for this concept (bounded)
            query(
                `SELECT qr.is_correct, qr.difficulty, qa.completed_at, qa.id AS attempt_id
                 FROM quiz_responses qr
                 JOIN quiz_attempts qa ON qa.id = qr.attempt_id
                 WHERE qa.user_id = $1 AND qa.subject_id = $2 AND qr.topic_name = $3
                 ORDER BY qa.completed_at DESC LIMIT 50`,
                [userId, subjectId, conceptName]
            ),
            query(
                `SELECT ecs.score, ecs.max_score, mea.completed_at, mea.attempt_number, mea.duration_seconds
                 FROM exam_concept_scores ecs
                 JOIN mock_exam_attempts mea ON mea.id = ecs.attempt_id
                 WHERE mea.user_id = $1 AND mea.subject_id = $2 AND ecs.topic_name = $3
                 ORDER BY mea.completed_at ASC`,
                [userId, subjectId, conceptName]
            ),
            // Cards due: most recent review state per card, check if overdue
            query(
                `SELECT COUNT(*) AS total,
                        COUNT(*) FILTER (
                            WHERE reviewed_at + (interval_days || ' days')::interval <= NOW()
                        ) AS due_today,
                        COUNT(*) FILTER (
                            WHERE reviewed_at + (interval_days || ' days')::interval < NOW() - INTERVAL '1 day'
                        ) AS overdue
                 FROM (
                     SELECT DISTINCT ON (external_card_id)
                            external_card_id, reviewed_at, interval_days
                     FROM flashcard_reviews
                     WHERE user_id = $1 AND topic_name = $2
                     ORDER BY external_card_id, reviewed_at DESC
                 ) latest`,
                [userId, conceptName]
            ),
        ]);

        if (!snapshotRes.rows[0]) return null;

        const snap  = snapshotRes.rows[0];
        const score = f(snap.mastery_score) ?? 0;
        const n     = i(snap.response_count);

        // Build trend series from quiz sessions (reversed: oldest first)
        const quizSessions = this.#groupByAttempt(quizHistoryRes.rows.reverse());
        const examSeries   = examHistoryRes.rows.map((r) => ({
            date:     r.completed_at,
            accuracy: Math.round((r.score / r.max_score) * 1000) / 10,
            source:   'exam',
        }));

        const trendAccuracies = [
            ...quizSessions.map((s) => s.accuracy),
            ...examSeries.map((s) => s.accuracy),
        ];
        const trendValue = computeTrend(trendAccuracies);

        const sched = flashScheduleRes.rows[0];

        return {
            concept:     conceptName,
            subject_id:  subjectId,
            crs:         score,
            state:       classifyDBScore(score),
            confidence:  Math.min(n / 15, 1),
            scores: {
                understanding: { value: f(snap.quiz_accuracy),        based_on: null, last_updated: snap.last_activity_at },
                retention:     { value: f(snap.flashcard_retention),  based_on: null, last_updated: snap.last_activity_at },
                mastery:       { value: f(snap.exam_accuracy),        based_on: null, last_updated: snap.last_activity_at },
            },
            trend: {
                value:   trendValue,
                label:   trendLabel(trendValue),
                history: [
                    ...quizSessions,
                    ...examSeries,
                ].sort((a, b) => new Date(a.date) - new Date(b.date)),
            },
            consistency: null,
            exam_history: examHistoryRes.rows.map((r, idx) => ({
                attempt_number:   r.attempt_number,
                score:            r.score,
                max_score:        r.max_score,
                accuracy:         Math.round((r.score / r.max_score) * 1000) / 10,
                duration_seconds: r.duration_seconds,
                date:             r.completed_at,
            })),
            flashcard_schedule: {
                total_cards:      i(sched?.total),
                cards_due_today:  i(sched?.due_today),
                overdue_cards:    i(sched?.overdue),
            },
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PROGRESS OVER TIME
    // ═══════════════════════════════════════════════════════════════════════════

    /** All time-series in one response: quiz accuracy, exam scores, flashcard retention. */
    static async getProgress(userId, subjectId, {
        from        = null,
        to          = null,
        granularity = 'week',
        sources     = 'all',
    } = {}) {
        const gran     = validGranularity(granularity);
        const fromDate = windowFrom(from);
        const toDate   = windowTo(to);
        const wantAll  = sources === 'all';
        const srcList  = wantAll ? ['quiz', 'exam', 'flashcard'] : sources.split(',').map((s) => s.trim());

        const queries = await Promise.all([
            srcList.includes('quiz') ? query(
                `SELECT
                    DATE_TRUNC($1, completed_at) AS period,
                    ROUND(AVG(score::numeric / NULLIF(max_score,0) * 100), 1) AS accuracy,
                    COUNT(*) AS sessions,
                    SUM(max_score) AS questions_answered
                 FROM quiz_attempts
                 WHERE user_id = $2 AND subject_id = $3
                   AND completed_at BETWEEN $4 AND $5
                 GROUP BY period ORDER BY period ASC`,
                [gran, userId, subjectId, fromDate, toDate]
            ) : Promise.resolve({ rows: [] }),

            srcList.includes('exam') ? query(
                `SELECT completed_at AS date,
                    attempt_number,
                    ROUND(score::numeric / NULLIF(max_score,0) * 100, 1) AS accuracy,
                    duration_seconds
                 FROM mock_exam_attempts
                 WHERE user_id = $1 AND subject_id = $2
                   AND completed_at BETWEEN $3 AND $4
                 ORDER BY completed_at ASC`,
                [userId, subjectId, fromDate, toDate]
            ) : Promise.resolve({ rows: [] }),

            srcList.includes('flashcard') ? query(
                `SELECT
                    DATE_TRUNC($1, fr.reviewed_at) AS period,
                    ROUND(AVG(CASE WHEN fr.outcome IN ('good','easy') THEN 1.0 ELSE 0.0 END) * 100, 1) AS retention_rate,
                    COUNT(*) AS reviews
                 FROM flashcard_reviews fr
                 WHERE fr.user_id = $2
                   AND fr.material_id IN (SELECT id FROM materials WHERE subject_id = $3 AND deleted_at IS NULL)
                   AND fr.reviewed_at BETWEEN $4 AND $5
                 GROUP BY period ORDER BY period ASC`,
                [gran, userId, subjectId, fromDate, toDate]
            ) : Promise.resolve({ rows: [] }),
        ]);

        const [quizRes, examRes, flashRes] = queries;

        const quizAccuracies = quizRes.rows.map((r) => f(r.accuracy));
        const examAccuracies = examRes.rows.map((r) => f(r.accuracy));
        const flashRetention = flashRes.rows.map((r) => f(r.retention_rate));

        return {
            subject_id: subjectId,
            window: {
                from:        fromDate.toISOString().slice(0, 10),
                to:          toDate.toISOString().slice(0, 10),
                granularity: gran,
            },
            series: {
                quiz_accuracy: quizRes.rows.map((r) => ({
                    period:              r.period,
                    accuracy:            f(r.accuracy),
                    sessions:            i(r.sessions),
                    questions_answered:  i(r.questions_answered),
                })),
                exam_scores: examRes.rows.map((r) => ({
                    date:             r.date,
                    accuracy:         f(r.accuracy),
                    attempt_number:   r.attempt_number,
                    duration_seconds: r.duration_seconds,
                })),
                flashcard_retention: flashRes.rows.map((r) => ({
                    period:         r.period,
                    retention_rate: f(r.retention_rate),
                    reviews:        i(r.reviews),
                })),
            },
            summary: {
                quiz_trend:      { value: computeTrend(quizAccuracies),  label: trendLabel(computeTrend(quizAccuracies))  },
                exam_trend:      { value: computeTrend(examAccuracies),  label: trendLabel(computeTrend(examAccuracies))  },
                flashcard_trend: { value: computeTrend(flashRetention),  label: trendLabel(computeTrend(flashRetention))  },
                overall_trend:   this.#combinedTrend(quizAccuracies, examAccuracies),
                consistency:     null,
            },
        };
    }

    /** Per-concept accuracy over time — powers concept-level sparklines. */
    static async getProgressConcepts(userId, subjectId, { from = null, to = null, granularity = 'week' } = {}) {
        const gran     = validGranularity(granularity);
        const fromDate = windowFrom(from);
        const toDate   = windowTo(to);

        const [quizRes, examRes] = await Promise.all([
            query(
                `SELECT DATE_TRUNC($1, qa.completed_at) AS period, qr.topic_name,
                        ROUND(AVG(qr.is_correct::int) * 100, 1) AS accuracy
                 FROM quiz_responses qr
                 JOIN quiz_attempts qa ON qa.id = qr.attempt_id
                 WHERE qa.user_id = $2 AND qa.subject_id = $3
                   AND qr.topic_name IS NOT NULL
                   AND qa.completed_at BETWEEN $4 AND $5
                 GROUP BY period, qr.topic_name
                 ORDER BY period ASC`,
                [gran, userId, subjectId, fromDate, toDate]
            ),
            query(
                `SELECT DATE_TRUNC($1, mea.completed_at) AS period, ecs.topic_name,
                        ROUND(SUM(ecs.score)::numeric / NULLIF(SUM(ecs.max_score),0) * 100, 1) AS accuracy
                 FROM exam_concept_scores ecs
                 JOIN mock_exam_attempts mea ON mea.id = ecs.attempt_id
                 WHERE mea.user_id = $2 AND mea.subject_id = $3
                   AND ecs.topic_name IS NOT NULL
                   AND mea.completed_at BETWEEN $4 AND $5
                 GROUP BY period, ecs.topic_name
                 ORDER BY period ASC`,
                [gran, userId, subjectId, fromDate, toDate]
            ),
        ]);

        // Merge by concept name
        const byTopic = new Map();
        const touch   = (name) => byTopic.get(name) ?? (byTopic.set(name, []) && byTopic.get(name));

        for (const r of quizRes.rows)  touch(r.topic_name).push({ date: r.period, accuracy: f(r.accuracy), source: 'quiz' });
        for (const r of examRes.rows)  touch(r.topic_name).push({ date: r.period, accuracy: f(r.accuracy), source: 'exam' });

        return {
            subject_id: subjectId,
            window: { from: fromDate.toISOString().slice(0, 10), to: toDate.toISOString().slice(0, 10) },
            concepts: [...byTopic.entries()].map(([name, points]) => {
                const sorted      = points.sort((a, b) => new Date(a.date) - new Date(b.date));
                const accuracies  = sorted.map((p) => p.accuracy);
                const first       = accuracies[0] ?? 0;
                const last        = accuracies[accuracies.length - 1] ?? 0;
                const trendVal    = computeTrend(accuracies);
                return {
                    name,
                    data_points:  sorted,
                    improvement:  Math.round((last - first) * 10) / 10,
                    trend:        trendLabel(trendVal),
                };
            }).sort((a, b) => Math.abs(b.improvement) - Math.abs(a.improvement)),
        };
    }

    /** Exam attempt history with per-attempt concept breakdown and deltas. */
    static async getProgressExams(userId, subjectId, { from = null, to = null } = {}) {
        const fromDate = windowFrom(from, 365);   // exam history window is wider (1 year default)
        const toDate   = windowTo(to);

        const [attemptsRes, conceptsRes] = await Promise.all([
            query(
                `SELECT id, score, max_score, completed_at, attempt_number, duration_seconds
                 FROM mock_exam_attempts
                 WHERE user_id = $1 AND subject_id = $2
                   AND completed_at BETWEEN $3 AND $4
                 ORDER BY completed_at ASC`,
                [userId, subjectId, fromDate, toDate]
            ),
            query(
                `SELECT ecs.topic_name, ecs.score, ecs.max_score, mea.attempt_number
                 FROM exam_concept_scores ecs
                 JOIN mock_exam_attempts mea ON mea.id = ecs.attempt_id
                 WHERE mea.user_id = $1 AND mea.subject_id = $2
                   AND mea.completed_at BETWEEN $3 AND $4
                 ORDER BY mea.attempt_number ASC`,
                [userId, subjectId, fromDate, toDate]
            ),
        ]);

        if (!attemptsRes.rows.length) {
            return { subject_id: subjectId, attempts: [], overall_improvement: null, best_concept: null, needs_most_work: null };
        }

        // Index concept scores by attempt_number
        const conceptsByAttempt = new Map();
        for (const r of conceptsRes.rows) {
            if (!conceptsByAttempt.has(r.attempt_number)) conceptsByAttempt.set(r.attempt_number, []);
            conceptsByAttempt.get(r.attempt_number).push({
                concept:  r.topic_name,
                score:    r.score,
                maxScore: r.max_score,
                accuracy: Math.round((r.score / r.max_score) * 1000) / 10,
            });
        }

        // Build attempts with delta from previous
        const attempts = attemptsRes.rows.map((row, idx) => {
            const accuracy      = Math.round((row.score / row.max_score) * 1000) / 10;
            const conceptScores = conceptsByAttempt.get(row.attempt_number) ?? [];
            const prev          = idx > 0 ? attemptsRes.rows[idx - 1] : null;
            const prevConcepts  = prev ? (conceptsByAttempt.get(prev.attempt_number) ?? []) : [];

            let delta = null;
            if (prev) {
                const prevAccuracy = Math.round((prev.score / prev.max_score) * 1000) / 10;
                const prevByName   = new Map(prevConcepts.map((c) => [c.concept, c.accuracy]));
                delta = {
                    overall:    Math.round((accuracy - prevAccuracy) * 10) / 10,
                    by_concept: conceptScores
                        .filter((c) => prevByName.has(c.concept))
                        .map((c) => ({
                            concept: c.concept,
                            delta:   Math.round((c.accuracy - (prevByName.get(c.concept) ?? 0)) * 10) / 10,
                        })),
                };
            }

            return {
                attempt_number:   row.attempt_number,
                date:             row.completed_at,
                overall_accuracy: accuracy,
                duration_seconds: row.duration_seconds,
                concept_scores:   conceptScores,
                ...(delta ? { delta_from_previous: delta } : {}),
            };
        });

        // Best/worst concept aggregated across all exams
        const conceptTotals = new Map();
        for (const r of conceptsRes.rows) {
            const t = conceptTotals.get(r.topic_name) ?? { correct: 0, total: 0 };
            t.correct += r.score;
            t.total   += r.max_score;
            conceptTotals.set(r.topic_name, t);
        }
        const conceptAccuracies = [...conceptTotals.entries()]
            .map(([name, t]) => ({ name, accuracy: t.total ? (t.correct / t.total) * 100 : 0 }))
            .sort((a, b) => b.accuracy - a.accuracy);

        const first              = attempts[0]?.overall_accuracy  ?? 0;
        const last               = attempts[attempts.length - 1]?.overall_accuracy ?? 0;

        return {
            subject_id:          subjectId,
            attempts,
            overall_improvement: attempts.length > 1 ? Math.round((last - first) * 10) / 10 : null,
            best_concept:        conceptAccuracies[0]?.name ?? null,
            needs_most_work:     conceptAccuracies[conceptAccuracies.length - 1]?.name ?? null,
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LEGACY (kept for backward compatibility)
    // ═══════════════════════════════════════════════════════════════════════════

    static async getReadinessScore(userId, subjectId) {
        return this.getSummary(userId, subjectId);
    }

    static async getConceptMastery(userId, subjectId) {
        const result = await this.getConcepts(userId, subjectId);
        return result.concepts;
    }

    static async getTrends(userId, subjectId) {
        return this.getProgress(userId, subjectId);
    }

    static async getFullAnalytics(userId, subjectId) {
        return this.getDashboard(userId, subjectId, { refresh: true });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE
    // ═══════════════════════════════════════════════════════════════════════════

    /** Full dashboard computed via the analytics engine (refresh=true path). */
    static async #buildDashboardFromEngine(userId, subjectId) {
        const [quizRows, flashRows, examRows, conceptScoreRows, subjectRes] = await Promise.all([
            query(
                `SELECT qr.is_correct, qr.difficulty, qr.topic_name, qa.completed_at, qa.id AS attempt_id
                 FROM quiz_responses qr
                 JOIN quiz_attempts qa ON qa.id = qr.attempt_id
                 WHERE qa.user_id = $1 AND qa.subject_id = $2 ORDER BY qa.completed_at ASC`,
                [userId, subjectId]
            ),
            query(
                `SELECT external_card_id AS card_id, outcome, days_since_last, topic_name, reviewed_at
                 FROM flashcard_reviews
                 WHERE user_id = $1
                   AND material_id IN (SELECT id FROM materials WHERE subject_id = $2 AND deleted_at IS NULL)
                 ORDER BY reviewed_at ASC`,
                [userId, subjectId]
            ),
            query(
                `SELECT score, max_score, completed_at, duration_seconds, attempt_number
                 FROM mock_exam_attempts WHERE user_id = $1 AND subject_id = $2 ORDER BY completed_at ASC`,
                [userId, subjectId]
            ),
            query(
                `SELECT ecs.topic_name, ecs.score, ecs.max_score, ecs.question_count, mea.attempt_number, mea.completed_at
                 FROM exam_concept_scores ecs
                 JOIN mock_exam_attempts mea ON mea.id = ecs.attempt_id
                 WHERE mea.user_id = $1 AND mea.subject_id = $2 ORDER BY mea.completed_at ASC`,
                [userId, subjectId]
            ),
            query('SELECT name FROM subjects WHERE id = $1 AND user_id = $2 LIMIT 1', [subjectId, userId]),
        ]);

        const quizResponses    = quizRows.rows.map((r)  => ({ isCorrect: r.is_correct, difficulty: r.difficulty, completedAt: r.completed_at, attemptId: r.attempt_id, topicName: r.topic_name }));
        const flashcardReviews = flashRows.rows.map((r) => ({ cardId: r.card_id ?? 'unknown', outcome: r.outcome, daysSinceLast: r.days_since_last, reviewedAt: r.reviewed_at, topicName: r.topic_name }));
        const examAttempts     = examRows.rows.map((r)  => ({ score: r.score, maxScore: r.max_score, completedAt: r.completed_at, durationSeconds: r.duration_seconds, attemptNumber: r.attempt_number }));

        const cbMap = new Map();
        for (const r of conceptScoreRows.rows) {
            const key = `${r.attempt_number}_${new Date(r.completed_at).toISOString()}`;
            if (!cbMap.has(key)) cbMap.set(key, []);
            cbMap.get(key).push({ conceptName: r.topic_name, score: r.score, maxScore: r.max_score, questionCount: r.question_count });
        }
        for (const a of examAttempts) {
            const key = `${a.attemptNumber}_${new Date(a.completedAt).toISOString()}`;
            a.conceptBreakdown = cbMap.get(key) ?? [];
        }

        const engineScores = computeAllScores({ quizResponses, flashcardReviews, examAttempts });
        const engineReport = computeConceptReport({ quizResponses, flashcardReviews, examAttempts });
        const conceptList  = [...engineReport.concepts.values()];
        const weakConcepts = engineReport.weakConcepts.slice(0, 5).map((c) => ({
            name:           c.conceptName,
            crs:            Math.round(c.crs * 1000) / 10,
            state:          c.state,
            weakness_score: Math.round(c.weaknessScore * 1000) / 1000,
            trend:          c.trendLabel,
            action:         c.action,
        }));

        return {
            subject:   { id: subjectId, name: subjectRes.rows[0]?.name ?? null },
            readiness: {
                score:              engineScores.readiness,
                label:              classifyDBScore(engineScores.readiness),
                confidence:         Math.round((engineScores.confidence ?? 0) * 100) / 100,
                data_quality:       engineScores.metadata.dataQuality,
                snapshot_age_hours: null,
            },
            breakdown: {
                understanding: engineScores.understanding !== null ? { score: Math.round((engineScores.understanding ?? 0) * 1000) / 10, source: 'quizzes',    based_on: engineScores.metadata.quizCount      } : null,
                retention:     engineScores.retention     !== null ? { score: Math.round((engineScores.retention     ?? 0) * 1000) / 10, source: 'flashcards', based_on: engineScores.metadata.flashcardCount  } : null,
                mastery:       engineScores.mastery       !== null ? { score: Math.round((engineScores.mastery       ?? 0) * 1000) / 10, source: 'exams',      based_on: engineScores.metadata.examCount       } : null,
            },
            meta: {
                consistency: engineScores.consistency !== null ? Math.round(engineScores.consistency * 100) / 100 : null,
                trend:       engineScores.trend,
                total_interactions: engineScores.metadata.totalInteractions,
                last_activity_at:   null,
            },
            weak_concepts:         weakConcepts,
            next_suggested_action: weakConcepts[0] ? this.#suggestAction(weakConcepts[0]) : null,
        };
    }

    static #suggestAction(weakestConcept) {
        return {
            type:    weakestConcept.scores?.retention < weakestConcept.scores?.understanding ? 'flashcard_review' : 'quiz',
            concept: weakestConcept.name,
            reason:  `${weakestConcept.state === 'critical' ? 'Critical gap' : 'Weak area'} in ${weakestConcept.name}`,
        };
    }

    static #groupByAttempt(rows) {
        const sessions = new Map();
        for (const r of rows) {
            const key = r.attempt_id;
            if (!sessions.has(key)) sessions.set(key, { correct: 0, total: 0, date: r.completed_at });
            const s = sessions.get(key);
            s.correct += r.is_correct ? 1 : 0;
            s.total   += 1;
        }
        return [...sessions.values()]
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map((s) => ({ date: s.date, accuracy: Math.round((s.correct / s.total) * 1000) / 10, source: 'quiz_session' }));
    }

    static #combinedTrend(quizAccuracies, examAccuracies) {
        const tQ = computeTrend(quizAccuracies);
        const tE = computeTrend(examAccuracies);
        let combined = null;
        if (tQ !== null && tE !== null) combined = 0.40 * tQ + 0.60 * tE;
        else if (tE !== null)           combined = tE;
        else if (tQ !== null)           combined = tQ;
        return { value: combined, label: trendLabel(combined) };
    }

    static #emptyDashboard(subjectId) {
        return {
            subject:              { id: subjectId, name: null },
            readiness:            { score: 0, label: 'unstarted', confidence: 0, data_quality: 'insufficient', snapshot_age_hours: null },
            breakdown:            { understanding: null, retention: null, mastery: null },
            meta:                 { consistency: null, trend: { value: null, label: 'insufficient_data' }, total_interactions: 0, last_activity_at: null },
            weak_concepts:        [],
            next_suggested_action: null,
        };
    }

    static async #refreshMastery(userId, subjectId) {
        const [quizRes, examRes, flashRes] = await Promise.all([
            query(
                `SELECT qr.topic_name,
                        ROUND(AVG(qr.is_correct::int) * 100, 2) AS quiz_accuracy,
                        COUNT(*) AS quiz_count,
                        MAX(qa.completed_at) AS last_at
                 FROM quiz_responses qr
                 JOIN quiz_attempts qa ON qa.id = qr.attempt_id
                 WHERE qa.user_id = $1 AND qa.subject_id = $2 AND qr.topic_name IS NOT NULL
                 GROUP BY qr.topic_name`,
                [userId, subjectId]
            ),
            query(
                `SELECT ecs.topic_name,
                        ROUND(SUM(ecs.score)::numeric / NULLIF(SUM(ecs.max_score),0) * 100, 2) AS exam_accuracy,
                        SUM(ecs.question_count) AS exam_count,
                        MAX(mea.completed_at) AS last_at
                 FROM exam_concept_scores ecs
                 JOIN mock_exam_attempts mea ON mea.id = ecs.attempt_id
                 WHERE mea.user_id = $1 AND mea.subject_id = $2 AND ecs.topic_name IS NOT NULL
                 GROUP BY ecs.topic_name`,
                [userId, subjectId]
            ),
            query(
                `SELECT fr.topic_name,
                        ROUND(AVG(CASE WHEN fr.outcome IN ('good','easy') THEN 1.0 ELSE 0.0 END) * 100, 2) AS flashcard_retention,
                        COUNT(*) AS flash_count,
                        MAX(fr.reviewed_at) AS last_at
                 FROM flashcard_reviews fr
                 WHERE fr.user_id = $1
                   AND fr.material_id IN (SELECT id FROM materials WHERE subject_id = $2 AND deleted_at IS NULL)
                   AND fr.reviewed_at >= NOW() - INTERVAL '30 days'
                   AND fr.topic_name IS NOT NULL
                 GROUP BY fr.topic_name`,
                [userId, subjectId]
            ),
        ]);

        const topics = new Map();
        const get    = (t) => topics.get(t) ?? (topics.set(t, { quiz: null, flash: null, exam: null, count: 0, last: null }), topics.get(t));

        for (const r of quizRes.rows)  { const t = get(r.topic_name); t.quiz  = f(r.quiz_accuracy);        t.count += i(r.quiz_count);  if (!t.last || r.last_at > t.last) t.last = r.last_at; }
        for (const r of examRes.rows)  { const t = get(r.topic_name); t.exam  = f(r.exam_accuracy);        t.count += i(r.exam_count);  if (!t.last || r.last_at > t.last) t.last = r.last_at; }
        for (const r of flashRes.rows) { const t = get(r.topic_name); t.flash = f(r.flashcard_retention);  t.count += i(r.flash_count); if (!t.last || r.last_at > t.last) t.last = r.last_at; }

        for (const [topicName, data] of topics.entries()) {
            const mastery = weightedComposite(data.quiz, data.flash, data.exam);
            await query(
                `INSERT INTO user_concept_mastery
                    (user_id, subject_id, topic_name, quiz_accuracy, flashcard_retention,
                     exam_accuracy, mastery_score, response_count, last_activity_at, updated_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
                 ON CONFLICT (user_id, subject_id, topic_name) DO UPDATE SET
                    quiz_accuracy       = EXCLUDED.quiz_accuracy,
                    flashcard_retention = EXCLUDED.flashcard_retention,
                    exam_accuracy       = EXCLUDED.exam_accuracy,
                    mastery_score       = EXCLUDED.mastery_score,
                    response_count      = EXCLUDED.response_count,
                    last_activity_at    = EXCLUDED.last_activity_at,
                    updated_at          = NOW()`,
                [userId, subjectId, topicName, data.quiz, data.flash, data.exam, mastery, data.count, data.last]
            );
        }
    }
}

export default AnalyticsService;

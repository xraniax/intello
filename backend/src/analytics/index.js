/**
 * Learning Analytics Engine — public API surface.
 *
 * Two entry points:
 *
 *   computeAllScores(data)    → subject-level metrics
 *   computeConceptReport(data) → per-concept breakdown + weak concepts
 *
 * All functions are pure (no DB, no side effects).
 * Pass raw data from the DB; receive computed metrics.
 *
 * ─── Input shapes ─────────────────────────────────────────────────────────────
 *
 * quizResponses: [{
 *   isCorrect:   boolean,
 *   difficulty:  number | 'easy'|'medium'|'hard'|'Introductory'|'Intermediate'|'Advanced',
 *   completedAt: string | Date,
 *   attemptId?:  string,       // groups responses into sessions for trend/consistency
 *   concepts?:   { [name]: weight },  // for per-concept scoring
 * }]
 *
 * flashcardReviews: [{
 *   cardId:        string,
 *   outcome:       'again'|'hard'|'good'|'easy',
 *   daysSinceLast: number | null,  // null = first review of this card
 *   reviewedAt:    string | Date,
 *   concepts?:     { [name]: weight },
 * }]
 *
 * examAttempts: [{
 *   score:            number,   // correct answers
 *   maxScore:         number,   // total questions
 *   completedAt:      string | Date,
 *   durationSeconds?: number,
 *   conceptBreakdown?: [{       // for per-concept mastery
 *     conceptName: string,
 *     score:       number,
 *     maxScore:    number,
 *   }],
 * }]
 */

export { computeUnderstandingScore, updateUnderstanding, createUnderstandingState, responsesToAttemptAccuracies } from './understanding.js';
export { computeRetentionScore, updateRetention, createRetentionState, outcomeToScore, computeCardRetentionMap } from './retention.js';
export { computeMasteryScore, updateMastery, createMasteryState, attemptsToAccuracies, computeTopicMasteryMap } from './mastery.js';
export { computeReadinessScore, computeConfidence, computeSourceConfidence, computeOverallConsistency, computeOverallTrend, classifyCRS, computeWeaknessScore, dataQualityLabel } from './readiness.js';
export { computeConceptScores, detectWeakConcepts, applyQuizResponseToConcepts, applyFlashcardReviewToConcepts, applyExamResultToConcepts, createConceptState, computeConceptReadiness } from './concepts.js';
export { recencyWeight, difficultyWeight, normalizeDifficulty, computeVariance, computeConsistency, computeTrend, trendLabel, daysBetween, clamp } from './utils.js';

import { computeUnderstandingScore } from './understanding.js';
import { computeRetentionScore }     from './retention.js';
import { computeMasteryScore }       from './mastery.js';
import {
    computeReadinessScore,
    computeConfidence,
    computeOverallConsistency,
    computeOverallTrend,
    dataQualityLabel,
} from './readiness.js';
import { computeConceptScores, detectWeakConcepts } from './concepts.js';

// ─── Subject-level entry point ────────────────────────────────────────────────

/**
 * Compute all subject-level analytics metrics from raw interaction data.
 *
 * @param {{
 *   quizResponses:    object[],
 *   flashcardReviews: object[],
 *   examAttempts:     object[],
 * }} data
 *
 * @returns {{
 *   understanding: number|null,
 *   retention:     number|null,
 *   mastery:       number|null,
 *   readiness:     number,        — 0–100
 *   confidence:    number,        — 0–1
 *   consistency:   number|null,   — 0–1
 *   trend: {
 *     quiz:     number|null,
 *     exam:     number|null,
 *     combined: number|null,
 *     label:    string,
 *   },
 *   metadata: {
 *     quizCount:         number,
 *     flashcardCount:    number,
 *     examCount:         number,
 *     totalInteractions: number,
 *     dataQuality:       string,
 *   },
 * }}
 */
export function computeAllScores({
    quizResponses    = [],
    flashcardReviews = [],
    examAttempts     = [],
} = {}) {
    const understanding = computeUnderstandingScore(quizResponses);
    const retention     = computeRetentionScore(flashcardReviews);
    const mastery       = computeMasteryScore(examAttempts);

    const counts = {
        quizCount:      quizResponses.length,
        flashcardCount: flashcardReviews.length,
        examCount:      examAttempts.length,
    };
    const confidence = computeConfidence(counts);

    const readiness    = computeReadinessScore({ understanding, retention, mastery, confidence });
    const consistency  = computeOverallConsistency({ quizResponses, examAttempts });
    const trend        = computeOverallTrend({ quizResponses, examAttempts });

    return {
        understanding,
        retention,
        mastery,
        readiness,
        confidence,
        consistency,
        trend,
        metadata: {
            ...counts,
            totalInteractions: counts.quizCount + counts.flashcardCount + counts.examCount,
            dataQuality:       dataQualityLabel(confidence),
        },
    };
}

// ─── Per-concept entry point ──────────────────────────────────────────────────

/**
 * Compute per-concept readiness scores and identify weak concepts.
 *
 * Requires interactions to include concept attribution weights.
 * Interactions without `concepts` are treated as unattributed and ignored
 * by the concept engine (they still count toward subject-level scores).
 *
 * @param {{
 *   quizResponses:    object[],
 *   flashcardReviews: object[],
 *   examAttempts:     object[],  — must include conceptBreakdown for concept mastery
 * }} data
 *
 * @returns {{
 *   concepts: Map<string, {
 *     conceptName:   string,
 *     understanding: number,
 *     retention:     number,
 *     mastery:       number|null,
 *     crs:           number,
 *     confidence:    number,
 *     state:         'critical'|'weak'|'developing'|'mastered'|'unstarted',
 *     nInteractions: number,
 *     lastUpdated:   string|null,
 *   }>,
 *   weakConcepts: Array<{
 *     conceptName:   string,
 *     crs:           number,
 *     state:         string,
 *     weaknessScore: number,
 *     trend:         number|null,
 *     trendLabel:    string,
 *     action:        'urgent_review'|'scheduled_review'|'monitor',
 *   }>,
 * }}
 */
export function computeConceptReport({
    quizResponses    = [],
    flashcardReviews = [],
    examAttempts     = [],
} = {}) {
    // Only pass interactions that have concept attribution
    const conceptExamResults = examAttempts.map((a) => ({
        completedAt:      a.completedAt,
        conceptBreakdown: a.conceptBreakdown ?? [],
    }));

    const concepts     = computeConceptScores({
        quizResponses:    quizResponses.filter((r) => r.concepts),
        flashcardReviews: flashcardReviews.filter((r) => r.concepts),
        examResults:      conceptExamResults,
    });

    const weakConcepts = detectWeakConcepts(concepts);

    return { concepts, weakConcepts };
}

// ─── Combined report ──────────────────────────────────────────────────────────

/**
 * Convenience function: compute both subject-level and concept-level reports.
 *
 * @param {object} data - Same shape as computeAllScores input
 * @returns {{ scores: object, report: object }}
 */
export function computeFullAnalytics(data = {}) {
    return {
        scores: computeAllScores(data),
        report: computeConceptReport(data),
    };
}

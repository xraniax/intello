/**
 * Readiness Score and supporting meta-metrics:
 *   - Confidence  (how much data backs this score?)
 *   - Consistency (how stable is the student's performance?)
 *   - Trend       (improving, plateauing, or declining?)
 *
 * All functions are pure and stateless.
 */

import {
    READINESS_WEIGHTS,
    CONFIDENCE_PENALTY,
    CONFIDENCE_TAU,
    DATA_QUALITY_THRESHOLDS,
} from './constants.js';

import {
    computeVariance,
    computeConsistency,
    computeTrend,
    trendLabel,
    clamp,
} from './utils.js';

import { responsesToAttemptAccuracies } from './understanding.js';
import { attemptsToAccuracies }         from './mastery.js';

// ─── Confidence ───────────────────────────────────────────────────────────────

/**
 * Confidence for a single data source.
 *
 * Uses exponential saturation: C = 1 − e^{−n/τ}
 *   - n=0  → C=0   (no data, no confidence)
 *   - n=τ  → C≈0.63
 *   - n=3τ → C≈0.95 (near full confidence)
 *
 * WHY EXPONENTIAL: The first few observations shift belief dramatically;
 * each additional data point past the plateau contributes diminishing value.
 *
 * @param {number} n   - Interaction count for this source
 * @param {number} tau - Characteristic sample size (from CONFIDENCE_TAU)
 * @returns {number} Confidence in [0, 1]
 */
export function computeSourceConfidence(n, tau) {
    if (!n || n <= 0) return 0;
    return 1 - Math.exp(-n / tau);
}

/**
 * Aggregate confidence across all data sources, weighted by their importance.
 * Sources with zero interactions are excluded from the denominator — they
 * don't drag down confidence; they just don't contribute to it.
 *
 * @param {{
 *   quizCount:      number,
 *   flashcardCount: number,
 *   examCount:      number,
 * }} counts
 * @returns {number} Aggregate confidence in [0, 1]
 */
export function computeConfidence({ quizCount = 0, flashcardCount = 0, examCount = 0 }) {
    const sources = [
        { c: computeSourceConfidence(examCount,      CONFIDENCE_TAU.exam),      w: READINESS_WEIGHTS.exam      },
        { c: computeSourceConfidence(quizCount,      CONFIDENCE_TAU.quiz),      w: READINESS_WEIGHTS.quiz      },
        { c: computeSourceConfidence(flashcardCount, CONFIDENCE_TAU.flashcard), w: READINESS_WEIGHTS.flashcard },
    ].filter((s) => s.c > 0);

    if (!sources.length) return 0;

    const totalW = sources.reduce((s, src) => s + src.w, 0);
    return sources.reduce((sum, src) => sum + (src.w / totalW) * src.c, 0);
}

/**
 * Human-readable data quality label from a confidence score.
 *
 * @param {number} confidence
 * @returns {'high'|'moderate'|'low'|'insufficient'}
 */
export function dataQualityLabel(confidence) {
    if (confidence >= DATA_QUALITY_THRESHOLDS.high)     return 'high';
    if (confidence >= DATA_QUALITY_THRESHOLDS.moderate) return 'moderate';
    if (confidence >= DATA_QUALITY_THRESHOLDS.low)      return 'low';
    return 'insufficient';
}

// ─── Final Readiness Score ────────────────────────────────────────────────────

/**
 * Compute the Final Readiness Score (0–100).
 *
 * Formula:
 *   S̃ = Σ (w_src · score_src) / Σ w_src      (normalized over available sources)
 *   S  = S̃ · (1 − penalty · (1 − C))         (confidence correction)
 *
 * WHY CONFIDENCE CORRECTION:
 *   A student with 2 quiz attempts should not display "92% ready" with confidence.
 *   The penalty shrinks the score toward 0 proportionally to how much data is missing.
 *
 * @param {{
 *   understanding: number|null,
 *   retention:     number|null,
 *   mastery:       number|null,
 *   confidence:    number,
 * }} scores
 *
 * @returns {number} Readiness in [0, 100], one decimal place
 */
export function computeReadinessScore({ understanding, retention, mastery, confidence }) {
    const sources = [
        { value: mastery,       weight: READINESS_WEIGHTS.exam      },
        { value: understanding, weight: READINESS_WEIGHTS.quiz      },
        { value: retention,     weight: READINESS_WEIGHTS.flashcard },
    ].filter((s) => s.value !== null && s.value !== undefined && !isNaN(s.value));

    if (!sources.length) return 0;

    const totalW   = sources.reduce((s, src) => s + src.weight, 0);
    const rawScore = sources.reduce((s, src) => s + (src.weight / totalW) * src.value, 0);

    const corrected = rawScore * (1 - CONFIDENCE_PENALTY * (1 - (confidence ?? 0)));

    // Round to one decimal in [0, 100]
    return Math.round(clamp(corrected) * 1000) / 10;
}

// ─── Consistency ──────────────────────────────────────────────────────────────

/**
 * Cross-source consistency score.
 *
 * Combines quiz and exam performance sequences, each normalized to [0,1].
 * Weights exam consistency more because exam scores are less noisy than
 * individual question-level results.
 *
 * @param {{
 *   quizResponses: object[],
 *   examAttempts:  object[],
 * }} data
 * @returns {number|null} Consistency in [0, 1], or null if insufficient data
 */
export function computeOverallConsistency({ quizResponses = [], examAttempts = [] }) {
    const quizAccuracies = responsesToAttemptAccuracies(quizResponses);
    const examAccuracies = attemptsToAccuracies(examAttempts);

    const kQuiz = computeConsistency(quizAccuracies, 10);  // last 10 quiz sessions
    const kExam = computeConsistency(examAccuracies);

    if (kQuiz === null && kExam === null) return null;

    // Weighted average over available sources
    let num = 0, den = 0;
    if (kQuiz !== null) { num += 0.40 * kQuiz; den += 0.40; }
    if (kExam !== null) { num += 0.60 * kExam; den += 0.60; }

    return clamp(num / den);
}

// ─── Trend ────────────────────────────────────────────────────────────────────

/**
 * Compute trend across all available performance signals.
 * Returns per-source trends and a combined summary.
 *
 * @param {{
 *   quizResponses: object[],
 *   examAttempts:  object[],
 * }} data
 * @returns {{
 *   quiz:     number|null,
 *   exam:     number|null,
 *   combined: number|null,
 *   label:    string,
 * }}
 */
export function computeOverallTrend({ quizResponses = [], examAttempts = [] }) {
    const quizAccuracies = responsesToAttemptAccuracies(quizResponses);
    const examAccuracies = attemptsToAccuracies(examAttempts);

    const tQuiz = computeTrend(quizAccuracies);
    const tExam = computeTrend(examAccuracies);

    // Combined: weighted average of available trends (exam weighted higher)
    let combined = null;
    if (tQuiz !== null && tExam !== null) {
        combined = 0.40 * tQuiz + 0.60 * tExam;
    } else if (tExam !== null) {
        combined = tExam;
    } else if (tQuiz !== null) {
        combined = tQuiz;
    }

    return {
        quiz:     tQuiz,
        exam:     tExam,
        combined,
        label:    trendLabel(combined),
    };
}

// ─── Weakness threshold logic ─────────────────────────────────────────────────

const BASE_THRESHOLDS = {
    critical:   0.40,
    weak:       0.60,
    developing: 0.80,
};

/**
 * Classify a Concept Readiness Score into a performance state.
 *
 * Thresholds adjust dynamically based on:
 *   - Confidence: low data → lower thresholds (don't flag sparse data as critical)
 *   - Trend: declining concept → higher weak threshold (more urgency)
 *
 * @param {number}      crs        - Concept Readiness Score in [0, 1]
 * @param {number}      confidence - C in [0, 1]
 * @param {number|null} trend      - T in [-1, 1]
 * @returns {'critical'|'weak'|'developing'|'mastered'}
 */
export function classifyCRS(crs, confidence = 1, trend = null) {
    const t = { ...BASE_THRESHOLDS };

    // Low confidence: relax thresholds — don't punish sparse data
    if (confidence < 0.4) {
        t.critical   -= 0.10;
        t.weak       -= 0.10;
        t.developing -= 0.10;
    }

    // Declining trend: raise the weak threshold — more urgency
    if (trend !== null && trend < -0.3) {
        t.weak += 0.05;
    }

    if (crs < t.critical)   return 'critical';
    if (crs < t.weak)       return 'weak';
    if (crs < t.developing) return 'developing';
    return 'mastered';
}

/**
 * Compute the Weakness Score W_c — used to rank concepts by urgency.
 *
 *   W_c = (1 − CRS) · (1 + γ_T · max(−T, 0)) · f_c
 *
 *   - Gap term:    (1 − CRS)               how far from mastery
 *   - Trend term:  (1 + 0.5 · |decline|)   amplify declining concepts
 *   - Frequency:   min(n/20, 1)             dampen concepts with < 3 interactions
 *
 * @param {number}      crs          - Concept Readiness Score in [0, 1]
 * @param {number|null} trend        - Trend T in [-1, 1]
 * @param {number}      nInteractions
 * @returns {number} Weakness score ≥ 0 (higher = more urgent)
 */
export function computeWeaknessScore(crs, trend = null, nInteractions = 0) {
    const gap          = 1 - clamp(crs);
    const trendPenalty = trend !== null ? Math.max(-trend, 0) : 0;
    const frequency    = Math.min(nInteractions / 20, 1);

    return gap * (1 + 0.5 * trendPenalty) * frequency;
}

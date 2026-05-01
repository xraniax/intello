/**
 * Understanding Score — measures quiz-based conceptual comprehension.
 *
 * Implements two computation modes:
 *   1. Batch   — full-history weighted sum (used for dashboard / mastery refresh)
 *   2. Incremental — EMA update (used for real-time per-question feedback)
 *
 * WHY NOT A NAIVE AVERAGE:
 *   - A correct answer from 3 months ago does not prove current understanding.
 *   - Answering a difficulty-5 question correctly is stronger signal than a difficulty-1.
 *   Both are accounted for via recency decay and pool-relative difficulty weighting.
 */

import {
    UNDERSTANDING_HALF_LIFE_DAYS,
    EMA_LEARNING_RATE,
} from './constants.js';

import {
    daysBetween,
    recencyWeight,
    applyDecay,
    normalizeDifficulty,
    difficultyWeight,
    difficultyScaledAlpha,
    clamp,
} from './utils.js';

// ─── Batch computation ────────────────────────────────────────────────────────

/**
 * Compute Understanding Score from a full list of historical quiz responses.
 *
 * Formula:
 *   w_i  = (d_i / d̄) · e^{-λ · Δt_i}      (combined weight)
 *   U    = Σ w_i · c_i  /  Σ w_i
 *
 * @param {Array<{
 *   isCorrect:   boolean,
 *   difficulty:  number|string,
 *   completedAt: string|Date,
 * }>} responses - Quiz question responses, any order
 *
 * @returns {number|null} Score in [0, 1], or null if no data
 */
export function computeUnderstandingScore(responses) {
    if (!responses?.length) return null;

    const now       = new Date();
    const diffs     = responses.map((r) => normalizeDifficulty(r.difficulty));
    const poolMean  = diffs.reduce((s, d) => s + d, 0) / diffs.length;

    let numerator   = 0;
    let denominator = 0;

    for (let i = 0; i < responses.length; i++) {
        const r       = responses[i];
        const d       = diffs[i];
        const daysSince = daysBetween(r.completedAt, now);

        const wDiff = difficultyWeight(d, poolMean);
        const wTime = recencyWeight(daysSince, UNDERSTANDING_HALF_LIFE_DAYS);
        const w     = wDiff * wTime;

        numerator   += w * (r.isCorrect ? 1 : 0);
        denominator += w;
    }

    return denominator > 1e-12 ? clamp(numerator / denominator) : null;
}

// ─── Incremental EMA state ────────────────────────────────────────────────────

/**
 * Create the initial EMA state for a new (student, concept) pair.
 * The prior is 0.5 — maximum uncertainty.
 *
 * @returns {UnderstandingState}
 */
export function createUnderstandingState() {
    return {
        score:       0.5,     // current U estimate (uninformed prior)
        lastUpdated: null,    // ISO string or null
        nObservations: 0,
    };
}

/**
 * Update the Understanding EMA state with one new quiz response.
 *
 * Steps:
 *   1. Age-decay the current estimate (time since last update).
 *   2. Compute the difficulty-scaled learning rate α.
 *   3. EMA: U ← (1 − α) · U + α · c
 *
 * Returns a NEW state object — pure function, no mutation.
 *
 * @param {UnderstandingState} state   - Current state (from DB or createUnderstandingState)
 * @param {{
 *   isCorrect:   boolean,
 *   difficulty:  number|string,
 *   completedAt: string|Date,
 * }} response - The new quiz response
 *
 * @returns {UnderstandingState} Updated state
 *
 * @typedef {{ score: number, lastUpdated: string|null, nObservations: number }} UnderstandingState
 */
export function updateUnderstanding(state, response) {
    const now        = new Date(response.completedAt ?? new Date());
    const daysSince  = state.lastUpdated ? daysBetween(state.lastUpdated, now) : 0;
    const difficulty = normalizeDifficulty(response.difficulty);

    // Step 1 — decay stale knowledge
    const decayed = applyDecay(state.score, daysSince, UNDERSTANDING_HALF_LIFE_DAYS);

    // Step 2 — difficulty-scaled learning rate
    const alpha = difficultyScaledAlpha(difficulty, EMA_LEARNING_RATE);

    // Step 3 — EMA update
    const updated = (1 - alpha) * decayed + alpha * (response.isCorrect ? 1 : 0);

    return {
        score:         clamp(updated),
        lastUpdated:   now.toISOString(),
        nObservations: state.nObservations + 1,
    };
}

// ─── Per-attempt accuracy (used for trend / consistency upstream) ──────────────

/**
 * Collapse individual responses into per-attempt accuracy values.
 * Groups by day (YYYY-MM-DD) when no explicit attemptId is available.
 *
 * @param {Array<{ isCorrect: boolean, completedAt: string|Date, attemptId?: string }>} responses
 * @returns {number[]} Accuracy values in [0, 1], ordered chronologically
 */
export function responsesToAttemptAccuracies(responses) {
    if (!responses?.length) return [];

    const groupKey = (r) =>
        r.attemptId ?? new Date(r.completedAt).toISOString().slice(0, 10);

    const groups = new Map();
    for (const r of responses) {
        const key = groupKey(r);
        if (!groups.has(key)) groups.set(key, { correct: 0, total: 0, date: r.completedAt });
        const g = groups.get(key);
        g.correct += r.isCorrect ? 1 : 0;
        g.total   += 1;
    }

    return [...groups.values()]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((g) => g.correct / g.total);
}

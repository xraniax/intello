/**
 * Retention Score — measures long-term memory via spaced-repetition flashcard reviews.
 *
 * KEY INSIGHT: Recalling a card correctly after a 30-day gap is far stronger evidence
 * of retention than recalling it 1 day after seeing it. The interval weight captures this.
 *
 * Formula (per card k):
 *   vᵢ   = log₂(1 + δᵢ)                              (interval weight)
 *   wᵢ   = vᵢ · e^{-λ_R · Δtᵢ}                       (interval × recency)
 *   R_k  = Σ wᵢ · oᵢ / Σ wᵢ
 *
 * Concept-level retention:
 *   R    = mean(R_k) across all cards with sufficient data
 */

import {
    RETENTION_HALF_LIFE_DAYS,
    RETENTION_EMA_RATE,
    RETENTION_INTERVAL_REF_DAYS,
    FLASHCARD_OUTCOME_SCORES,
} from './constants.js';

import {
    daysBetween,
    recencyWeight,
    applyDecay,
    groupBy,
    clamp,
} from './utils.js';

const V_MAX = Math.log2(1 + RETENTION_INTERVAL_REF_DAYS); // ≈ 4.95 — normalizer

// ─── Outcome helpers ──────────────────────────────────────────────────────────

/**
 * Map a flashcard review outcome string to a numeric score.
 * Returns 0 for unknown outcomes (conservative — treat as failure).
 *
 * @param {'again'|'hard'|'good'|'easy'} outcome
 * @returns {number} Score in {0, 0.33, 0.67, 1.0}
 */
export function outcomeToScore(outcome) {
    return FLASHCARD_OUTCOME_SCORES[outcome] ?? 0;
}

// ─── Batch computation ────────────────────────────────────────────────────────

/**
 * Compute the Retention Score from a list of flashcard review events.
 *
 * Each review must have:
 *   - cardId: string           — groups reviews by card
 *   - outcome: 'again'|'hard'|'good'|'easy'
 *   - daysSinceLast: number|null  — null or 0 means first-ever review (excluded)
 *   - reviewedAt: string|Date
 *
 * @param {Array<{
 *   cardId:        string,
 *   outcome:       string,
 *   daysSinceLast: number|null,
 *   reviewedAt:    string|Date,
 * }>} reviews
 *
 * @returns {number|null} Retention score in [0, 1], or null if no valid data
 */
export function computeRetentionScore(reviews) {
    if (!reviews?.length) return null;

    const now        = new Date();
    const cardGroups = groupBy(reviews, (r) => r.cardId ?? 'unknown');
    const cardScores = [];

    for (const [, cardReviews] of cardGroups) {
        const score = _computeCardRetention(cardReviews, now);
        if (score !== null) cardScores.push(score);
    }

    if (!cardScores.length) return null;

    // Simple mean across cards: each card tests one atomic piece of knowledge
    return clamp(cardScores.reduce((s, v) => s + v, 0) / cardScores.length);
}

/**
 * Compute weighted retention for a single card's review history.
 *
 * Excludes first reviews (δ=0 or null): no interval → no retention signal.
 *
 * @param {object[]} reviews - All reviews for one card, any order
 * @param {Date}     now
 * @returns {number|null}
 */
function _computeCardRetention(reviews, now) {
    const sorted = [...reviews].sort(
        (a, b) => new Date(a.reviewedAt) - new Date(b.reviewedAt)
    );

    let numerator   = 0;
    let denominator = 0;

    for (const r of sorted) {
        const delta = r.daysSinceLast;

        // Skip first-ever reviews — without a prior interval there is no retention signal
        if (delta === null || delta === undefined || delta <= 0) continue;

        const o      = outcomeToScore(r.outcome);
        const v      = Math.log2(1 + delta);                                 // interval weight
        const wTime  = recencyWeight(daysBetween(r.reviewedAt, now), RETENTION_HALF_LIFE_DAYS);
        const w      = v * wTime;

        numerator   += w * o;
        denominator += w;
    }

    return denominator > 1e-12 ? numerator / denominator : null;
}

// ─── Incremental EMA state ────────────────────────────────────────────────────

/**
 * Create the initial retention state for a new card.
 *
 * @returns {RetentionState}
 */
export function createRetentionState() {
    return {
        score:         0.5,    // prior: maximum uncertainty
        easeFactor:    2.50,   // SM-2 E-factor
        intervalDays:  1,
        lastReviewed:  null,
        nReviews:      0,
    };
}

/**
 * Update a card's retention state with one new review event.
 *
 * Steps:
 *   1. Apply time decay to the current estimate.
 *   2. Compute interval weight v = log₂(1 + δ).
 *   3. EMA update: R_k ← (1 − β·v/v_max) · R_k + (β·v/v_max) · o
 *      — stronger interval → new observation has more influence.
 *   4. Update SM-2 E-factor and next interval.
 *
 * Returns a NEW state object — pure function.
 *
 * @param {RetentionState} state
 * @param {{
 *   outcome:       string,
 *   daysSinceLast: number|null,
 *   reviewedAt:    string|Date,
 * }} review
 *
 * @returns {RetentionState}
 *
 * @typedef {{
 *   score: number, easeFactor: number, intervalDays: number,
 *   lastReviewed: string|null, nReviews: number
 * }} RetentionState
 */
export function updateRetention(state, review) {
    const now        = new Date(review.reviewedAt ?? new Date());
    const daysSince  = state.lastReviewed ? daysBetween(state.lastReviewed, now) : 0;
    const delta      = review.daysSinceLast;
    const o          = outcomeToScore(review.outcome);

    // Step 1 — decay
    const decayed = applyDecay(state.score, daysSince, RETENTION_HALF_LIFE_DAYS);

    // Step 2 & 3 — interval-weighted EMA (skip if first review)
    let updated = decayed;
    if (delta !== null && delta !== undefined && delta > 0) {
        const v    = Math.log2(1 + delta);
        const beta = RETENTION_EMA_RATE * clamp(v / V_MAX);
        updated    = (1 - beta) * decayed + beta * o;
    }

    // Step 4 — update SM-2 E-factor (simplified)
    const grade     = _outcomeToGrade(review.outcome);   // 0–4
    const newEase   = clamp(state.easeFactor + (0.1 - (4 - grade) * (0.08 + (4 - grade) * 0.02)), 1.3, 2.5);
    const newInterval = grade < 2
        ? 1
        : Math.round(state.intervalDays * newEase);

    return {
        score:        clamp(updated),
        easeFactor:   newEase,
        intervalDays: newInterval,
        lastReviewed: now.toISOString(),
        nReviews:     state.nReviews + 1,
    };
}

/**
 * Map outcome to SM-2 grade 0–4.
 */
function _outcomeToGrade(outcome) {
    return { again: 0, hard: 2, good: 3, easy: 4 }[outcome] ?? 1;
}

// ─── Card-level scores for concept aggregation ────────────────────────────────

/**
 * Return per-card retention scores suitable for concept-level aggregation.
 * Used by the concept engine to weight card contributions by concept membership.
 *
 * @param {object[]} reviews - All reviews across any number of cards
 * @returns {Map<string, number>} cardId → score in [0, 1]
 */
export function computeCardRetentionMap(reviews) {
    if (!reviews?.length) return new Map();

    const now        = new Date();
    const cardGroups = groupBy(reviews, (r) => r.cardId ?? 'unknown');
    const result     = new Map();

    for (const [cardId, cardReviews] of cardGroups) {
        const score = _computeCardRetention(cardReviews, now);
        if (score !== null) result.set(cardId, score);
    }

    return result;
}

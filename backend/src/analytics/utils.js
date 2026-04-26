/**
 * Pure utility functions used across the analytics engine.
 * No side effects, no imports from outside this module.
 */

import {
    DIFFICULTY_LABEL_MAP,
    MAX_DIFFICULTY,
    TREND_LAMBDA,
    TREND_SCALE,
} from './constants.js';

// ─── Time ─────────────────────────────────────────────────────────────────────

/**
 * Fractional days between two Date-compatible values.
 * Result is always >= 0; `later` defaults to now.
 */
export function daysBetween(earlier, later = new Date()) {
    const ms = new Date(later).getTime() - new Date(earlier).getTime();
    return Math.max(0, ms / 86_400_000);
}

// ─── Recency weighting ────────────────────────────────────────────────────────

/**
 * Exponential decay weight: 1.0 at t=0, 0.5 at t=halfLifeDays, approaching 0.
 *
 * Use this to downweight old observations continuously:
 *   weight = e^{ -λ · Δt }   where λ = ln(2) / halfLifeDays
 *
 * @param {number} daysSince - Age of the observation in days
 * @param {number} halfLifeDays - Days after which weight drops to 0.5
 * @returns {number} Weight in (0, 1]
 */
export function recencyWeight(daysSince, halfLifeDays) {
    if (daysSince <= 0) return 1;
    const lambda = Math.LN2 / halfLifeDays;
    return Math.exp(-lambda * daysSince);
}

/**
 * Apply exponential decay to a current score estimate.
 * Called before incorporating a new observation to age the existing estimate.
 *
 * @param {number} currentValue - Current score in [0, 1]
 * @param {number} daysSince - Days since the estimate was last updated
 * @param {number} halfLifeDays
 * @returns {number} Decayed value
 */
export function applyDecay(currentValue, daysSince, halfLifeDays) {
    return currentValue * recencyWeight(daysSince, halfLifeDays);
}

// ─── Difficulty weighting ─────────────────────────────────────────────────────

/**
 * Normalize a difficulty label or integer to an integer in [1, MAX_DIFFICULTY].
 * Strings like 'easy', 'medium', 'hard', 'Introductory', 'Advanced' are supported.
 *
 * @param {number|string} difficulty
 * @returns {number} Integer difficulty in [1, 5]
 */
export function normalizeDifficulty(difficulty) {
    if (typeof difficulty === 'number') {
        return Math.max(1, Math.min(MAX_DIFFICULTY, Math.round(difficulty)));
    }
    return DIFFICULTY_LABEL_MAP[difficulty] ?? 3;
}

/**
 * Pool-relative difficulty weight for a single observation.
 *
 * Normalizes difficulty against the mean difficulty of the entire question pool
 * so students working on harder material aren't doubly penalized or rewarded.
 *
 *   w_d = d_i / mean(d_all)
 *
 * @param {number} difficulty - Normalized difficulty of this observation [1, 5]
 * @param {number} poolMeanDifficulty - Mean difficulty across all observations in the batch
 * @returns {number} Relative difficulty weight (> 1 for above-average, < 1 for below)
 */
export function difficultyWeight(difficulty, poolMeanDifficulty) {
    return difficulty / (poolMeanDifficulty + 1e-9);
}

/**
 * EMA learning rate scaled by difficulty.
 * Harder questions should move the score estimate more than easy ones.
 *
 *   α = (d / d_max) × η
 *
 * @param {number} difficulty - Normalized difficulty [1, 5]
 * @param {number} learningRate - Base EMA learning rate η (default 0.15)
 * @returns {number} Scaled α in (0, learningRate]
 */
export function difficultyScaledAlpha(difficulty, learningRate) {
    return (difficulty / MAX_DIFFICULTY) * learningRate;
}

// ─── Statistics ───────────────────────────────────────────────────────────────

/**
 * Population variance of an array of numbers.
 *
 * @param {number[]} values
 * @returns {number} Variance (0 if fewer than 2 values)
 */
export function computeVariance(values) {
    if (!values || values.length < 2) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

/**
 * Coefficient of Variation: σ / (μ + ε).
 * Measures relative dispersion — how large is the spread compared to the mean.
 *
 * @param {number[]} values
 * @returns {number|null} CV ≥ 0, or null if insufficient data
 */
export function computeCV(values) {
    if (!values || values.length < 2) return null;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const stdDev = Math.sqrt(computeVariance(values));
    return stdDev / (mean + 0.01);
}

/**
 * Consistency score: how reliably does the student perform?
 *   K = 1 − min(CV, 1)
 *
 * K = 1 means perfectly consistent; K = 0 means completely erratic.
 * Computed over the last N observations (default: all).
 *
 * WHY: A student who scores 85, 86, 84, 87 is more exam-ready than one who
 * scores 30, 95, 40, 100, even if their averages are similar.
 *
 * @param {number[]} values - Ordered sequence of performance values [0, 1]
 * @param {number} [windowSize=Infinity] - Use only the last N values
 * @returns {number|null} Consistency in [0, 1], or null if < 2 values
 */
export function computeConsistency(values, windowSize = Infinity) {
    if (!values || values.length < 2) return null;
    const window = isFinite(windowSize) ? values.slice(-windowSize) : values;
    const cv = computeCV(window);
    if (cv === null) return null;
    return 1 - Math.min(cv, 1);
}

// ─── Trend ────────────────────────────────────────────────────────────────────

/**
 * Compute a trend score using weighted least-squares regression.
 *
 * MORE RECENT observations receive exponentially higher weight, so recent
 * improvement matters more than a rough patch three weeks ago.
 *
 * The raw regression slope is normalized by the student's own performance
 * variance (so a 5% upward slope is significant for a consistent student
 * but noise for an erratic one), then mapped to [-1, +1] via tanh.
 *
 * Formula:
 *   wᵢ = e^{-λ(n-1-i)}                (recency weights, i=0 oldest)
 *   β  = Σwᵢ(xᵢ-x̄ᵥᵥ)(yᵢ-ȳᵥᵥ) / Σwᵢ(xᵢ-x̄ᵥᵥ)²
 *   T  = tanh( β / (σ_y + ε) × γ )
 *
 * @param {number[]} values - Performance values ordered oldest → newest
 * @returns {number|null} Trend in [-1, +1]:
 *   > 0.3  = improving
 *   ±0.3   = plateauing
 *   < -0.3 = declining
 */
export function computeTrend(values) {
    if (!values || values.length < 3) return null;

    const n = values.length;

    // Recency weights: most recent index (n-1) gets weight 1.0
    const weights = values.map((_, i) => Math.exp(-TREND_LAMBDA * (n - 1 - i)));
    const sumW = weights.reduce((s, w) => s + w, 0);

    // Positions x ∈ [1, n], performance values y
    const xs = values.map((_, i) => i + 1);

    const xMeanW = xs.reduce((s, x, i) => s + weights[i] * x, 0) / sumW;
    const yMeanW = values.reduce((s, y, i) => s + weights[i] * y, 0) / sumW;

    // Weighted covariance(x, y) and variance(x)
    let covXY = 0, varX = 0;
    for (let i = 0; i < n; i++) {
        const dx = xs[i] - xMeanW;
        const dy = values[i] - yMeanW;
        covXY += weights[i] * dx * dy;
        varX  += weights[i] * dx * dx;
    }

    const slope  = varX > 1e-12 ? covXY / varX : 0;
    const stdDev = Math.sqrt(computeVariance(values));
    const eps    = 0.01;

    return Math.tanh((slope / (stdDev + eps)) * TREND_SCALE);
}

/**
 * Label a trend value as a human-readable string.
 *
 * @param {number|null} trend
 * @returns {'improving'|'plateauing'|'declining'|'insufficient_data'}
 */
export function trendLabel(trend) {
    if (trend === null) return 'insufficient_data';
    if (trend >  0.3)  return 'improving';
    if (trend < -0.3)  return 'declining';
    return 'plateauing';
}

// ─── Grouping helpers ─────────────────────────────────────────────────────────

/**
 * Group an array of objects by a string key derived from each item.
 *
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string} keyFn
 * @returns {Map<string, T[]>}
 */
export function groupBy(items, keyFn) {
    const map = new Map();
    for (const item of items) {
        const key = keyFn(item);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
    }
    return map;
}

/**
 * Clamp a number to [min, max].
 */
export function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
}

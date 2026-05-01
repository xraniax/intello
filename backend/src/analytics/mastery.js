/**
 * Mastery Score — measures exam-level performance across multiple attempts.
 *
 * WHY NOT A SIMPLE AVERAGE:
 *   The first exam is often exploratory; a student who scored 30% on attempt 1
 *   and 85% on attempt 3 should be rated near 85%, not at 57%.
 *   A linear attempt-number ramp implements this — each attempt is weighted
 *   proportionally to its position in the sequence.
 *
 * WHY √n QUESTION-COUNT SCALING:
 *   Reliability grows sublinearly with question count (law of large numbers).
 *   A 50-question exam is not 10× more informative than a 5-question one.
 *
 * Formula:
 *   w_a = 2a / (A(A+1))      (attempt-number ramp, sums to 1 over A attempts)
 *   φ_a = √(n_a) / √(n_max)  (question-count reliability)
 *   w   = w_a · φ_a
 *   M   = Σ w · s_a / Σ w    where s_a = score_a / maxScore_a
 */

import { clamp } from './utils.js';

// ─── Batch computation ────────────────────────────────────────────────────────

/**
 * Compute Mastery Score from a list of mock exam attempts.
 *
 * @param {Array<{
 *   score:       number,        — correct answers
 *   maxScore:    number,        — total questions
 *   completedAt: string|Date,
 *   durationSeconds?: number,
 * }>} attempts
 *
 * @returns {number|null} Mastery score in [0, 1], or null if no data
 */
export function computeMasteryScore(attempts) {
    if (!attempts?.length) return null;

    // Sort chronologically — attempt number is derived from this order
    const sorted = [...attempts].sort(
        (a, b) => new Date(a.completedAt) - new Date(b.completedAt)
    );

    _validateAttempts(sorted);

    const A      = sorted.length;
    const nMax   = Math.max(...sorted.map((a) => a.maxScore));
    let numSum   = 0;
    let denSum   = 0;

    for (let i = 0; i < A; i++) {
        const attempt = sorted[i];
        const a       = i + 1;                               // 1-indexed attempt number
        const s       = attempt.score / attempt.maxScore;    // percentage score

        const wAttempt = (2 * a) / (A * (A + 1));           // linear ramp, Σ = 1
        const wQuestions = Math.sqrt(attempt.maxScore) / Math.sqrt(nMax); // reliability

        const w   = wAttempt * wQuestions;
        numSum   += w * s;
        denSum   += w;
    }

    return denSum > 1e-12 ? clamp(numSum / denSum) : null;
}

/**
 * Decompose mastery by topic/concept from exam_concept_scores records.
 *
 * Each record is one concept's score within one exam attempt.
 * Returns the mastery score for each topic using the same ramp weighting.
 *
 * @param {Array<{
 *   topicName:     string,
 *   score:         number,
 *   maxScore:      number,
 *   questionCount: number,
 *   attemptNumber: number,
 *   completedAt:   string|Date,
 * }>} conceptScores - All exam_concept_scores rows for this student+subject
 *
 * @returns {Map<string, number>} topicName → mastery in [0, 1]
 */
export function computeTopicMasteryMap(conceptScores) {
    if (!conceptScores?.length) return new Map();

    // Group by topic
    const byTopic = new Map();
    for (const row of conceptScores) {
        if (!byTopic.has(row.topicName)) byTopic.set(row.topicName, []);
        byTopic.get(row.topicName).push(row);
    }

    const result = new Map();
    for (const [topic, rows] of byTopic) {
        // Sort by completedAt or attemptNumber
        const sorted = [...rows].sort(
            (a, b) => (a.attemptNumber ?? 0) - (b.attemptNumber ?? 0)
                   || new Date(a.completedAt) - new Date(b.completedAt)
        );

        const score = _computeTopicMastery(sorted);
        if (score !== null) result.set(topic, score);
    }

    return result;
}

function _computeTopicMastery(sortedRows) {
    const A    = sortedRows.length;
    const nMax = Math.max(...sortedRows.map((r) => r.maxScore));
    let numSum = 0, denSum = 0;

    for (let i = 0; i < A; i++) {
        const row  = sortedRows[i];
        const a    = i + 1;
        const s    = row.score / row.maxScore;
        const wA   = (2 * a) / (A * (A + 1));
        const wN   = Math.sqrt(row.maxScore) / Math.sqrt(nMax);
        const w    = wA * wN;
        numSum    += w * s;
        denSum    += w;
    }

    return denSum > 1e-12 ? clamp(numSum / denSum) : null;
}

// ─── Incremental state ────────────────────────────────────────────────────────

/**
 * Create the initial mastery state for a (student, concept) pair.
 */
export function createMasteryState() {
    return {
        score:      null,   // null until first exam
        nAttempts:  0,
        runningNum: 0,      // weighted numerator
        runningDen: 0,      // weighted denominator
    };
}

/**
 * Incrementally update mastery state with one new exam result for a concept.
 *
 * Because the ramp weight depends on total A, updating incrementally requires
 * re-weighting the running sum. This implementation uses a one-pass update
 * by recomputing only the new attempt's contribution using a fixed α that
 * approximates the ramp for the current attempt number.
 *
 * α = 2(a) / (a(a+1)) = 2/(a+1)  — weight of the latest attempt
 *
 * @param {MasteryState} state
 * @param {{ score: number, maxScore: number }} attempt
 * @returns {MasteryState}
 *
 * @typedef {{ score: number|null, nAttempts: number, runningNum: number, runningDen: number }} MasteryState
 */
export function updateMastery(state, attempt) {
    const a     = state.nAttempts + 1;  // new attempt number
    const s     = attempt.score / attempt.maxScore;
    const alpha = 2 / (a + 1);         // simplified ramp for online update

    const newScore = state.score === null
        ? s
        : (1 - alpha) * state.score + alpha * s;

    return {
        score:      clamp(newScore),
        nAttempts:  a,
        runningNum: state.runningNum + alpha * s,
        runningDen: state.runningDen + alpha,
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _validateAttempts(attempts) {
    for (const a of attempts) {
        if (a.maxScore <= 0) throw new RangeError('maxScore must be > 0');
        if (a.score < 0 || a.score > a.maxScore)
            throw new RangeError(`score ${a.score} is out of range [0, ${a.maxScore}]`);
    }
}

/**
 * Extract a sorted list of per-attempt accuracy values.
 * Used for trend and consistency calculation.
 *
 * @param {object[]} attempts
 * @returns {number[]} Accuracy values in [0, 1], oldest first
 */
export function attemptsToAccuracies(attempts) {
    if (!attempts?.length) return [];
    return [...attempts]
        .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))
        .map((a) => a.score / a.maxScore);
}

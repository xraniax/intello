/**
 * Per-concept scoring engine.
 *
 * Distributes credit from each interaction across linked concepts using
 * attribution weights, then computes per-concept U / R / M / CRS.
 *
 * A question tagged to { recursion: 0.7, time-complexity: 0.3 } gives
 * 70% of its signal to recursion and 30% to time-complexity — the student's
 * understanding of recursion is updated more than their time-complexity score.
 */

import {
    EMA_LEARNING_RATE,
    READINESS_WEIGHTS,
    CONFIDENCE_PENALTY,
    CONFIDENCE_TAU,
    UNDERSTANDING_HALF_LIFE_DAYS,
    RETENTION_HALF_LIFE_DAYS,
} from './constants.js';

import {
    daysBetween,
    recencyWeight,
    applyDecay,
    normalizeDifficulty,
    difficultyScaledAlpha,
    computeTrend,
    trendLabel,
    groupBy,
    clamp,
} from './utils.js';

import { outcomeToScore } from './retention.js';
import {
    classifyCRS,
    computeWeaknessScore,
    computeSourceConfidence,
} from './readiness.js';

// ─── Per-concept score state ──────────────────────────────────────────────────

/**
 * Create a blank concept state.
 * All scores start at the uninformed prior (0.5) until data arrives.
 *
 * @param {string} conceptName
 * @returns {ConceptState}
 *
 * @typedef {{
 *   conceptName:   string,
 *   understanding: number,
 *   retention:     number,
 *   mastery:       number|null,
 *   nQuiz:         number,
 *   nFlashcard:    number,
 *   nExam:         number,
 *   lastUpdated:   string|null,
 *   uLastUpdated:  string|null,
 *   rLastUpdated:  string|null,
 * }} ConceptState
 */
export function createConceptState(conceptName) {
    return {
        conceptName,
        understanding:  0.5,    // uninformed prior
        retention:      0.5,
        mastery:        null,   // null until first exam interaction
        nQuiz:          0,
        nFlashcard:     0,
        nExam:          0,
        lastUpdated:    null,
        uLastUpdated:   null,
        rLastUpdated:   null,
    };
}

// ─── Incremental updates ──────────────────────────────────────────────────────

/**
 * Update concept states for all concepts linked to one quiz/exam response.
 *
 * The response's correctness and difficulty signal is split across linked
 * concepts proportionally to their attribution weights.
 *
 * @param {Map<string, ConceptState>} stateMap  - Current states (mutated in-place)
 * @param {{
 *   isCorrect:   boolean,
 *   difficulty:  number|string,
 *   completedAt: string|Date,
 *   concepts:    Record<string, number>,  — { conceptName: weight, … }
 * }} response
 *
 * @returns {Map<string, ConceptState>} Same map, mutated
 */
export function applyQuizResponseToConcepts(stateMap, response) {
    const concepts    = _normalizeConceptWeights(response.concepts ?? {});
    const difficulty  = normalizeDifficulty(response.difficulty);
    const completedAt = new Date(response.completedAt ?? new Date());

    for (const [name, weight] of concepts) {
        let state = stateMap.get(name) ?? createConceptState(name);

        // Age-decay the current understanding estimate
        const daysSince = state.uLastUpdated ? daysBetween(state.uLastUpdated, completedAt) : 0;
        const decayed   = applyDecay(state.understanding, daysSince, UNDERSTANDING_HALF_LIFE_DAYS);

        // α is scaled by both difficulty and concept weight:
        // harder question + higher concept relevance → bigger update
        const alpha   = difficultyScaledAlpha(difficulty, EMA_LEARNING_RATE) * weight;
        const updated = (1 - alpha) * decayed + alpha * (response.isCorrect ? 1 : 0);

        stateMap.set(name, {
            ...state,
            understanding: clamp(updated),
            nQuiz:         state.nQuiz + weight,   // fractional quiz credit
            uLastUpdated:  completedAt.toISOString(),
            lastUpdated:   completedAt.toISOString(),
        });
    }

    return stateMap;
}

/**
 * Update concept states for all concepts linked to one flashcard review.
 *
 * @param {Map<string, ConceptState>} stateMap
 * @param {{
 *   outcome:       string,
 *   daysSinceLast: number|null,
 *   reviewedAt:    string|Date,
 *   concepts:      Record<string, number>,
 * }} review
 *
 * @returns {Map<string, ConceptState>}
 */
export function applyFlashcardReviewToConcepts(stateMap, review) {
    const concepts   = _normalizeConceptWeights(review.concepts ?? {});
    const o          = outcomeToScore(review.outcome);
    const delta      = review.daysSinceLast;
    const reviewedAt = new Date(review.reviewedAt ?? new Date());

    const V_MAX = Math.log2(1 + 30);
    const v     = delta ? Math.log2(1 + delta) : 0;

    for (const [name, weight] of concepts) {
        let state = stateMap.get(name) ?? createConceptState(name);

        // Decay retention estimate
        const daysSince = state.rLastUpdated ? daysBetween(state.rLastUpdated, reviewedAt) : 0;
        const decayed   = applyDecay(state.retention, daysSince, RETENTION_HALF_LIFE_DAYS);

        // Only update if there's an interval — first reviews carry no signal
        let updated = decayed;
        if (delta && delta > 0) {
            const beta = 0.3 * clamp(v / V_MAX) * weight;
            updated    = (1 - beta) * decayed + beta * o;
        }

        stateMap.set(name, {
            ...state,
            retention:    clamp(updated),
            nFlashcard:   state.nFlashcard + weight,
            rLastUpdated: reviewedAt.toISOString(),
            lastUpdated:  reviewedAt.toISOString(),
        });
    }

    return stateMap;
}

/**
 * Update concept states from one exam attempt's per-concept scores.
 *
 * @param {Map<string, ConceptState>} stateMap
 * @param {{
 *   completedAt:  string|Date,
 *   conceptBreakdown: Array<{
 *     conceptName:   string,
 *     score:         number,
 *     maxScore:      number,
 *     questionCount: number,
 *   }>,
 * }} examResult
 *
 * @returns {Map<string, ConceptState>}
 */
export function applyExamResultToConcepts(stateMap, examResult) {
    const completedAt = new Date(examResult.completedAt ?? new Date());

    for (const cb of (examResult.conceptBreakdown ?? [])) {
        const name    = cb.conceptName;
        let state     = stateMap.get(name) ?? createConceptState(name);
        const s       = cb.score / cb.maxScore;

        // Attempt-ramp α: 2/(nExam+1), same logic as batch mastery
        const a     = Math.floor(state.nExam) + 1;
        const alpha = 2 / (a + 1);

        const updated = state.mastery === null
            ? s
            : (1 - alpha) * state.mastery + alpha * s;

        stateMap.set(name, {
            ...state,
            mastery:     clamp(updated),
            nExam:       state.nExam + 1,
            lastUpdated: completedAt.toISOString(),
        });
    }

    return stateMap;
}

// ─── Concept Readiness Score (CRS) ───────────────────────────────────────────

/**
 * Compute CRS for a single concept state.
 *
 * Mirrors the global readiness formula but operates on the concept's own
 * U / R / M scores. Sources without data (mastery = null) are excluded
 * and their weights redistributed to available sources.
 *
 * @param {ConceptState} state
 * @returns {{ crs: number, confidence: number, state: string }}
 */
export function computeConceptReadiness(state) {
    const sources = [
        { value: state.mastery,      weight: READINESS_WEIGHTS.exam,      n: state.nExam,      tau: CONFIDENCE_TAU.exam      },
        { value: state.understanding,weight: READINESS_WEIGHTS.quiz,      n: state.nQuiz,      tau: CONFIDENCE_TAU.quiz      },
        { value: state.retention,    weight: READINESS_WEIGHTS.flashcard, n: state.nFlashcard, tau: CONFIDENCE_TAU.flashcard  },
    ].filter((s) => s.value !== null && s.value !== undefined);

    if (!sources.length) {
        return { crs: 0, confidence: 0, state: 'unstarted' };
    }

    const totalW   = sources.reduce((s, src) => s + src.weight, 0);
    const rawScore = sources.reduce((s, src) => s + (src.weight / totalW) * src.value, 0);

    // Per-source confidence, aggregated by importance weight
    const confidence = sources.reduce((s, src) => {
        const c = computeSourceConfidence(src.n, src.tau);
        return s + (src.weight / totalW) * c;
    }, 0);

    const corrected = rawScore * (1 - CONFIDENCE_PENALTY * (1 - confidence));
    const crs       = clamp(corrected);

    return {
        crs,
        confidence,
        state: classifyCRS(crs, confidence),
    };
}

// ─── Batch scoring from raw interaction history ───────────────────────────────

/**
 * Build a complete per-concept score map from raw interaction arrays.
 *
 * Processes all events in chronological order, applying incremental updates
 * to each concept. Returns the final computed CRS for every concept seen.
 *
 * INPUT SHAPES:
 *
 * quizResponses item: { isCorrect, difficulty, completedAt, concepts: { name: weight } }
 * flashcardReviews item: { outcome, daysSinceLast, reviewedAt, concepts: { name: weight } }
 * examResults item: { completedAt, conceptBreakdown: [{ conceptName, score, maxScore }] }
 *
 * @param {{
 *   quizResponses:   object[],
 *   flashcardReviews: object[],
 *   examResults:     object[],
 * }} data
 *
 * @returns {Map<string, {
 *   conceptName:  string,
 *   understanding: number,
 *   retention:    number,
 *   mastery:      number|null,
 *   crs:          number,
 *   confidence:   number,
 *   state:        string,
 *   nInteractions: number,
 *   lastUpdated:  string|null,
 * }>}
 */
export function computeConceptScores({ quizResponses = [], flashcardReviews = [], examResults = [] }) {
    const stateMap = new Map();

    // Process all events in chronological order
    const events = [
        ...quizResponses.map((r)  => ({ type: 'quiz',      ts: new Date(r.completedAt), data: r })),
        ...flashcardReviews.map((r) => ({ type: 'flashcard', ts: new Date(r.reviewedAt),  data: r })),
        ...examResults.map((r)    => ({ type: 'exam',      ts: new Date(r.completedAt), data: r })),
    ].sort((a, b) => a.ts - b.ts);

    for (const event of events) {
        if      (event.type === 'quiz')      applyQuizResponseToConcepts(stateMap, event.data);
        else if (event.type === 'flashcard') applyFlashcardReviewToConcepts(stateMap, event.data);
        else if (event.type === 'exam')      applyExamResultToConcepts(stateMap, event.data);
    }

    // Build the result map with CRS computed for each concept
    const result = new Map();
    for (const [name, state] of stateMap) {
        const { crs, confidence, state: conceptState } = computeConceptReadiness(state);
        result.set(name, {
            conceptName:   name,
            understanding: state.understanding,
            retention:     state.retention,
            mastery:       state.mastery,
            crs,
            confidence,
            state:         conceptState,
            nInteractions: state.nQuiz + state.nFlashcard + state.nExam,
            lastUpdated:   state.lastUpdated,
        });
    }

    return result;
}

// ─── Weak concept detection ───────────────────────────────────────────────────

/**
 * Identify and rank weak concepts from a concept score map.
 *
 * Returns only concepts in 'critical' or 'weak' states with sufficient data
 * (at least 3 interactions), sorted by urgency (weaknessScore descending).
 *
 * @param {Map<string, object>} conceptScores - Output of computeConceptScores
 * @param {{ trends?: Map<string, number> }} [options]
 * @returns {Array<{
 *   conceptName:    string,
 *   crs:            number,
 *   state:          string,
 *   weaknessScore:  number,
 *   trend:          number|null,
 *   action:         string,
 * }>}
 */
export function detectWeakConcepts(conceptScores, options = {}) {
    const trends = options.trends ?? new Map();
    const result = [];

    for (const [name, scores] of conceptScores) {
        if (scores.nInteractions < 3) continue; // insufficient data
        if (scores.state === 'mastered' || scores.state === 'unstarted') continue;

        const trend = trends.get(name) ?? null;
        const w     = computeWeaknessScore(scores.crs, trend, scores.nInteractions);

        result.push({
            conceptName:   name,
            crs:           scores.crs,
            state:         scores.state,
            weaknessScore: w,
            trend,
            trendLabel:    trendLabel(trend),
            action:        _actionTag(w),
        });
    }

    return result.sort((a, b) => b.weaknessScore - a.weaknessScore);
}

function _actionTag(w) {
    if (w > 0.5) return 'urgent_review';
    if (w > 0.3) return 'scheduled_review';
    return 'monitor';
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Normalize a concept weight map so weights sum to 1.
 * Returns a Map<string, number>.
 *
 * @param {Record<string, number>} conceptsObj
 * @returns {Map<string, number>}
 */
function _normalizeConceptWeights(conceptsObj) {
    const entries = Object.entries(conceptsObj).filter(([, w]) => w > 0);
    if (!entries.length) return new Map();

    const total = entries.reduce((s, [, w]) => s + w, 0);
    return new Map(entries.map(([name, w]) => [name, w / total]));
}

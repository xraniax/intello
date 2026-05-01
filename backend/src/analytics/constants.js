// All tunable parameters in one place.
// Change here, nowhere else.

export const UNDERSTANDING_HALF_LIFE_DAYS = 14;   // quiz knowledge decays with 14-day half-life
export const RETENTION_HALF_LIFE_DAYS    = 30;    // card retention decays with 30-day half-life
export const MASTERY_ATTEMPT_RAMP        = true;  // weight later exam attempts more heavily
export const RETENTION_INTERVAL_REF_DAYS = 30;    // v_max normalizer: log2(1 + 30)

export const EMA_LEARNING_RATE           = 0.15;  // η: how much one quiz response shifts U
export const RETENTION_EMA_RATE          = 0.30;  // β: per-card EMA rate

export const MAX_DIFFICULTY              = 5;
export const CONFIDENCE_PENALTY          = 0.30;  // max readiness haircut from low confidence
export const TREND_LAMBDA                = 0.30;  // recency decay in WLS trend regression
export const TREND_SCALE                 = 3.00;  // γ: tanh normalization factor

// Characteristic sample sizes for confidence saturation (τ in 1 - e^{-n/τ})
export const CONFIDENCE_TAU = {
    quiz:      20,
    flashcard: 30,
    exam:       3,
};

// Final readiness weights (must sum to 1.0)
export const READINESS_WEIGHTS = {
    exam:      0.40,
    quiz:      0.35,
    flashcard: 0.25,
};

export const FLASHCARD_OUTCOME_SCORES = {
    again: 0.00,
    hard:  0.33,
    good:  0.67,
    easy:  1.00,
};

export const DIFFICULTY_LABEL_MAP = {
    Introductory: 1,
    easy:         2,
    Intermediate: 3,
    medium:       3,
    hard:         4,
    Advanced:     5,
};

export const DATA_QUALITY_THRESHOLDS = {
    high:     0.85,
    moderate: 0.60,
    low:      0.30,
};

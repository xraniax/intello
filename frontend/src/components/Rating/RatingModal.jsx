import React, { useState, useEffect } from 'react';
import { X, MessageSquare, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import StarRating from './StarRating';
import RatingService from '@/services/RatingService';
import { useRatingStore } from '@/store/useRatingStore';

const ISSUE_FLAGS = [
    { key: 'incorrect_information',   label: 'Incorrect information' },
    { key: 'confusing_explanations',  label: 'Confusing explanations' },
    { key: 'too_long',                label: 'Too long' },
    { key: 'too_short',               label: 'Too short' },
    { key: 'repetitive_content',      label: 'Repetitive content' },
    { key: 'formatting_issues',       label: 'Formatting issues' },
    { key: 'poor_examples',           label: 'Poor examples' },
];

const DIFFICULTY_OPTIONS = [
    { value: 'too_easy',     label: 'Too easy' },
    { value: 'appropriate',  label: 'Just right' },
    { value: 'too_difficult',label: 'Too difficult' },
];

/**
 * Multi-step rating modal.
 *
 * Step 1 — Star rating only (fast lane: user can submit immediately)
 * Step 2 — Expanded: effectiveness + difficulty + flags + written feedback
 *           Auto-expands when overall_rating ≤ 2 for qualitative signal.
 *
 * Props:
 *   materialId        {string}
 *   materialTitle     {string}
 *   engagementSeconds {number}
 *   existingRating    {object|null}  pre-fill when editing
 *   onClose           {fn}
 *   onSubmitted       {fn}  called with the saved rating object
 */
export default function RatingModal({
    materialId,
    materialTitle = 'this material',
    engagementSeconds = 0,
    existingRating = null,
    onClose,
    onSubmitted,
}) {
    const { actions } = useRatingStore();
    const isEdit = !!existingRating;

    // ── Form state ─────────────────────────────────────────────────────────────
    const [step, setStep]         = useState(1); // 1 = stars only, 2 = full form
    const [rating, setRating]     = useState(existingRating?.overall_rating ?? 0);
    const [effective, setEffective] = useState(existingRating?.learning_effectiveness ?? null);
    const [difficulty, setDifficulty] = useState(existingRating?.difficulty_level ?? null);
    const [feedback, setFeedback]   = useState(existingRating?.written_feedback ?? '');
    const [flags, setFlags]         = useState(new Set(existingRating?.issue_flags ?? []));

    // ── Submission state ───────────────────────────────────────────────────────
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState(null);
    const [done, setDone]         = useState(false);

    // Auto-expand to step 2 for low ratings (≤ 2 stars)
    useEffect(() => {
        if (rating > 0 && rating <= 2) setStep(2);
    }, [rating]);

    // Pre-fill when editing
    useEffect(() => {
        if (existingRating) setStep(2);
    }, [existingRating]);

    const toggleFlag = (key) =>
        setFlags((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });

    const handleSubmit = async () => {
        if (!rating) return;
        setLoading(true);
        setError(null);
        try {
            const res = await RatingService.submit({
                materialId,
                overall_rating:        rating,
                learning_effectiveness: effective,
                difficulty_level:      difficulty,
                written_feedback:      feedback.trim() || null,
                issue_flags:           [...flags],
                engagement_seconds:    Math.max(engagementSeconds, 30), // ensure gate passes
            });
            const saved = res.data?.data?.rating;
            actions.setRating(materialId, saved);
            onSubmitted?.(saved);
            setDone(true);
            setTimeout(() => {
                actions.closeModal();
                onClose?.();
            }, 1400);
        } catch (err) {
            setError(err.response?.data?.message || 'Could not save your rating. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) { actions.closeModal(); onClose?.(); } }}
        >
            <div
                className="relative w-full sm:max-w-md rounded-[1.5rem] shadow-2xl overflow-hidden"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-soft)' }}
            >
                {/* Header */}
                <div className="flex items-start justify-between px-6 pt-5 pb-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'var(--c-primary)' }}>
                            Rate this material
                        </p>
                        <h2 className="text-base font-bold leading-tight" style={{ color: 'var(--c-text)' }}>
                            {materialTitle}
                        </h2>
                    </div>
                    <button
                        onClick={() => { actions.closeModal(); onClose?.(); }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--c-surface-alt)]"
                        style={{ color: 'var(--c-text-muted)' }}
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Success state */}
                {done ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-10">
                        <CheckCircle2 size={40} style={{ color: 'var(--c-primary)' }} />
                        <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>
                            {isEdit ? 'Rating updated!' : 'Thank you for your feedback!'}
                        </p>
                    </div>
                ) : (
                    <div className="px-6 pb-6 flex flex-col gap-5">
                        {/* ── Step 1: Stars ──────────────────────────────────── */}
                        <div className="flex flex-col items-center gap-1 py-2">
                            <StarRating value={rating} onChange={setRating} size={34} />
                            {rating > 0 && step === 1 && (
                                <button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    className="mt-1 text-xs underline"
                                    style={{ color: 'var(--c-text-muted)' }}
                                >
                                    Add more details
                                </button>
                            )}
                        </div>

                        {/* ── Step 2: Expanded ───────────────────────────────── */}
                        {step === 2 && (
                            <>
                                {/* Effectiveness */}
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>
                                        Did this material help you understand the topic?
                                    </p>
                                    <div className="flex gap-2">
                                        {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(({ v, l }) => (
                                            <button
                                                key={String(v)}
                                                type="button"
                                                onClick={() => setEffective((p) => p === v ? null : v)}
                                                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                                                style={{
                                                    background: effective === v ? 'var(--c-primary)' : 'var(--c-surface-alt)',
                                                    color: effective === v ? '#fff' : 'var(--c-text-muted)',
                                                    border: `1.5px solid ${effective === v ? 'var(--c-primary)' : 'var(--c-border-soft)'}`,
                                                }}
                                            >
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Difficulty */}
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>
                                        Difficulty level
                                    </p>
                                    <div className="flex gap-2 flex-wrap">
                                        {DIFFICULTY_OPTIONS.map(({ value, label }) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setDifficulty((p) => p === value ? null : value)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                                style={{
                                                    background: difficulty === value ? 'var(--c-primary-light)' : 'var(--c-surface-alt)',
                                                    color: difficulty === value ? 'var(--c-primary)' : 'var(--c-text-muted)',
                                                    border: `1.5px solid ${difficulty === value ? 'var(--c-primary)' : 'var(--c-border-soft)'}`,
                                                }}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Issue flags — shown for ratings ≤ 3 */}
                                {rating <= 3 && (
                                    <div className="flex flex-col gap-2">
                                        <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>
                                            Any issues? (optional)
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {ISSUE_FLAGS.map(({ key, label }) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => toggleFlag(key)}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                                                    style={{
                                                        background: flags.has(key) ? 'rgba(239,68,68,0.12)' : 'var(--c-surface-alt)',
                                                        color: flags.has(key) ? 'var(--c-danger)' : 'var(--c-text-muted)',
                                                        border: `1.5px solid ${flags.has(key) ? 'rgba(239,68,68,0.35)' : 'var(--c-border-soft)'}`,
                                                    }}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Written feedback */}
                                <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--c-text)' }}>
                                        <MessageSquare size={14} />
                                        Written feedback
                                        <span style={{ color: 'var(--c-text-muted)', fontSize: '11px' }}>(optional)</span>
                                    </label>
                                    <textarea
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                        placeholder="e.g. The explanations were clear, but examples could be improved…"
                                        rows={3}
                                        maxLength={2000}
                                        className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none transition-colors"
                                        style={{
                                            background: 'var(--c-surface-alt)',
                                            border: '1.5px solid var(--c-border-soft)',
                                            color: 'var(--c-text)',
                                        }}
                                        onFocus={(e) => (e.target.style.borderColor = 'var(--c-primary)')}
                                        onBlur={(e)  => (e.target.style.borderColor = 'var(--c-border-soft)')}
                                    />
                                    <p className="text-right text-[10px]" style={{ color: 'var(--c-text-muted)' }}>
                                        {feedback.length}/2000
                                    </p>
                                </div>
                            </>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--c-danger)' }}>
                                <AlertCircle size={14} />
                                {error}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => { actions.closeModal(); onClose?.(); }}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                                style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}
                            >
                                {isEdit ? 'Cancel' : 'Skip'}
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!rating || loading}
                                className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                style={{ background: 'var(--c-primary)', color: '#fff' }}
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                                {isEdit ? 'Update rating' : 'Submit rating'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

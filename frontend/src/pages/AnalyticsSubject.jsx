import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Brain, Target, Layers, TrendingUp, TrendingDown, Minus,
    RefreshCw, AlertTriangle, ChevronRight, Check, X, Zap, Clock,
    BookOpen, BarChart2, Flame, Activity,
} from 'lucide-react';
import useAnalyticsStore from '@/store/useAnalyticsStore';
import AnalyticsService from '@/services/AnalyticsService';

// ── Helpers ───────────────────────────────────────────────────────────────────

const f = (v) => (v != null ? parseFloat(v) : null);

const fmtDate = (d) => {
    if (!d) return null;
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7)  return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const stateStyle = (state) => {
    switch (state) {
        case 'mastered':   return { bg: '#ecfdf5', text: '#059669', dot: '#10b981', bar: '#10b981' };
        case 'developing': return { bg: '#eff6ff', text: '#2563eb', dot: '#3b82f6', bar: '#635BFF' };
        case 'weak':       return { bg: '#fffbeb', text: '#b45309', dot: '#f59e0b', bar: '#f59e0b' };
        case 'critical':   return { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444', bar: '#ef4444' };
        default:           return { bg: '#f9fafb', text: '#6b7280', dot: '#9ca3af', bar: '#9ca3af' };
    }
};

function trendIcon(trend7d) {
    if (trend7d > 2)  return <TrendingUp  className="w-3.5 h-3.5" style={{ color: 'var(--c-mint)' }} />;
    if (trend7d < -2) return <TrendingDown className="w-3.5 h-3.5" style={{ color: 'var(--c-danger)' }} />;
    return <Minus className="w-3.5 h-3.5" style={{ color: 'var(--c-amber)' }} />;
}

// ── Multi-line progress chart ─────────────────────────────────────────────────

function MultiLineChart({ series }) {
    const svgRef = useRef(null);
    const [width, setWidth] = useState(500);

    useEffect(() => {
        const obs = new ResizeObserver(([e]) => setWidth(e.contentRect.width || 500));
        if (svgRef.current) obs.observe(svgRef.current);
        return () => obs.disconnect();
    }, []);

    // series = { quiz_accuracy: [{period, accuracy}], exam_scores: [{date, accuracy}], flashcard_retention: [{period, retention_rate}] }
    const quiz  = (series?.quiz_accuracy ?? []).map(p => ({ t: new Date(p.period), v: f(p.accuracy) }));
    const exam  = (series?.exam_scores   ?? []).map(p => ({ t: new Date(p.date),   v: f(p.accuracy) }));
    const flash = (series?.flashcard_retention ?? []).map(p => ({ t: new Date(p.period), v: f(p.retention_rate) }));

    const allPoints = [...quiz, ...exam, ...flash].filter(p => p.v != null);
    if (allPoints.length < 2) {
        return (
            <div className="flex items-center justify-center h-24 text-sm" style={{ color: 'var(--c-text-muted)' }}>
                Not enough data to show progress chart
            </div>
        );
    }

    const h = 120;
    const pad = { top: 12, bottom: 16, left: 4, right: 4 };
    const times = allPoints.map(p => p.t.getTime());
    const tMin = Math.min(...times), tMax = Math.max(...times);
    const tRange = tMax - tMin || 1;

    const xOf = (t) => pad.left + ((t.getTime() - tMin) / tRange) * (width - pad.left - pad.right);
    const yOf = (v) => pad.top + (1 - v / 100) * (h - pad.top - pad.bottom);

    const buildPath = (pts) => {
        const valid = pts.filter(p => p.v != null);
        if (valid.length < 2) return null;
        return valid.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.t).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(' ');
    };

    const lines = [
        { pts: quiz,  color: '#635BFF', label: 'Understanding' },
        { pts: flash, color: '#8b5cf6', label: 'Retention' },
        { pts: exam,  color: '#10b981', label: 'Mastery' },
    ];

    return (
        <div>
            <svg ref={svgRef} width="100%" height={h} viewBox={`0 0 ${width} ${h}`} preserveAspectRatio="none">
                {/* Y gridlines */}
                {[25, 50, 75].map(v => (
                    <line key={v}
                          x1={pad.left} x2={width - pad.right}
                          y1={yOf(v)} y2={yOf(v)}
                          stroke="currentColor" strokeWidth="0.5" className="text-gray-100" />
                ))}
                {lines.map(({ pts, color }) => {
                    const d = buildPath(pts);
                    return d ? (
                        <path key={color} d={d} stroke={color} strokeWidth="2" fill="none"
                              strokeLinecap="round" strokeLinejoin="round" />
                    ) : null;
                })}
                {/* Dots at last point */}
                {lines.map(({ pts, color }) => {
                    const valid = pts.filter(p => p.v != null);
                    if (!valid.length) return null;
                    const last = valid[valid.length - 1];
                    return <circle key={color} cx={xOf(last.t)} cy={yOf(last.v)} r="3.5" fill={color} />;
                })}
            </svg>
            <div className="flex items-center gap-4 mt-2">
                {lines.map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                        <div className="w-5 h-0.5 rounded-full" style={{ background: color }} />
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--c-text-muted)' }}>{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Concept row ───────────────────────────────────────────────────────────────

function ConceptRow({ concept, isSelected, onClick }) {
    const cs  = stateStyle(concept.state);
    const crs = Math.round(concept.crs ?? 0);
    return (
        <motion.button
            layout
            onClick={onClick}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-colors group"
            style={{ background: isSelected ? 'var(--c-primary-ultra)' : 'transparent' }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--c-canvas)'; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
        >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cs.dot }} />
            <span className="flex-1 text-[13px] font-semibold truncate" style={{ color: 'var(--c-text)' }}>
                {concept.name}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: cs.bg, color: cs.text }}>
                {concept.state}
            </span>
            <div className="w-16 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--c-surface-alt)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${crs}%`, background: cs.bar }} />
            </div>
            <span className="text-[11px] font-bold w-8 text-right flex-shrink-0" style={{ color: 'var(--c-text-muted)' }}>
                {crs}%
            </span>
            {concept.trend_7d != null && Math.abs(concept.trend_7d) > 2 && (
                <span>{trendIcon(concept.trend_7d)}</span>
            )}
        </motion.button>
    );
}

// ── Concept detail drawer ─────────────────────────────────────────────────────

function ConceptDetailDrawer({ subjectId, conceptName, onClose }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        setDetail(null);
        AnalyticsService.getConceptDetail(subjectId, conceptName)
            .then(setDetail)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [subjectId, conceptName]);

    const cs = detail ? stateStyle(detail.state) : stateStyle('unstarted');
    const crs = Math.round(detail?.crs ?? 0);
    const scores = detail?.scores ?? {};

    // Quiz response grid (last 20)
    const quizHistory = detail?.trend?.history
        ?.filter(h => h.source === 'quiz_session')
        ?.slice(-20) ?? [];

    return (
        <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="absolute inset-y-0 right-0 w-[340px] flex flex-col z-20 overflow-hidden"
            style={{ background: 'var(--c-surface)', borderLeft: '1px solid var(--c-border)', boxShadow: '-8px 0 32px rgba(0,0,0,0.06)' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
                 style={{ borderColor: 'var(--c-border)' }}>
                <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cs.dot }} />
                    <span className="font-bold text-[14px] truncate" style={{ color: 'var(--c-text)' }}>
                        {conceptName}
                    </span>
                </div>
                <button onClick={onClose}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                        style={{ color: 'var(--c-text-muted)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--c-surface-alt)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <X className="w-4 h-4" />
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--c-text-muted)' }} />
                </div>
            ) : !detail ? (
                <div className="flex-1 flex items-center justify-center p-6 text-center text-sm"
                     style={{ color: 'var(--c-text-muted)' }}>
                    No data yet for this concept.
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">

                    {/* CRS ring */}
                    <div className="rounded-2xl p-5 flex items-center gap-5"
                         style={{ background: 'var(--c-canvas)' }}>
                        <div className="relative flex-shrink-0">
                            <svg width={72} height={72} className="-rotate-90">
                                <circle cx={36} cy={36} r={28} stroke="currentColor" strokeWidth={6}
                                        fill="none" className="text-gray-100" />
                                <circle cx={36} cy={36} r={28} stroke={cs.dot} strokeWidth={6}
                                        fill="none"
                                        strokeDasharray={2 * Math.PI * 28}
                                        strokeDashoffset={2 * Math.PI * 28 - (crs / 100) * 2 * Math.PI * 28}
                                        strokeLinecap="round"
                                        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center rotate-90">
                                <span className="text-[15px] font-black" style={{ color: 'var(--c-text)' }}>{crs}%</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-1"
                                 style={{ color: 'var(--c-text-muted)' }}>Readiness</div>
                            <div className="text-[13px] font-bold px-2.5 py-1 rounded-full inline-block"
                                 style={{ background: cs.bg, color: cs.text }}>
                                {detail.state}
                            </div>
                            {detail.trend?.label && (
                                <div className="text-[11px] mt-1 font-medium capitalize"
                                     style={{ color: 'var(--c-text-muted)' }}>
                                    {detail.trend.label.replace('_', ' ')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Score breakdown */}
                    <div className="space-y-3">
                        {[
                            { label: 'Understanding', value: scores.understanding?.value, color: '#635BFF' },
                            { label: 'Retention',     value: scores.retention?.value,     color: '#8b5cf6' },
                            { label: 'Mastery',       value: scores.mastery?.value,       color: '#10b981' },
                        ].map(({ label, value, color }) => value != null && (
                            <div key={label}>
                                <div className="flex justify-between text-[11px] font-bold mb-1"
                                     style={{ color: 'var(--c-text-muted)' }}>
                                    <span>{label}</span>
                                    <span style={{ color }}>{Math.round(value)}%</span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-surface-alt)' }}>
                                    <motion.div
                                        className="h-full rounded-full"
                                        style={{ background: color }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.round(value)}%` }}
                                        transition={{ duration: 0.8 }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: 'Interactions', value: detail.consistency ?? (detail.trend?.history?.length ?? 0), icon: Zap },
                            { label: 'Last Active',  value: fmtDate(scores.understanding?.last_updated), icon: Clock },
                        ].map(({ label, value, icon: Ic }) => (
                            <div key={label} className="rounded-xl p-3 text-center"
                                 style={{ background: 'var(--c-canvas)' }}>
                                <Ic className="w-3.5 h-3.5 mx-auto mb-1" style={{ color: 'var(--c-text-muted)' }} />
                                <div className="text-[15px] font-black" style={{ color: 'var(--c-text)' }}>
                                    {value ?? '—'}
                                </div>
                                <div className="text-[10px] font-bold uppercase tracking-wide"
                                     style={{ color: 'var(--c-text-muted)' }}>{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Exam history */}
                    {detail.exam_history?.length > 0 && (
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-2"
                                 style={{ color: 'var(--c-text-muted)' }}>
                                Exam History
                            </div>
                            <div className="space-y-2">
                                {detail.exam_history.slice(-4).map((e, i) => (
                                    <div key={i} className="flex items-center gap-3 text-[12px]">
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black"
                                             style={{ background: 'var(--c-primary-ultra)', color: 'var(--c-primary)' }}>
                                            {e.attempt_number}
                                        </div>
                                        <div className="flex-1">
                                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-surface-alt)' }}>
                                                <div className="h-full rounded-full" style={{ width: `${Math.round(e.accuracy)}%`, background: 'var(--c-mint)' }} />
                                            </div>
                                        </div>
                                        <span className="font-bold w-10 text-right" style={{ color: 'var(--c-text)' }}>
                                            {Math.round(e.accuracy)}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Flashcard schedule */}
                    {detail.flashcard_schedule?.total_cards > 0 && (
                        <div className="rounded-xl p-3 flex items-center gap-3"
                             style={{ background: detail.flashcard_schedule.overdue_cards > 0 ? 'var(--c-amber-light)' : 'var(--c-canvas)' }}>
                            <Layers className="w-4 h-4 flex-shrink-0"
                                    style={{ color: detail.flashcard_schedule.overdue_cards > 0 ? 'var(--c-amber)' : 'var(--c-primary)' }} />
                            <div>
                                <div className="text-[12px] font-bold" style={{ color: 'var(--c-text)' }}>
                                    {detail.flashcard_schedule.overdue_cards > 0
                                        ? `${detail.flashcard_schedule.overdue_cards} cards overdue`
                                        : `${detail.flashcard_schedule.cards_due_today} cards due today`}
                                </div>
                                <div className="text-[10px]" style={{ color: 'var(--c-text-muted)' }}>
                                    {detail.flashcard_schedule.total_cards} total cards tracked
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Next action */}
                    <div className="rounded-xl p-4 border"
                         style={{ borderColor: 'var(--c-primary-light)', background: 'var(--c-primary-ultra)' }}>
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1"
                             style={{ color: 'var(--c-primary)' }}>
                            Next Step
                        </div>
                        <div className="text-[12px] font-medium" style={{ color: 'var(--c-text-secondary)' }}>
                            {detail.state === 'critical'
                                ? `Focus on ${conceptName} with targeted quizzes — 3 correct in a row breaks the plateau.`
                                : detail.state === 'weak'
                                ? `Review ${conceptName} flashcards to strengthen retention before your next quiz.`
                                : detail.state === 'developing'
                                ? `Take a timed exam question set on ${conceptName} to push into mastery.`
                                : `${conceptName} is mastered. Keep reviewing on schedule to maintain retention.`}
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

// ── Dimension card ────────────────────────────────────────────────────────────

function DimCard({ label, value, delta, icon: Icon, color, bg }) {
    return (
        <div className="rounded-2xl p-4 flex flex-col gap-2"
             style={{ background: bg, border: `1px solid ${color}22` }}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                </div>
                {delta != null && (
                    <span className="text-[10px] font-bold" style={{ color: delta > 0 ? 'var(--c-mint)' : delta < 0 ? 'var(--c-danger)' : 'var(--c-text-muted)' }}>
                        {delta > 0 ? '+' : ''}{Math.round(delta)}
                    </span>
                )}
            </div>
            <div className="text-[28px] font-black tabular-nums leading-none" style={{ color: 'var(--c-text)' }}>
                {value != null ? `${Math.round(value)}%` : '—'}
            </div>
        </div>
    );
}

// ── Main AnalyticsSubject page ────────────────────────────────────────────────

const AnalyticsSubject = () => {
    const { subjectId } = useParams();
    const navigate      = useNavigate();
    const { actions }   = useAnalyticsStore();

    const dashboard = useAnalyticsStore(s => s.data.dashboards[subjectId]);
    const progress  = useAnalyticsStore(s => s.data.progress[subjectId]);
    const loading   = useAnalyticsStore(s => s.loading[`dashboard_${subjectId}`]);
    const error     = useAnalyticsStore(s => s.errors[`dashboard_${subjectId}`]);

    const [concepts, setConcepts]         = useState([]);
    const [conceptFilter, setConceptFilter] = useState('all');
    const [selectedConcept, setSelected]  = useState(null);
    const [refreshing, setRefreshing]     = useState(false);
    const [loadingConcepts, setLoadingConcepts] = useState(false);

    const load = useCallback(async (refresh = false) => {
        if (!subjectId) return;
        await Promise.all([
            actions.fetchDashboard(subjectId, { refresh }),
            actions.fetchProgress(subjectId, { granularity: 'week' }),
        ]);
    }, [subjectId, actions]);

    const loadConcepts = useCallback(async () => {
        if (!subjectId) return;
        setLoadingConcepts(true);
        try {
            const result = await AnalyticsService.getConcepts(subjectId, { sort: 'weakness', order: 'asc', minInteractions: 0 });
            setConcepts(result.concepts ?? []);
        } catch (_) {}
        setLoadingConcepts(false);
    }, [subjectId]);

    useEffect(() => {
        if (subjectId && !dashboard) load();
        if (subjectId) loadConcepts();
    }, [subjectId]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await load(true).catch(() => {});
        await loadConcepts();
        setRefreshing(false);
    };

    const breakdown = dashboard?.breakdown ?? {};
    const readiness = dashboard?.readiness ?? {};
    const meta      = dashboard?.meta ?? {};
    const weak      = dashboard?.weak_concepts ?? [];
    const subject   = dashboard?.subject ?? {};
    const series    = progress?.series;

    const crs = Math.round(readiness.score ?? 0);

    const filteredConcepts = conceptFilter === 'all'
        ? concepts
        : concepts.filter(c => c.state === conceptFilter);

    const distribution = concepts.reduce((acc, c) => {
        acc[c.state] = (acc[c.state] ?? 0) + 1;
        return acc;
    }, {});

    return (
        <div className="flex-1 flex overflow-hidden relative" style={{ background: 'var(--c-canvas)' }}>

            {/* Main scrollable area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">

                    {/* ── Back + header ── */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/analytics')}
                            className="flex items-center gap-1.5 text-[12px] font-bold transition-opacity hover:opacity-70"
                            style={{ color: 'var(--c-primary)' }}
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Overview
                        </button>
                        <div className="h-4 w-px" style={{ background: 'var(--c-border)' }} />
                        <div className="flex items-center gap-3 flex-1">
                            <h1 className="text-[22px] font-black tracking-tight" style={{ color: 'var(--c-text)', letterSpacing: '-0.02em' }}>
                                {subject.name ?? 'Subject Analytics'}
                            </h1>
                            {readiness.label && (
                                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                                      style={{ background: crs >= 75 ? 'var(--c-mint-light)' : crs >= 50 ? 'var(--c-primary-ultra)' : crs >= 25 ? 'var(--c-amber-light)' : 'var(--c-danger-light)',
                                               color:      crs >= 75 ? 'var(--c-mint)'        : crs >= 50 ? 'var(--c-primary)'       : crs >= 25 ? 'var(--c-amber)'       : 'var(--c-danger)' }}>
                                    {readiness.label}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing || loading}
                            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all"
                            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-text-muted)', background: 'var(--c-surface)' }}
                        >
                            <RefreshCw className={`w-3 h-3 ${(refreshing || loading) ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>

                    {/* ── Error ── */}
                    {error && (
                        <div className="p-4 rounded-2xl flex items-center gap-3"
                             style={{ background: 'var(--c-danger-light)', color: 'var(--c-danger)' }}>
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <span className="text-sm font-medium">{error}</span>
                        </div>
                    )}

                    {/* ── Skeleton ── */}
                    {loading && !dashboard && (
                        <div className="space-y-4 animate-pulse">
                            <div className="grid grid-cols-3 gap-3">
                                {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-100" />)}
                            </div>
                            <div className="h-32 rounded-2xl bg-gray-100" />
                            <div className="h-64 rounded-2xl bg-gray-100" />
                        </div>
                    )}

                    {dashboard && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

                            {/* ── Dimension cards ── */}
                            <div className="grid grid-cols-3 gap-3">
                                <DimCard
                                    label="Understanding" icon={Brain}
                                    value={breakdown.understanding?.score}
                                    delta={null}
                                    color="#635BFF" bg="#f0f0ff"
                                />
                                <DimCard
                                    label="Retention" icon={Layers}
                                    value={breakdown.retention?.score}
                                    delta={null}
                                    color="#8b5cf6" bg="#f5f3ff"
                                />
                                <DimCard
                                    label="Mastery" icon={Target}
                                    value={breakdown.mastery?.score}
                                    delta={null}
                                    color="#10b981" bg="#ecfdf5"
                                />
                            </div>

                            {/* ── Meta stats ── */}
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: 'Readiness', value: `${crs}%`, icon: BarChart2, color: 'var(--c-primary)' },
                                    { label: 'Interactions', value: meta.total_interactions ?? 0, icon: Zap, color: 'var(--c-amber)' },
                                    { label: 'Confidence', value: readiness.data_quality ?? '—', icon: Activity, color: 'var(--c-mint)' },
                                    { label: 'Last Active', value: fmtDate(meta.last_activity_at) ?? '—', icon: Clock, color: 'var(--c-text-muted)' },
                                ].map(({ label, value, icon: Ic, color }) => (
                                    <div key={label} className="rounded-2xl p-4 text-center"
                                         style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-soft)' }}>
                                        <Ic className="w-3.5 h-3.5 mx-auto mb-2" style={{ color }} />
                                        <div className="text-[16px] font-black" style={{ color: 'var(--c-text)' }}>{value}</div>
                                        <div className="text-[9px] font-bold uppercase tracking-wider mt-0.5"
                                             style={{ color: 'var(--c-text-muted)' }}>{label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* ── Progress chart ── */}
                            {series && (
                                <div className="rounded-2xl p-5"
                                     style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-strong)' }}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--c-primary)' }} />
                                        <span className="text-[12px] font-bold uppercase tracking-wider"
                                              style={{ color: 'var(--c-text-muted)' }}>
                                            Progress Over Time
                                        </span>
                                    </div>
                                    <MultiLineChart series={series} />
                                </div>
                            )}

                            {/* ── Weak concepts alert ── */}
                            {weak.length > 0 && (
                                <div className="rounded-2xl overflow-hidden"
                                     style={{ border: '1px solid var(--c-amber-light)', background: 'var(--c-surface)' }}>
                                    <div className="px-5 py-3 flex items-center gap-2"
                                         style={{ background: 'var(--c-amber-light)' }}>
                                        <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--c-amber)' }} />
                                        <span className="text-[11px] font-bold uppercase tracking-wide"
                                              style={{ color: 'var(--c-amber)' }}>
                                            {weak.length} concept{weak.length !== 1 ? 's' : ''} need attention
                                        </span>
                                    </div>
                                    <div className="divide-y" style={{ borderColor: 'var(--c-border-soft)' }}>
                                        {weak.map((w) => {
                                            const cs = stateStyle(w.state);
                                            return (
                                                <button
                                                    key={w.name}
                                                    onClick={() => setSelected(w.name === selectedConcept ? null : w.name)}
                                                    className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--c-canvas)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cs.dot }} />
                                                    <span className="flex-1 text-[13px] font-semibold" style={{ color: 'var(--c-text)' }}>{w.name}</span>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                          style={{ background: cs.bg, color: cs.text }}>{w.state}</span>
                                                    {w.action === 'urgent_review' && (
                                                        <span className="text-[10px] font-bold flex items-center gap-0.5"
                                                              style={{ color: 'var(--c-danger)' }}>
                                                            <Flame className="w-3 h-3" /> Urgent
                                                        </span>
                                                    )}
                                                    <ChevronRight className="w-3.5 h-3.5 opacity-30" style={{ color: 'var(--c-text-muted)' }} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ── Concept mastery table ── */}
                            <div className="rounded-2xl overflow-hidden"
                                 style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-strong)' }}>
                                <div className="px-5 py-4 flex items-center justify-between border-b"
                                     style={{ borderColor: 'var(--c-border-soft)' }}>
                                    <div className="flex items-center gap-2">
                                        <Brain className="w-3.5 h-3.5" style={{ color: 'var(--c-primary)' }} />
                                        <span className="text-[12px] font-bold uppercase tracking-wider"
                                              style={{ color: 'var(--c-text-muted)' }}>
                                            Concept Mastery
                                        </span>
                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                                              style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}>
                                            {filteredConcepts.length}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {['all', 'critical', 'weak', 'developing', 'mastered'].map((f) => (
                                            <button
                                                key={f}
                                                onClick={() => setConceptFilter(f)}
                                                className="text-[10px] font-bold px-2 py-0.5 rounded-full transition-all"
                                                style={{
                                                    background: conceptFilter === f ? 'var(--c-primary-light)' : 'transparent',
                                                    color: conceptFilter === f ? 'var(--c-primary)' : 'var(--c-text-muted)',
                                                }}
                                            >
                                                {f}{f !== 'all' && distribution[f] ? ` (${distribution[f]})` : ''}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {loadingConcepts ? (
                                    <div className="p-8 flex items-center justify-center">
                                        <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--c-text-muted)' }} />
                                    </div>
                                ) : filteredConcepts.length === 0 ? (
                                    <div className="py-10 text-center text-[13px]" style={{ color: 'var(--c-text-muted)' }}>
                                        {conceptFilter === 'all'
                                            ? 'No concepts tracked yet. Complete a quiz or exam to see data here.'
                                            : `No concepts in "${conceptFilter}" state.`}
                                    </div>
                                ) : (
                                    <div className="p-2 max-h-96 overflow-y-auto custom-scrollbar">
                                        {filteredConcepts.map((c) => (
                                            <ConceptRow
                                                key={c.name}
                                                concept={c}
                                                isSelected={selectedConcept === c.name}
                                                onClick={() => setSelected(c.name === selectedConcept ? null : c.name)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ── Suggested action ── */}
                            {dashboard.next_suggested_action && (
                                <div className="rounded-2xl p-4 flex items-start gap-3 border"
                                     style={{ borderColor: 'var(--c-primary-light)', background: 'var(--c-primary-ultra)' }}>
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                         style={{ background: 'var(--c-primary-light)' }}>
                                        <Zap className="w-4 h-4" style={{ color: 'var(--c-primary)' }} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wide mb-1"
                                             style={{ color: 'var(--c-primary)' }}>Suggested Next Step</div>
                                        <div className="text-[13px] font-medium" style={{ color: 'var(--c-text-secondary)' }}>
                                            {dashboard.next_suggested_action.reason
                                                ? `${dashboard.next_suggested_action.reason} in ${dashboard.next_suggested_action.concept}.`
                                                : `Focus on ${dashboard.next_suggested_action.concept}.`}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>
            </div>

            {/* ── Concept detail drawer ── */}
            <AnimatePresence>
                {selectedConcept && (
                    <ConceptDetailDrawer
                        key={selectedConcept}
                        subjectId={subjectId}
                        conceptName={selectedConcept}
                        onClose={() => setSelected(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default AnalyticsSubject;

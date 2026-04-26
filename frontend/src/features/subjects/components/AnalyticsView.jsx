import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain, Zap, BookOpen, TrendingUp, TrendingDown, Minus,
    RefreshCw, AlertTriangle, ChevronRight, BarChart2, Layers,
    CheckCircle2, Clock, Target, Flame, Info
} from 'lucide-react';
import useAnalyticsStore from '@/store/useAnalyticsStore';
import AnalyticsService from '@/services/AnalyticsService';

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(v) {
    if (v == null) return null;
    return Math.round(v * 100);
}

function fmt(v) {
    if (v == null) return '—';
    return `${Math.round(v * 100)}%`;
}

function trendIcon(label) {
    if (label === 'improving')  return <TrendingUp  className="w-3.5 h-3.5 text-emerald-500" />;
    if (label === 'declining')  return <TrendingDown className="w-3.5 h-3.5 text-rose-500" />;
    return <Minus className="w-3.5 h-3.5 text-amber-400" />;
}

function stateColor(state) {
    switch (state) {
        case 'mastered':   return { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' };
        case 'developing': return { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500' };
        case 'weak':       return { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500' };
        case 'critical':   return { bg: 'bg-rose-100',    text: 'text-rose-700',    dot: 'bg-rose-500' };
        default:           return { bg: 'bg-gray-100',    text: 'text-gray-500',    dot: 'bg-gray-400' };
    }
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────

function Sparkline({ points = [], color = '#6366f1', height = 40, width = 120 }) {
    if (!points || points.length < 2) return null;
    const max = Math.max(...points, 0.001);
    const min = Math.min(...points);
    const range = max - min || 1;
    const pad = 4;
    const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (width - pad * 2));
    const ys = points.map(v => height - pad - ((v - min) / range) * (height - pad * 2));
    const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
    const fill = `${d} L${xs[xs.length - 1]},${height} L${xs[0]},${height} Z`;
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
            <path d={fill} fill={color} fillOpacity="0.12" />
            <path d={d} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill={color} />
        </svg>
    );
}

// ── Circular Progress ─────────────────────────────────────────────────────────

function CircleScore({ value, size = 80, strokeWidth = 7, color = '#6366f1', label }) {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const pctVal = value ?? 0;
    const offset = circ - (pctVal / 100) * circ;
    return (
        <div className="flex flex-col items-center gap-1">
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={strokeWidth} fill="none" className="text-gray-100" />
                <circle
                    cx={size / 2} cy={size / 2} r={r}
                    stroke={color} strokeWidth={strokeWidth} fill="none"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)' }}
                />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>{label}</span>
        </div>
    );
}

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, sub, color = 'indigo', sparkPoints }) {
    const colors = {
        indigo: { bg: 'bg-indigo-50',  icon: 'text-indigo-500',  val: 'text-indigo-700',  line: '#6366f1' },
        violet: { bg: 'bg-violet-50',  icon: 'text-violet-500',  val: 'text-violet-700',  line: '#8b5cf6' },
        emerald:{ bg: 'bg-emerald-50', icon: 'text-emerald-500', val: 'text-emerald-700', line: '#10b981' },
    };
    const c = colors[color] || colors.indigo;
    return (
        <div className={`rounded-2xl p-4 flex flex-col gap-2 ${c.bg} border border-white/60`}>
            <div className="flex items-center justify-between">
                <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${c.icon}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                </div>
                {sparkPoints && <Sparkline points={sparkPoints} color={c.line} width={80} height={32} />}
            </div>
            <div className={`text-3xl font-black tracking-tight ${c.val}`}>
                {value ?? '—'}
            </div>
            {sub && <div className="text-[11px] font-medium" style={{ color: 'var(--c-text-muted)' }}>{sub}</div>}
        </div>
    );
}

// ── Concept Row ───────────────────────────────────────────────────────────────

function ConceptRow({ concept, onClick }) {
    const c = stateColor(concept.state);
    const crsVal = Math.round((concept.mastery_score ?? 0));
    return (
        <motion.button
            layout
            onClick={onClick}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left hover:bg-gray-50 transition-colors group"
        >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
            <span className="flex-1 text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>
                {concept.topic_name}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
                {concept.state}
            </span>
            <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${crsVal}%`, background: concept.state === 'mastered' ? '#10b981' : concept.state === 'critical' ? '#ef4444' : '#6366f1' }}
                />
            </div>
            <span className="text-xs font-bold w-8 text-right flex-shrink-0" style={{ color: 'var(--c-text-muted)' }}>
                {crsVal}%
            </span>
            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" style={{ color: 'var(--c-text-muted)' }} />
        </motion.button>
    );
}

// ── ConceptDetail Drawer ───────────────────────────────────────────────────────

function ConceptDetail({ subjectId, conceptName, onClose }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        AnalyticsService.getConceptDetail(subjectId, conceptName)
            .then(setDetail)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [subjectId, conceptName]);

    const c = detail ? stateColor(detail.snapshot?.state) : stateColor('unstarted');

    return (
        <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-y-0 right-0 w-80 shadow-2xl flex flex-col z-20"
            style={{ background: 'var(--c-surface)', borderLeft: '1px solid var(--c-border)' }}
        >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--c-border)' }}>
                <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                    <span className="font-bold text-sm truncate max-w-[180px]" style={{ color: 'var(--c-text)' }}>{conceptName}</span>
                </div>
                <button onClick={onClose} className="text-xs font-bold px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: 'var(--c-text-muted)' }}>✕</button>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--c-text-muted)' }} />
                </div>
            ) : !detail ? (
                <div className="flex-1 flex items-center justify-center p-6 text-center text-sm" style={{ color: 'var(--c-text-muted)' }}>
                    No data yet for this concept.
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* CRS */}
                    <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--c-canvas)' }}>
                        <div className="text-4xl font-black tracking-tight mb-0.5" style={{ color: 'var(--c-primary)' }}>
                            {Math.round(detail.snapshot?.mastery_score ?? 0)}%
                        </div>
                        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>Readiness</div>
                    </div>

                    {/* Scores */}
                    <div className="space-y-2">
                        {[
                            { label: 'Quiz Understanding', value: detail.snapshot?.quiz_score },
                            { label: 'Flashcard Retention', value: detail.snapshot?.flashcard_score },
                            { label: 'Exam Mastery', value: detail.snapshot?.exam_score },
                        ].map(({ label, value }) => (
                            value != null && (
                                <div key={label}>
                                    <div className="flex justify-between text-xs font-semibold mb-1" style={{ color: 'var(--c-text-muted)' }}>
                                        <span>{label}</span>
                                        <span>{Math.round(value * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                        <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${Math.round(value * 100)}%` }} />
                                    </div>
                                </div>
                            )
                        ))}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: 'Interactions', value: detail.snapshot?.interaction_count ?? 0, icon: Zap },
                            { label: 'Last Seen', value: detail.snapshot?.last_updated ? new Date(detail.snapshot.last_updated).toLocaleDateString() : '—', icon: Clock },
                        ].map(({ label, value, icon: Ic }) => (
                            <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--c-canvas)' }}>
                                <Ic className="w-3.5 h-3.5 mx-auto mb-1" style={{ color: 'var(--c-text-muted)' }} />
                                <div className="text-lg font-black" style={{ color: 'var(--c-text)' }}>{value}</div>
                                <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Recent quiz responses */}
                    {detail.recentQuizResponses?.length > 0 && (
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--c-text-muted)' }}>Recent Quiz</div>
                            <div className="flex flex-wrap gap-1.5">
                                {detail.recentQuizResponses.slice(0, 20).map((r, i) => (
                                    <span key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${r.is_correct ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>
                                        {r.is_correct ? '✓' : '✗'}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Flashcard due */}
                    {detail.flashcardDue != null && (
                        <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--c-canvas)' }}>
                            <Layers className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                            <div>
                                <div className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>{detail.flashcardDue} card{detail.flashcardDue !== 1 ? 's' : ''} due</div>
                                <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>for review today</div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
}

// ── Main AnalyticsView ────────────────────────────────────────────────────────

const AnalyticsView = ({ subjectId, isExpanded = false }) => {
    const { actions } = useAnalyticsStore();
    const dashboard = useAnalyticsStore(s => s.data.dashboards[subjectId]);
    const progress  = useAnalyticsStore(s => s.data.progress[subjectId]);
    const loading   = useAnalyticsStore(s => s.loading[`dashboard_${subjectId}`]);
    const error     = useAnalyticsStore(s => s.errors[`dashboard_${subjectId}`]);

    const [selectedConcept, setSelectedConcept] = useState(null);
    const [conceptFilter, setConceptFilter]     = useState('all');
    const [refreshing, setRefreshing]           = useState(false);

    const load = useCallback(async (refresh = false) => {
        if (!subjectId) return;
        await Promise.all([
            actions.fetchDashboard(subjectId, { refresh }),
            actions.fetchProgress(subjectId, { granularity: 'week' }),
        ]);
    }, [subjectId, actions]);

    useEffect(() => {
        if (subjectId && !dashboard) load();
    }, [subjectId, dashboard, load]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await load(true).catch(() => {});
        setRefreshing(false);
    };

    const scores     = dashboard?.scores ?? {};
    const concepts   = dashboard?.concepts ?? [];
    const weak       = dashboard?.weakConcepts ?? [];
    const metadata   = scores?.metadata ?? {};

    const trendLabel = scores?.trend?.label ?? 'insufficient_data';
    const readiness  = pct(scores?.readiness != null ? scores.readiness / 100 : null);

    // Progress sparklines — extract per-week accuracy
    const quizPoints = progress?.quiz?.map(p => p.avgAccuracy ?? 0) ?? [];
    const examPoints = progress?.exams?.map(p => p.avgAccuracy ?? 0) ?? [];

    const filteredConcepts = concepts.filter(c => {
        if (conceptFilter === 'all') return true;
        return c.state === conceptFilter;
    });

    // ── Empty state ────────────────────────────────────────────────────────────
    if (!loading && !error && metadata.totalInteractions === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2" style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)' }}>
                    <BarChart2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black" style={{ color: 'var(--c-text)' }}>No study activity yet</h3>
                <p className="text-sm max-w-xs" style={{ color: 'var(--c-text-muted)' }}>
                    Complete quizzes, review flashcards, or take a mock exam — your analytics will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex overflow-hidden relative" style={{ background: 'var(--c-canvas)' }}>

            {/* Main panel */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                    <div className="flex items-center gap-2">
                        <BarChart2 className="w-4 h-4" style={{ color: 'var(--c-primary)' }} />
                        <span className="font-black text-sm tracking-tight" style={{ color: 'var(--c-text)' }}>Learning Analytics</span>
                        {metadata.dataQuality && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                metadata.dataQuality === 'high' ? 'bg-emerald-100 text-emerald-700' :
                                metadata.dataQuality === 'moderate' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-500'
                            }`}>{metadata.dataQuality} confidence</span>
                        )}
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-40"
                        style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-muted)', background: 'var(--c-surface)' }}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="mx-6 mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-3">
                        <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                        <p className="text-sm text-rose-600 font-medium">{error}</p>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Loading skeleton */}
                    {loading && !dashboard && (
                        <div className="space-y-4 animate-pulse">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl bg-gray-100" />)}
                            </div>
                            <div className="h-40 rounded-2xl bg-gray-100" />
                            <div className="h-60 rounded-2xl bg-gray-100" />
                        </div>
                    )}

                    {dashboard && (
                        <>
                            {/* ── Readiness + sub-scores ──────────────────── */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                                {/* Readiness — big circle */}
                                <div className="col-span-2 md:col-span-1 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 border border-white/60"
                                     style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
                                    <CircleScore
                                        value={readiness ?? 0}
                                        size={88}
                                        strokeWidth={8}
                                        color={readiness >= 70 ? '#10b981' : readiness >= 40 ? '#6366f1' : '#ef4444'}
                                        label="Readiness"
                                    />
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-indigo-700">{readiness ?? '—'}%</div>
                                        <div className="flex items-center justify-center gap-1 mt-0.5">
                                            {trendIcon(trendLabel)}
                                            <span className="text-[11px] font-bold capitalize" style={{ color: 'var(--c-text-muted)' }}>{trendLabel.replace('_', ' ')}</span>
                                        </div>
                                    </div>
                                </div>

                                <MetricCard
                                    icon={Brain} label="Understanding" color="indigo"
                                    value={fmt(scores.understanding)}
                                    sub={`${metadata.quizCount ?? 0} quiz responses`}
                                    sparkPoints={quizPoints}
                                />
                                <MetricCard
                                    icon={Layers} label="Retention" color="violet"
                                    value={fmt(scores.retention)}
                                    sub={`${metadata.flashcardCount ?? 0} card reviews`}
                                />
                                <MetricCard
                                    icon={Target} label="Mastery" color="emerald"
                                    value={fmt(scores.mastery)}
                                    sub={`${metadata.examCount ?? 0} exam attempt${metadata.examCount !== 1 ? 's' : ''}`}
                                    sparkPoints={examPoints}
                                />
                            </div>

                            {/* ── Consistency + activity ──────────────────── */}
                            {(scores.consistency != null || metadata.totalInteractions > 0) && (
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-soft)' }}>
                                        <div className="text-2xl font-black mb-0.5" style={{ color: 'var(--c-text)' }}>{fmt(scores.consistency)}</div>
                                        <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>Consistency</div>
                                    </div>
                                    <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-soft)' }}>
                                        <div className="text-2xl font-black mb-0.5" style={{ color: 'var(--c-text)' }}>{metadata.totalInteractions ?? 0}</div>
                                        <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>Interactions</div>
                                    </div>
                                    <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-soft)' }}>
                                        <div className="text-2xl font-black mb-0.5" style={{ color: 'var(--c-text)' }}>{fmt(scores.confidence)}</div>
                                        <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>Confidence</div>
                                    </div>
                                </div>
                            )}

                            {/* ── Weak Concepts ──────────────────────────── */}
                            {weak.length > 0 && (
                                <div className="rounded-2xl border" style={{ borderColor: 'var(--c-border-soft)', background: 'var(--c-surface)' }}>
                                    <div className="px-5 py-3.5 flex items-center gap-2 border-b" style={{ borderColor: 'var(--c-border-soft)' }}>
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                        <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Needs Attention</span>
                                    </div>
                                    <div className="divide-y" style={{ '--tw-divide-opacity': 1 }}>
                                        {weak.slice(0, 5).map((w) => {
                                            const c = stateColor(w.state);
                                            return (
                                                <div key={w.topic_name} className="px-5 py-3 flex items-center gap-3">
                                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                                                    <span className="flex-1 text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>{w.topic_name}</span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>{w.state}</span>
                                                    {w.action === 'urgent_review' && (
                                                        <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5">
                                                            <Flame className="w-3 h-3" /> Urgent
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ── All Concepts ───────────────────────────── */}
                            {concepts.length > 0 && (
                                <div className="rounded-2xl border" style={{ borderColor: 'var(--c-border-soft)', background: 'var(--c-surface)' }}>
                                    <div className="px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--c-border-soft)' }}>
                                        <div className="flex items-center gap-2">
                                            <Brain className="w-3.5 h-3.5" style={{ color: 'var(--c-primary)' }} />
                                            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>
                                                Concept Mastery <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-black">{filteredConcepts.length}</span>
                                            </span>
                                        </div>
                                        {/* Filter pills */}
                                        <div className="flex items-center gap-1">
                                            {['all', 'critical', 'weak', 'developing', 'mastered'].map(f => (
                                                <button
                                                    key={f}
                                                    onClick={() => setConceptFilter(f)}
                                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                                                        conceptFilter === f
                                                            ? 'bg-indigo-100 text-indigo-700'
                                                            : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                                >
                                                    {f}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-2 max-h-80 overflow-y-auto">
                                        {filteredConcepts.length === 0 ? (
                                            <div className="py-8 text-center text-sm font-medium" style={{ color: 'var(--c-text-muted)' }}>
                                                No concepts in "{conceptFilter}" state yet.
                                            </div>
                                        ) : (
                                            filteredConcepts.map(c => (
                                                <ConceptRow
                                                    key={c.topic_name}
                                                    concept={c}
                                                    onClick={() => setSelectedConcept(c.topic_name === selectedConcept ? null : c.topic_name)}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Suggested Action ───────────────────────── */}
                            {dashboard?.suggestedAction && (
                                <div className="rounded-2xl p-4 flex items-start gap-3 border border-indigo-100 bg-indigo-50">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                        <Zap className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-wide text-indigo-600 mb-0.5">Suggested Next Step</div>
                                        <div className="text-sm font-medium text-indigo-900">{dashboard.suggestedAction}</div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── Concept detail drawer ──────────────────────────────────────── */}
            <AnimatePresence>
                {selectedConcept && (
                    <ConceptDetail
                        key={selectedConcept}
                        subjectId={subjectId}
                        conceptName={selectedConcept}
                        onClose={() => setSelectedConcept(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default AnalyticsView;

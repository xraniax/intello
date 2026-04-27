import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart2, Brain, Zap, Target, Layers, TrendingUp, TrendingDown,
    Minus, Flame, ChevronRight, RefreshCw, X, AlertTriangle,
    CheckCircle2, Lightbulb, Clock, Star, Activity,
} from 'lucide-react';
import useAnalyticsStore from '@/store/useAnalyticsStore';
import { useCountUp } from '@/hooks/useCountUp';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d) => {
    if (!d) return null;
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7)  return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
};

const statusStyle = (status) => {
    switch (status) {
        case 'strong':    return { border: 'var(--c-mint)',    bg: 'var(--c-mint-light)',    text: 'var(--c-mint)',    label: 'Strong' };
        case 'developing':return { border: 'var(--c-primary)', bg: 'var(--c-primary-ultra)', text: 'var(--c-primary)', label: 'Developing' };
        case 'weak':      return { border: 'var(--c-amber)',   bg: 'var(--c-amber-light)',   text: 'var(--c-amber)',   label: 'Weak' };
        default:          return { border: 'var(--c-danger)',  bg: 'var(--c-danger-light)',  text: 'var(--c-danger)',  label: 'Critical' };
    }
};

const insightIcon = (type) => {
    switch (type) {
        case 'momentum':     return { Icon: TrendingUp,    color: 'var(--c-mint)',    bg: 'var(--c-mint-light)' };
        case 'forecast':     return { Icon: Target,        color: 'var(--c-primary)', bg: 'var(--c-primary-ultra)' };
        case 'error_pattern':return { Icon: AlertTriangle, color: 'var(--c-amber)',   bg: 'var(--c-amber-light)' };
        case 'streak':       return { Icon: Flame,         color: 'var(--c-coral)',   bg: 'var(--c-coral-light)' };
        default:             return { Icon: Lightbulb,     color: 'var(--c-danger)',  bg: 'var(--c-danger-light)' };
    }
};

// ── Animated counter ──────────────────────────────────────────────────────────

const Counter = ({ value, decimals = 0, suffix = '' }) => {
    const n = useCountUp(Math.round(value), 900);
    return <span>{n}{suffix}</span>;
};

// ── Sparkline (reused from AnalyticsView) ─────────────────────────────────────

function Sparkline({ points = [], color = '#635BFF', height = 32, width = 80 }) {
    if (!points || points.length < 2) return null;
    const max = Math.max(...points, 0.001);
    const min = Math.min(...points);
    const range = max - min || 1;
    const pad = 3;
    const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (width - pad * 2));
    const ys = points.map(v => height - pad - ((v - min) / range) * (height - pad * 2));
    const d    = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
    const fill = `${d} L${xs[xs.length - 1]},${height} L${xs[0]},${height} Z`;
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
            <path d={fill} fill={color} fillOpacity="0.15" />
            <path d={d} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ── Activity heatmap ──────────────────────────────────────────────────────────

function ActivityHeatmap({ heatmap = [] }) {
    const days = 91; // 13 weeks
    const cellSize = 13;
    const cellGap  = 3;
    const colCount = Math.ceil(days / 7);

    const map = new Map(heatmap.map((h) => [h.date, h.count]));
    const today = new Date();

    const cells = Array.from({ length: days }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (days - 1 - i));
        const key   = d.toISOString().slice(0, 10);
        const count = map.get(key) ?? 0;
        const level = count === 0 ? 0 : count <= 3 ? 1 : count <= 8 ? 2 : 3;
        return { date: key, count, level, col: Math.floor(i / 7), row: i % 7 };
    });

    const colors = ['var(--c-surface-alt)', '#c4b5fd', '#8b5cf6', '#5b21b6'];
    const totalW = colCount * (cellSize + cellGap);
    const totalH = 7 * (cellSize + cellGap);

    return (
        <div className="overflow-x-auto">
            <svg width={totalW} height={totalH + 4} style={{ minWidth: totalW }}>
                {cells.map((c, i) => (
                    <g key={i}>
                        <rect
                            x={c.col * (cellSize + cellGap)}
                            y={c.row * (cellSize + cellGap)}
                            width={cellSize} height={cellSize}
                            rx={3}
                            fill={colors[c.level]}
                            style={{ transition: 'fill 0.3s' }}
                        >
                            <title>{c.date}: {c.count} interaction{c.count !== 1 ? 's' : ''}</title>
                        </rect>
                    </g>
                ))}
            </svg>
        </div>
    );
}

// ── Momentum area chart ───────────────────────────────────────────────────────

function MomentumChart({ heatmap = [] }) {
    const svgRef = useRef(null);
    const [width, setWidth] = useState(600);

    useEffect(() => {
        const obs = new ResizeObserver(([e]) => setWidth(e.contentRect.width || 600));
        if (svgRef.current) obs.observe(svgRef.current);
        return () => obs.disconnect();
    }, []);

    const days = 30;
    const today = new Date();
    const map   = new Map(heatmap.map((h) => [h.date, h.count]));

    const data = Array.from({ length: days }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (days - 1 - i));
        const key = d.toISOString().slice(0, 10);
        return { label: key, value: map.get(key) ?? 0 };
    });

    const h = 100;
    const pad = { top: 8, bottom: 20, left: 4, right: 4 };
    const maxVal = Math.max(...data.map((d) => d.value), 1);

    const xs = data.map((_, i) => pad.left + (i / (data.length - 1)) * (width - pad.left - pad.right));
    const ys = data.map((d) => pad.top + (1 - d.value / maxVal) * (h - pad.top - pad.bottom));

    const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L${xs[xs.length - 1]},${h - pad.bottom} L${xs[0]},${h - pad.bottom} Z`;

    // 7-day rolling avg
    const rolling = data.map((_, i) => {
        const slice = data.slice(Math.max(0, i - 3), Math.min(data.length, i + 4));
        return slice.reduce((s, d) => s + d.value, 0) / slice.length;
    });
    const rollingYs = rolling.map((v) => pad.top + (1 - v / maxVal) * (h - pad.top - pad.bottom));
    const rollingPath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${rollingYs[i].toFixed(1)}`).join(' ');

    return (
        <svg ref={svgRef} width="100%" height={h} viewBox={`0 0 ${width} ${h}`} preserveAspectRatio="none">
            <defs>
                <linearGradient id="momentumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#635BFF" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#635BFF" stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#momentumGrad)" />
            <path d={linePath} stroke="#635BFF" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
            <path d={rollingPath} stroke="#635BFF" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ── Readiness ring ────────────────────────────────────────────────────────────

function ReadinessRing({ value = 0, size = 96, strokeWidth = 9 }) {
    const r    = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (value / 100) * circ;
    const color = value >= 70 ? 'var(--c-mint)' : value >= 40 ? 'var(--c-primary)' : 'var(--c-danger)';

    return (
        <svg width={size} height={size} className="-rotate-90" style={{ flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={strokeWidth}
                    fill="none" className="text-gray-100" />
            <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={strokeWidth}
                    fill="none" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }} />
        </svg>
    );
}

// ── Dimension bar ─────────────────────────────────────────────────────────────

function DimBar({ label, value, color }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-muted)' }}>{label}</span>
                <span className="text-[13px] font-black tabular-nums" style={{ color }}>{Math.round(value ?? 0)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${value ?? 0}%` }}
                    transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
                />
            </div>
        </div>
    );
}

// ── Insight card ──────────────────────────────────────────────────────────────

function InsightCard({ insight, onDismiss }) {
    const { Icon, color, bg } = insightIcon(insight.type);
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 260 }}
            className="flex-shrink-0 w-72 rounded-2xl p-4 flex flex-col gap-3 relative"
            style={{ background: 'var(--c-surface)', border: `1.5px solid ${color}22`, boxShadow: 'var(--shadow-xs)' }}
        >
            <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ background: color }} />
            <div className="flex items-start justify-between gap-2 pl-1">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
                        {insight.type.replace('_', ' ')}
                    </span>
                </div>
                <button
                    onClick={() => onDismiss(insight.id)}
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--c-text-muted)' }}
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
            <div className="pl-1">
                <div className="text-[13px] font-bold leading-snug mb-1" style={{ color: 'var(--c-text)' }}>
                    {insight.title}
                </div>
                <div className="text-[12px] leading-relaxed" style={{ color: 'var(--c-text-secondary)' }}>
                    {insight.body}
                </div>
            </div>
            {insight.cta_label && (
                <button
                    onClick={() => {
                        try {
                            const action = typeof insight.cta_action === 'string'
                                ? JSON.parse(insight.cta_action) : insight.cta_action;
                            if (action?.route) window.location.href = action.route;
                        } catch (_) {}
                    }}
                    className="pl-1 text-[11px] font-bold flex items-center gap-1 transition-opacity hover:opacity-70"
                    style={{ color }}
                >
                    {insight.cta_label}
                    <ChevronRight className="w-3 h-3" />
                </button>
            )}
        </motion.div>
    );
}

// ── Subject card ──────────────────────────────────────────────────────────────

function SubjectAnalyticsCard({ subject }) {
    const navigate = useNavigate();
    const st = statusStyle(subject.status);
    const trend = subject.trend_7d;

    return (
        <motion.div
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/analytics/subjects/${subject.id}`)}
            className="rounded-2xl p-5 flex flex-col gap-4 cursor-pointer transition-all"
            style={{
                background: 'var(--c-surface)',
                border: `1.5px solid var(--c-border-strong)`,
                borderLeft: `4px solid ${st.border}`,
                boxShadow: 'var(--shadow-xs)',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; }}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="font-bold text-[15px] truncate" style={{ color: 'var(--c-text)' }}>
                        {subject.name}
                    </h3>
                    {subject.last_activity_at && (
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                            {fmtDate(subject.last_activity_at)}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: st.bg, color: st.text }}>
                        {st.label}
                    </span>
                    {trend !== 0 && (
                        <span className="text-[11px] font-bold flex items-center gap-0.5"
                              style={{ color: trend > 0 ? 'var(--c-mint)' : 'var(--c-danger)' }}>
                            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {trend > 0 ? '+' : ''}{Math.round(trend)}
                        </span>
                    )}
                </div>
            </div>

            {/* CRS bar */}
            <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-muted)' }}>Readiness</span>
                    <span className="text-[13px] font-black tabular-nums" style={{ color: st.text }}>
                        {Math.round(subject.crs)}%
                    </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <motion.div
                        className="h-full rounded-full"
                        style={{ background: st.border }}
                        initial={{ width: 0 }}
                        animate={{ width: `${subject.crs}%` }}
                        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
                    />
                </div>
            </div>

            {/* U / R / M mini row */}
            <div className="flex gap-3 text-[11px]">
                {[
                    { label: 'U', value: subject.understanding, color: '#635BFF' },
                    { label: 'R', value: subject.retention,     color: '#8b5cf6' },
                    { label: 'M', value: subject.mastery,       color: 'var(--c-mint)' },
                ].map(({ label, value, color }) => value != null && (
                    <div key={label} className="flex items-center gap-1">
                        <span className="font-bold" style={{ color }}>{label}</span>
                        <span className="font-semibold tabular-nums" style={{ color: 'var(--c-text-secondary)' }}>
                            {Math.round(value)}%
                        </span>
                    </div>
                ))}
                {subject.concept_count > 0 && (
                    <div className="ml-auto flex items-center gap-1" style={{ color: 'var(--c-text-muted)' }}>
                        <Brain className="w-3 h-3" />
                        <span>{subject.mastered_count}/{subject.concept_count}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-1 text-[11px] font-semibold mt-auto" style={{ color: 'var(--c-primary)' }}>
                View Analytics <ChevronRight className="w-3 h-3" />
            </div>
        </motion.div>
    );
}

// ── KPI strip pill ────────────────────────────────────────────────────────────

function KPIPill({ icon: Icon, label, value, color, bg }) {
    return (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl"
             style={{ background: bg, border: `1px solid ${color}22` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: `${color}22` }}>
                <Icon className="w-4.5 h-4.5" style={{ color }} />
            </div>
            <div>
                <div className="text-[22px] font-black tabular-nums leading-none" style={{ color: 'var(--c-text)' }}>
                    {value}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                    {label}
                </div>
            </div>
        </div>
    );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className = '', style = {} }) {
    return (
        <div className={`rounded-2xl anim-skeleton ${className}`} style={style} />
    );
}

// ── Main Analytics page ───────────────────────────────────────────────────────

const Analytics = () => {
    const navigate   = useNavigate();
    const global     = useAnalyticsStore(s => s.data.global);
    const loading    = useAnalyticsStore(s => s.loading.global);
    const error      = useAnalyticsStore(s => s.errors.global);
    const { actions } = useAnalyticsStore();

    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        await actions.fetchGlobal().catch(() => {});
    }, [actions]);

    useEffect(() => { if (!global) load(); }, [global, load]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const summary    = global?.summary    ?? {};
    const dims       = global?.dimensions ?? {};
    const subjects   = global?.subjects   ?? [];
    const insights   = global?.insights   ?? [];
    const heatmap    = global?.heatmap    ?? [];

    const readiness    = Math.round(summary.overall_readiness ?? 0);
    const streak       = summary.study_streak ?? 0;
    const momentum     = summary.momentum_score ?? 1;
    const mastered     = summary.total_mastered ?? 0;
    const atRisk       = summary.total_at_risk ?? 0;
    const consistency  = Math.round(summary.consistency_score ?? 0);

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ background: 'var(--c-canvas)' }}>
            <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-8">

                {/* ── Page header ── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-[26px] font-black tracking-tight" style={{ color: 'var(--c-text)', letterSpacing: '-0.02em' }}>
                            Learning Analytics
                        </h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                            Your complete study intelligence dashboard
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border transition-all"
                        style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-text-muted)', background: 'var(--c-surface)' }}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${(refreshing || loading) ? 'animate-spin' : ''}`} />
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
                {(loading && !global) && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[1,2,3,4].map(i => <Skeleton key={i} style={{ height: 80 }} />)}
                        </div>
                        <Skeleton style={{ height: 120 }} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[1,2,3,4].map(i => <Skeleton key={i} style={{ height: 160 }} />)}
                        </div>
                    </div>
                )}

                {global && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4 }}
                        className="space-y-8"
                    >
                        {/* ── Zone 1: Hero strip ── */}
                        <div className="rounded-3xl overflow-hidden"
                             style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-strong)', boxShadow: 'var(--shadow-sm)' }}>
                            <div className="p-6 flex flex-col md:flex-row md:items-center gap-6">

                                {/* Readiness ring + number */}
                                <div className="flex items-center gap-4 flex-shrink-0">
                                    <div className="relative">
                                        <ReadinessRing value={readiness} size={96} />
                                        <div className="absolute inset-0 flex items-center justify-center rotate-90">
                                            <span className="text-[18px] font-black tabular-nums" style={{ color: 'var(--c-text)' }}>
                                                <Counter value={readiness} />%
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-muted)' }}>
                                            Overall Readiness
                                        </div>
                                        <div className="text-sm font-semibold mt-0.5" style={{ color: 'var(--c-text-secondary)' }}>
                                            {readiness >= 75 ? 'Exam ready' : readiness >= 50 ? 'Developing well' : 'Keep studying'}
                                        </div>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="hidden md:block w-px h-16 flex-shrink-0" style={{ background: 'var(--c-border-soft)' }} />

                                {/* KPI pills */}
                                <div className="flex flex-wrap gap-3 flex-1">
                                    <KPIPill icon={Flame}        label="Day Streak"   value={streak}
                                             color="var(--c-coral)"    bg="var(--c-coral-light)" />
                                    <KPIPill icon={CheckCircle2} label="Mastered"     value={mastered}
                                             color="var(--c-mint)"     bg="var(--c-mint-light)" />
                                    <KPIPill icon={AlertTriangle} label="At Risk"     value={atRisk}
                                             color="var(--c-amber)"    bg="var(--c-amber-light)" />
                                    <KPIPill icon={Activity}     label="Consistency"  value={`${consistency}%`}
                                             color="var(--c-primary)"  bg="var(--c-primary-ultra)" />
                                    <KPIPill icon={TrendingUp}   label="Momentum"
                                             value={momentum >= 1 ? `↑ ${momentum.toFixed(1)}×` : `↓ ${momentum.toFixed(1)}×`}
                                             color={momentum >= 1 ? 'var(--c-mint)' : 'var(--c-danger)'}
                                             bg={momentum >= 1 ? 'var(--c-mint-light)' : 'var(--c-danger-light)'} />
                                </div>
                            </div>

                            {/* Dimension bars */}
                            <div className="px-6 pb-6 grid grid-cols-3 gap-4">
                                <DimBar label="Understanding" value={dims.understanding} color="#635BFF" />
                                <DimBar label="Retention"     value={dims.retention}     color="#8b5cf6" />
                                <DimBar label="Mastery"       value={dims.mastery}        color="var(--c-mint)" />
                            </div>
                        </div>

                        {/* ── Zone 2: Insight feed ── */}
                        {insights.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Lightbulb className="w-4 h-4" style={{ color: 'var(--c-primary)' }} />
                                    <span className="text-[13px] font-bold" style={{ color: 'var(--c-text)' }}>Smart Insights</span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                          style={{ background: 'var(--c-primary-ultra)', color: 'var(--c-primary)' }}>
                                        {insights.length}
                                    </span>
                                </div>
                                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                                    <AnimatePresence>
                                        {insights.map((ins) => (
                                            <InsightCard
                                                key={ins.id}
                                                insight={ins}
                                                onDismiss={actions.dismissInsight}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}

                        {/* ── Zone 3: Subject grid ── */}
                        {subjects.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <BarChart2 className="w-4 h-4" style={{ color: 'var(--c-primary)' }} />
                                        <span className="text-[13px] font-bold" style={{ color: 'var(--c-text)' }}>
                                            Subjects
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                              style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}>
                                            {subjects.length}
                                        </span>
                                    </div>
                                    {global.strongest_subject && (
                                        <div className="text-[11px] flex items-center gap-1" style={{ color: 'var(--c-text-muted)' }}>
                                            <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" />
                                            <span>Strongest: <strong style={{ color: 'var(--c-text)' }}>{global.strongest_subject.name}</strong></span>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {subjects.map((s, i) => (
                                        <motion.div
                                            key={s.id}
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05, type: 'spring', damping: 22, stiffness: 260 }}
                                        >
                                            <SubjectAnalyticsCard subject={s} />
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Zone 4: Activity heatmap + momentum chart ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                            {/* Heatmap */}
                            <div className="rounded-2xl p-5"
                                 style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-strong)' }}>
                                <div className="flex items-center gap-2 mb-4">
                                    <Clock className="w-3.5 h-3.5" style={{ color: 'var(--c-primary)' }} />
                                    <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-muted)' }}>
                                        Activity — last 13 weeks
                                    </span>
                                    <span className="ml-auto text-[10px] font-medium" style={{ color: 'var(--c-text-muted)' }}>
                                        {summary.active_days_30d ?? 0} active days this month
                                    </span>
                                </div>
                                <ActivityHeatmap heatmap={heatmap} />
                                <div className="flex items-center gap-2 mt-3">
                                    <span className="text-[10px]" style={{ color: 'var(--c-text-muted)' }}>Less</span>
                                    {['var(--c-surface-alt)', '#c4b5fd', '#8b5cf6', '#5b21b6'].map((c, i) => (
                                        <div key={i} className="w-3 h-3 rounded-sm" style={{ background: c }} />
                                    ))}
                                    <span className="text-[10px]" style={{ color: 'var(--c-text-muted)' }}>More</span>
                                </div>
                            </div>

                            {/* Momentum chart */}
                            <div className="rounded-2xl p-5"
                                 style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-strong)' }}>
                                <div className="flex items-center gap-2 mb-4">
                                    <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--c-primary)' }} />
                                    <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-muted)' }}>
                                        Study Momentum — 30 days
                                    </span>
                                </div>
                                <MomentumChart heatmap={heatmap} />
                                <div className="flex items-center gap-4 mt-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-6 h-0.5 rounded-full" style={{ background: '#635BFF', opacity: 0.4 }} />
                                        <span className="text-[10px]" style={{ color: 'var(--c-text-muted)' }}>Daily</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-6 h-0.5 rounded-full" style={{ background: '#635BFF' }} />
                                        <span className="text-[10px]" style={{ color: 'var(--c-text-muted)' }}>7-day avg</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Empty state ── */}
                        {subjects.length === 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-col items-center py-20 text-center"
                            >
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                                     style={{ background: 'var(--c-primary-ultra)' }}>
                                    <Brain className="w-8 h-8" style={{ color: 'var(--c-primary)' }} />
                                </div>
                                <h3 className="text-lg font-black mb-2" style={{ color: 'var(--c-text)' }}>
                                    No study activity yet
                                </h3>
                                <p className="text-sm max-w-xs mb-6" style={{ color: 'var(--c-text-muted)' }}>
                                    Complete quizzes, review flashcards, or take exams across your subjects — your analytics will appear here.
                                </p>
                                <button
                                    onClick={() => navigate('/dashboard')}
                                    className="btn btn-md btn-solid"
                                >
                                    Go to Dashboard
                                </button>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default Analytics;

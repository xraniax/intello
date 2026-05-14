import React, { useEffect, useState } from 'react';
import {
    Star, TrendingDown, Users, BookOpen,
    AlertTriangle, BarChart3, Target, Loader2,
} from 'lucide-react';
import RatingService from '@/services/RatingService';
import StarRating from '@/components/Rating/StarRating';

// ── Helpers ────────────────────────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, accent }) {
    return (
        <div
            className="flex flex-col gap-1.5 p-4 rounded-2xl"
            style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-soft)' }}
        >
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: accent + '22' }}>
                    <Icon size={16} style={{ color: accent }} />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--c-text-muted)' }}>{label}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--c-text)' }}>{value ?? '—'}</p>
            {sub && <p className="text-xs" style={{ color: 'var(--c-text-muted)' }}>{sub}</p>}
        </div>
    );
}

function RatingBar({ label, count, max, accent = '#f59e0b' }) {
    const pct = max > 0 ? Math.round((count / max) * 100) : 0;
    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="w-14 shrink-0 font-medium" style={{ color: 'var(--c-text-muted)' }}>{label}</span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--c-surface-alt)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accent }} />
            </div>
            <span className="w-8 text-right font-semibold" style={{ color: 'var(--c-text)' }}>{count}</span>
        </div>
    );
}

function MaterialRow({ m }) {
    const avg = parseFloat(m.avg_rating || 0);
    const color = avg >= 4 ? '#22c55e' : avg >= 3 ? '#f59e0b' : '#ef4444';
    return (
        <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'var(--c-surface-alt)' }}
        >
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>{m.title}</p>
                <p className="text-xs" style={{ color: 'var(--c-text-muted)' }}>
                    {m.subject_name} · {m.type} · {m.total_ratings} rating{m.total_ratings !== 1 ? 's' : ''}
                </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                <Star size={13} style={{ fill: color, color }} />
                <span className="text-sm font-bold" style={{ color }}>{avg.toFixed(1)}</span>
            </div>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function RatingAnalytics() {
    const [data, setData]     = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState(null);

    useEffect(() => {
        RatingService.getAdminOverview({ limit: 15, minRatings: 1 })
            .then((res) => setData(res.data?.data))
            .catch((err) => setError(err.response?.data?.message || err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={28} className="animate-spin" style={{ color: 'var(--c-primary)' }} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--c-danger)' }}>
                <AlertTriangle size={16} />
                {error}
            </div>
        );
    }

    const ov = data?.overview;
    const dist = {}; // flattened across worst materials — we compute from ov

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto py-6">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>
                    Rating Analytics
                </h2>
                <p className="text-sm mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                    Platform-wide educational quality overview
                </p>
            </div>

            {/* ── KPI Cards ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPICard
                    icon={Star}
                    label="Avg Rating"
                    value={ov?.platform_avg_rating ? `${parseFloat(ov.platform_avg_rating).toFixed(1)} / 5` : '—'}
                    sub="across all materials"
                    accent="#f59e0b"
                />
                <KPICard
                    icon={BarChart3}
                    label="Total Ratings"
                    value={ov?.total_ratings?.toLocaleString() ?? '—'}
                    sub="submitted by students"
                    accent="var(--c-primary)"
                />
                <KPICard
                    icon={Target}
                    label="Effectiveness"
                    value={ov?.platform_effectiveness_rate != null ? `${parseFloat(ov.platform_effectiveness_rate).toFixed(0)}%` : '—'}
                    sub="found material helpful"
                    accent="#22c55e"
                />
                <KPICard
                    icon={Users}
                    label="Unique Raters"
                    value={ov?.unique_raters?.toLocaleString() ?? '—'}
                    sub={`across ${ov?.rated_materials ?? '?'} materials`}
                    accent="#8b5cf6"
                />
            </div>

            {/* ── Worst materials ────────────────────────────────────────── */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--c-border-soft)' }}>
                <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--c-border-soft)', background: 'var(--c-surface)' }}>
                    <TrendingDown size={16} style={{ color: 'var(--c-danger)' }} />
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>
                        Lowest-rated materials
                    </h3>
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--c-danger)' }}>
                        Needs attention
                    </span>
                </div>
                <div className="p-3 flex flex-col gap-2" style={{ background: 'var(--c-surface)' }}>
                    {(!data?.worst_materials || data.worst_materials.length === 0) ? (
                        <p className="text-sm text-center py-6" style={{ color: 'var(--c-text-muted)' }}>No rated materials yet.</p>
                    ) : (
                        data.worst_materials.map((m) => <MaterialRow key={m.id} m={m} />)
                    )}
                </div>
            </div>

            {/* ── Per-subject table ──────────────────────────────────────── */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--c-border-soft)' }}>
                <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--c-border-soft)', background: 'var(--c-surface)' }}>
                    <BookOpen size={16} style={{ color: 'var(--c-primary)' }} />
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>Satisfaction by subject</h3>
                </div>
                <div style={{ background: 'var(--c-surface)' }}>
                    {(!data?.by_subject || data.by_subject.length === 0) ? (
                        <p className="text-sm text-center py-6" style={{ color: 'var(--c-text-muted)' }}>No data yet.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--c-border-soft)' }}>
                                    {['Subject', 'Ratings', 'Avg', 'Effectiveness'].map((h) => (
                                        <th key={h} className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.by_subject.map((s) => {
                                    const avg = parseFloat(s.avg_rating || 0);
                                    const color = avg >= 4 ? '#22c55e' : avg >= 3 ? '#f59e0b' : '#ef4444';
                                    return (
                                        <tr key={s.subject_id} style={{ borderBottom: '1px solid var(--c-border-soft)' }}>
                                            <td className="px-5 py-3 font-medium" style={{ color: 'var(--c-text)' }}>{s.subject_name}</td>
                                            <td className="px-5 py-3" style={{ color: 'var(--c-text-muted)' }}>{s.total_ratings}</td>
                                            <td className="px-5 py-3">
                                                <span className="font-bold" style={{ color }}>{avg.toFixed(1)}</span>
                                                <StarRating value={Math.round(avg)} readOnly showLabel={false} size={13} />
                                            </td>
                                            <td className="px-5 py-3" style={{ color: 'var(--c-text-muted)' }}>
                                                {s.effectiveness_rate != null
                                                    ? `${parseFloat(s.effectiveness_rate).toFixed(0)}%`
                                                    : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

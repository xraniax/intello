import React, { useState, useEffect } from 'react';
import { adminService } from '@/features/admin/services/AdminService';
import {
    Save, HardDrive, RefreshCw, AlertCircle, FileType,
    ShieldCheck, Trash2, Users, Upload, ToggleLeft, ToggleRight, X,
    Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatBytes } from '@/utils/format';

// ─── Preset chip button ──────────────────────────────────────────────────────
const PresetChip = ({ label, active, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`py-1.5 px-3.5 rounded-xl text-sm font-bold transition-all border ${
            active
                ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border-gray-100'
        }`}
    >
        {label}
    </button>
);

// ─── Section card wrapper ────────────────────────────────────────────────────
const Section = ({ color, icon: Icon, title, description, children }) => {
    const colors = {
        indigo: { bar: 'bg-indigo-500', icon: 'bg-indigo-50 text-indigo-500' },
        orange: { bar: 'bg-orange-400', icon: 'bg-orange-50 text-orange-500' },
        teal:   { bar: 'bg-teal-500',  icon: 'bg-teal-50 text-teal-500' },
        rose:   { bar: 'bg-rose-500',  icon: 'bg-rose-50 text-rose-500' },
    }[color] || { bar: 'bg-gray-400', icon: 'bg-gray-50 text-gray-500' };

    return (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden relative">
            <div className={`absolute top-0 left-0 w-1 h-full ${colors.bar}`} />
            <div className="p-6 md:p-8">
                <div className="flex items-start gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors.icon}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-gray-900">{title}</h2>
                        {description && <p className="text-xs text-gray-400 font-medium mt-0.5">{description}</p>}
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
};

// ─── Number input with unit label ────────────────────────────────────────────
const UnitInput = ({ value, onChange, placeholder, unit, min, max }) => (
    <div className="relative">
        <input
            type="number"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            min={min}
            max={max}
            className="w-full bg-gray-50 focus:bg-white border border-transparent focus:border-indigo-400 text-gray-900 font-bold rounded-xl px-4 py-3 pr-14 outline-none transition-all shadow-sm focus:ring-4 focus:ring-indigo-100"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400 pointer-events-none">
            {unit}
        </span>
    </div>
);

// ─── Usage Bar ────────────────────────────────────────────────────────────────
const UsageBar = ({ used, total, color = 'indigo', label }) => {
    const pct = total > 0 ? Math.min((Number(used) / Number(total)) * 100, 100) : 0;
    const colorMap = {
        indigo:  { bar: 'bg-indigo-500',  track: 'bg-indigo-100',  text: 'text-indigo-700' },
        orange:  { bar: 'bg-orange-400',  track: 'bg-orange-100',  text: 'text-orange-700' },
        emerald: { bar: 'bg-emerald-500', track: 'bg-emerald-100', text: 'text-emerald-700' },
        red:     { bar: 'bg-red-500',     track: 'bg-red-100',     text: 'text-red-700' },
    };
    const c = colorMap[pct > 85 ? 'red' : pct > 60 ? 'orange' : color] || colorMap.indigo;

    return (
        <div className="animate-in fade-in slide-in-from-left-4 duration-500">
            {label && (
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span>
                    <span className={`text-xs font-black ${c.text}`}>{pct.toFixed(1)}%</span>
                </div>
            )}
            <div className={`w-full h-2 ${c.track} rounded-full overflow-hidden shadow-inner`}>
                <div className={`h-full ${c.bar} rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(0,0,0,0.1)]`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between mt-1">
                <span className="text-[10px] text-gray-400 font-medium">{formatBytes(Number(used))} used</span>
                <span className="text-[10px] text-gray-400 font-medium">{formatBytes(Number(total))} total</span>
            </div>
        </div>
    );
};

// ─── Toggle row ───────────────────────────────────────────────────────────────
const ToggleRow = ({ label, description, value, onChange }) => (
    <div className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0 group">
        <div>
            <p className="text-sm font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{label}</p>
            {description && <p className="text-xs text-gray-400 font-medium mt-0.5">{description}</p>}
        </div>
        <button
            type="button"
            onClick={() => onChange(!value)}
            className={`transition-all duration-300 ${value ? 'text-emerald-500 scale-110' : 'text-gray-300'} hover:scale-125 active:scale-95`}
        >
            {value
                ? <ToggleRight className="w-9 h-9" />
                : <ToggleLeft className="w-9 h-9" />
            }
        </button>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const COMMON_MIME_TYPES = [
    { label: 'PDF', value: 'application/pdf' },
    { label: 'Word', value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { label: 'PowerPoint', value: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    { label: 'Text', value: 'text/plain' },
    { label: 'Images', value: 'image/jpeg' },
    { label: 'PNG', value: 'image/png' },
];

const AdminSettings = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [defaultQuotaMb, setDefaultQuotaMb] = useState(100);
    const [maxClusterSizeGb, setMaxClusterSizeGb] = useState(100);
    const [maxFileSizeMb, setMaxFileSizeMb] = useState(10);
    const [trashTtlDays, setTrashTtlDays] = useState(30);
    const [allowedTypes, setAllowedTypes] = useState([]);
    const [mimeInput, setMimeInput] = useState('');
    const [allowPublicRegistration, setAllowPublicRegistration] = useState(true);
    const [studentCount, setStudentCount] = useState(0);
    const [budget, setBudget] = useState(null);
    const [isImpactLoading, setIsImpactLoading] = useState(false);
    const [impactCount, setImpactCount] = useState(null);
    const [stats, setStats] = useState({ total_storage_bytes: 0 });
    const [isCleaning, setIsCleaning] = useState(false);
    const [cleanupResult, setCleanupResult] = useState(null);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await adminService.getSettings();
            const s = res.data.data.storage || {};
            const statsData = res.data.data.stats || { total_storage_bytes: 0 };
            
            setDefaultQuotaMb(s.default_user_quota_mb ?? 100);
            setMaxClusterSizeGb(s.max_cluster_size_gb ?? (s.max_cluster_size_bytes ? Math.round(s.max_cluster_size_bytes / 1073741824) : 100));
            setMaxFileSizeMb(s.max_file_size_mb ?? 10);
            setTrashTtlDays(s.trash_ttl_days ?? 30);
            setAllowedTypes(s.allowed_types || []);
            setAllowPublicRegistration(s.allow_public_registration !== false);
            setStats(statsData);
            
            // Initial impact fetch is handled by useEffect below now
        } catch {
            toast.error('Failed to load system settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSettings(); }, []);

    // Debounced impact analysis
    useEffect(() => {
        const t = setTimeout(async () => {
            if (!defaultQuotaMb) return;
            setIsImpactLoading(true);
            try {
                const res = await adminService.getQuotaImpact(defaultQuotaMb);
                setImpactCount(res.data.data.count);
                setStudentCount(res.data.data.studentCount || 0);
                setBudget(res.data.data.budget);
            } catch { /* silent */ }
            finally { setIsImpactLoading(false); }
        }, 700);
        return () => clearTimeout(t);
    }, [defaultQuotaMb]);

    // Logic: Theoretical Capacity
    const defaultPoolUserCount = budget?.default_quota_user_count || 0;
    const customPoolBytes = BigInt(budget?.custom_quota_total_bytes || 0);
    const theoreticalTotalBytes = (BigInt(defaultPoolUserCount) * BigInt(defaultQuotaMb) * BigInt(1048576)) + customPoolBytes;
    const ceilingBytes = BigInt(maxClusterSizeGb) * BigInt(1073741824);
    const isCapacityViolated = theoreticalTotalBytes > ceilingBytes;
    const theoreticalTotalGb = Number(theoreticalTotalBytes) / 1073741824;

    const handleSave = async (e) => {
        e.preventDefault();
        if (isCapacityViolated) {
            toast.error(`Cannot save: Theoretical allocation (${theoreticalTotalGb.toFixed(2)} GB) exceeds platform ceiling.`);
            return;
        }
        if (!allowedTypes.length) {
            toast.error('At least one allowed MIME type is required.');
            return;
        }
        if (defaultQuotaMb <= 0 || maxFileSizeMb <= 0 || maxClusterSizeGb <= 0 || trashTtlDays <= 0) {
            toast.error('All numeric limits must be greater than zero.');
            return;
        }
        setSaving(true);
        try {
            await adminService.updateSettings({
                storage: {
                    default_user_quota_mb: parseInt(defaultQuotaMb),
                    max_cluster_size_gb: parseInt(maxClusterSizeGb),
                    max_cluster_size_bytes: parseInt(maxClusterSizeGb) * 1073741824,
                    max_file_size_mb: parseInt(maxFileSizeMb),
                    trash_ttl_days: parseInt(trashTtlDays),
                    allowed_types: allowedTypes,
                    allow_public_registration: allowPublicRegistration,
                }
            });
            toast.success('System rules updated successfully.');
        } catch (err) {
            toast.error('Failed to save: ' + (err?.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const handleCleanup = async () => {
        if (!window.confirm('Run storage cleanup? This permanently deletes orphaned files.')) return;
        setIsCleaning(true);
        try {
            const res = await adminService.cleanupStorage();
            setCleanupResult(res.data.data);
            toast.success(res.data.message || 'Cleanup complete');
        } catch (err) {
            toast.error(err.message || 'Cleanup failed');
        } finally {
            setIsCleaning(false);
        }
    };

    const addMime = (val) => {
        const trimmed = val.trim();
        if (trimmed && !allowedTypes.includes(trimmed)) {
            setAllowedTypes(prev => [...prev, trimmed]);
        }
        setMimeInput('');
    };

    const handleMimeKey = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addMime(mimeInput); }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-10">
                <div className="bg-white rounded-[2.5rem] border border-gray-100 p-20 text-center shadow-sm">
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-sm animate-pulse">Loading configuration...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">System Rules</h1>
                    <p className="text-gray-500 font-medium">Configure global storage limits, access policies, and platform behaviour.</p>
                </div>
                <button
                    type="button"
                    onClick={fetchSettings}
                    className="flex items-center justify-center gap-2 p-3 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">

                {/* ── User Quotas ── */}
                <Section color="indigo" icon={Users} title="User Storage Quotas" description="Default and platform-wide storage ceiling per user.">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Default User Quota</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {[100, 500, 1024, 2048, 5120, 10240].map(p => (
                                        <PresetChip
                                            key={p}
                                            label={p >= 1024 ? `${p/1024} GB` : `${p} MB`}
                                            active={String(defaultQuotaMb) === String(p)}
                                            onClick={() => setDefaultQuotaMb(p)}
                                        />
                                    ))}
                                </div>
                                <UnitInput
                                    value={defaultQuotaMb}
                                    onChange={e => setDefaultQuotaMb(e.target.value)}
                                    placeholder="e.g. 100"
                                    unit="MB"
                                    min={1}
                                />
                                <p className="text-[10px] text-gray-400 font-medium">Applied when a user has no individual quota override.</p>
                            </div>

                            {/* Impact Report Pill */}
                            <div className={`p-4 rounded-[1.5rem] border text-[11px] transition-all duration-500 shadow-sm ${
                                isCapacityViolated ? 'bg-red-50 border-red-200 text-red-800' 
                                    : impactCount == null ? 'bg-gray-50 border-gray-100 text-gray-400'
                                    : impactCount > 0 ? 'bg-orange-50 border-orange-200 text-orange-800'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            }`}>
                                <div className="flex items-center gap-3 font-bold mb-3">
                                    <Activity className={`w-4 h-4 shrink-0 ${isCapacityViolated ? 'text-red-500 anim-pulse' : impactCount > 0 ? 'text-orange-500' : 'text-emerald-500'}`} />
                                    <span>
                                        {isImpactLoading ? 'Calculating capacity impact…'
                                            : isCapacityViolated ? 'Allocation exceeds platform capacity'
                                            : impactCount > 0 ? `${impactCount} users exceed this new limit`
                                            : 'Allocation satisfied by cluster'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 p-2.5 bg-white/50 rounded-xl border border-white/50 font-black uppercase tracking-tighter text-[9px]">
                                    <div className="flex flex-col">
                                        <span className="opacity-50">Proposed Total</span>
                                        <span className={isCapacityViolated ? 'text-red-600' : 'text-gray-900'}>{theoreticalTotalGb.toFixed(2)} GB</span>
                                    </div>
                                    <div className="flex flex-col border-l border-gray-200/50 pl-3">
                                        <span className="opacity-50">Platform Ceiling</span>
                                        <span className="text-gray-900">{maxClusterSizeGb} GB</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest flex justify-between items-center">
                                    Platform Capacity Ceiling
                                    <span className={isCapacityViolated ? 'text-red-600' : 'text-indigo-600'}>{maxClusterSizeGb} GB</span>
                                </label>
                                <input
                                    type="range" min={10} max={2000} step={10}
                                    value={maxClusterSizeGb}
                                    onChange={e => setMaxClusterSizeGb(e.target.value)}
                                    className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-500 mb-2"
                                />
                                <UnitInput
                                    value={maxClusterSizeGb}
                                    onChange={e => setMaxClusterSizeGb(e.target.value)}
                                    placeholder="e.g. 100"
                                    unit="GB"
                                    min={1}
                                />
                                <UsageBar 
                                    used={stats?.total_storage_bytes || 0} 
                                    total={BigInt(maxClusterSizeGb) * BigInt(1073741824)} 
                                    label="Current Physical Usage" 
                                />
                            </div>
                        </div>
                    </div>
                </Section>

                {/* ── File Upload Rules ── */}
                <Section color="teal" icon={Upload} title="File Upload Rules" description="Maximum upload size and permitted file types.">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Max File Size per Upload</label>
                            <div className="flex flex-wrap gap-2">
                                {[5, 10, 25, 50, 100].map(p => (
                                    <PresetChip
                                        key={p}
                                        label={`${p} MB`}
                                        active={String(maxFileSizeMb) === String(p)}
                                        onClick={() => setMaxFileSizeMb(p)}
                                    />
                                ))}
                            </div>
                            <UnitInput
                                value={maxFileSizeMb}
                                onChange={e => setMaxFileSizeMb(e.target.value)}
                                placeholder="e.g. 10"
                                unit="MB"
                                min={1}
                                max={500}
                            />
                            <p className="text-[10px] text-gray-400 font-medium">Uploads exceeding this size are rejected by the server before processing.</p>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <FileType className="w-3.5 h-3.5" /> Allowed MIME Types
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {COMMON_MIME_TYPES.map(m => (
                                    <button
                                        key={m.value}
                                        type="button"
                                        onClick={() => addMime(m.value)}
                                        disabled={allowedTypes.includes(m.value)}
                                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${
                                            allowedTypes.includes(m.value)
                                                ? 'bg-teal-50 text-teal-700 border-teal-100 opacity-60 cursor-default'
                                                : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100 hover:text-gray-800'
                                        }`}
                                    >
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                            <div className="w-full bg-gray-50 focus-within:bg-white border border-transparent focus-within:border-teal-400 rounded-xl px-3 py-2.5 transition-all shadow-sm focus-within:ring-4 focus-within:ring-teal-100 min-h-[3rem] flex flex-wrap gap-2 items-center">
                                {allowedTypes.map(t => (
                                    <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-100 text-teal-800 text-xs font-bold whitespace-nowrap">
                                        {t}
                                        <button type="button" onClick={() => setAllowedTypes(prev => prev.filter(x => x !== t))} className="hover:text-teal-900 transition-colors">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                                <input
                                    type="text"
                                    value={mimeInput}
                                    onChange={e => setMimeInput(e.target.value)}
                                    onKeyDown={handleMimeKey}
                                    className="flex-1 bg-transparent border-none outline-none text-gray-800 font-mono text-xs placeholder-gray-400 min-w-[150px]"
                                    placeholder="Type MIME and press Enter..."
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 font-medium">Click quick tags above or type a MIME type (e.g. <code className="bg-gray-100 px-1 rounded">application/pdf</code>) and press Enter.</p>
                        </div>
                    </div>
                </Section>

                {/* ── Retention & Maintenance ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Section color="rose" icon={Trash2} title="Retention Settings" description="Soft-deletion policies for assets.">
                        <div className="space-y-4">
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Trash Retention Period</label>
                            <div className="flex flex-wrap gap-2">
                                {[7, 14, 30, 60].map(p => (
                                    <PresetChip
                                        key={p}
                                        label={`${p}d`}
                                        active={String(trashTtlDays) === String(p)}
                                        onClick={() => setTrashTtlDays(p)}
                                    />
                                ))}
                            </div>
                            <UnitInput
                                value={trashTtlDays}
                                onChange={e => setTrashTtlDays(e.target.value)}
                                placeholder="e.g. 30"
                                unit="days"
                                min={1}
                            />
                        </div>
                    </Section>

                    <Section color="orange" icon={RefreshCw} title="Storage Maintenance" description="Purge orphaned files and reclaim space.">
                        <div className="space-y-4">
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tight leading-relaxed">
                                Use this tool to scan for files that exist on disk but have no database references.
                            </p>
                            
                            {cleanupResult ? (
                                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 animate-in zoom-in-95 duration-500">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black uppercase text-emerald-600">Scan Complete</span>
                                        <button type="button" onClick={() => setCleanupResult(null)} className="text-emerald-400 hover:text-emerald-600">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[11px] font-bold">
                                            <span className="text-emerald-800">Orphans Deleted</span>
                                            <span>{cleanupResult.orphansDeleted}</span>
                                        </div>
                                        <div className="flex justify-between text-[11px] font-bold">
                                            <span className="text-emerald-800">Space Freed</span>
                                            <span>{formatBytes(Number(cleanupResult.spaceFreedBytes))}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleCleanup}
                                    disabled={isCleaning}
                                    className="w-full flex items-center justify-center gap-3 py-3.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-gray-200 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isCleaning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
                                    {isCleaning ? 'Scanning Volume…' : 'Run Storage Cleanup'}
                                </button>
                            )}
                        </div>
                    </Section>
                </div>

                {/* ── Access Policies ── */}
                <Section color="orange" icon={ShieldCheck} title="Access Policies" description="Control platform-level registration and security behaviour.">
                    <ToggleRow
                        label="Allow Public Registration"
                        description="When disabled, new users cannot self-register — only admins can create accounts."
                        value={allowPublicRegistration}
                        onChange={setAllowPublicRegistration}
                    />
                </Section>

                {/* ── Save ── */}
                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-gray-400 font-medium max-w-xs">
                        Changes take effect immediately for new uploads and registrations.
                    </p>
                    <button
                        type="submit"
                        disabled={saving || isCapacityViolated}
                        className={`px-8 py-3 font-bold text-sm rounded-xl transition-all shadow-xl flex items-center gap-3 active:scale-95 ${
                            isCapacityViolated 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed grayscale' 
                                : 'bg-gray-900 text-white hover:bg-black'
                        } ${saving ? 'opacity-70 pointer-events-none' : ''}`}
                    >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save System Rules
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AdminSettings;

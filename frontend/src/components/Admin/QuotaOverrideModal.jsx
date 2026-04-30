import React, { useState, useEffect } from 'react';
import { HardDrive, AlertCircle, RefreshCw, Star, Info } from 'lucide-react';
import CustomModal from '@/components/ui/CustomModal';
import { formatBytes } from '@/utils/format';

const QuotaOverrideModal = ({ isOpen, onClose, onSave, user, globalSettings, storageBudget, isLoading }) => {
    const defaultQuotaMb = globalSettings?.default_user_quota_mb || 100;
    const currentLimitBytes = user?.storage_limit_bytes;
    const currentLimitMb = currentLimitBytes ? Math.round(currentLimitBytes / (1024 * 1024)) : '';
    const usageBytes = parseInt(user?.storage_usage_bytes) || 0;
    
    // Form state
    const [mbValue, setMbValue] = useState(currentLimitMb);
    const [isDefault, setIsDefault] = useState(!currentLimitBytes);
    const [unit, setUnit] = useState('MB'); // 'MB', 'GB', or 'TB'

    useEffect(() => {
        if (isOpen && user) {
            const limit = user.storage_limit_bytes;
            setMbValue(limit ? Math.round(limit / (1024 * 1024)) : '');
            setIsDefault(!limit);
        }
    }, [isOpen, user]);

    const handleSave = () => {
        onSave(user, isDefault ? null : mbValue);
    };

    const targetLimitBytes = isDefault ? (defaultQuotaMb * 1024 * 1024) : (parseInt(mbValue) * 1024 * 1024 || 0);
    const usagePercent = Math.min((usageBytes / (targetLimitBytes || 1)) * 100, 100);
    const isExceeding = usageBytes > targetLimitBytes;

    // Capacity Logic
    const ceilingGb = globalSettings?.max_cluster_size_gb || 100;
    const ceilingBytes = ceilingGb * 1073741824;
    
    // Sum of OTHER custom quotas + Current Proposed + Users on Default
    const defaultUserCount = storageBudget?.default_quota_user_count || 0;
    const customQuotaTotal = parseInt(storageBudget?.custom_quota_total_bytes) || 0;
    const currentUserCurrentLimit = user?.storage_limit_bytes || 0;
    
    // Slack calculation: total - (everything else)
    const otherCustomTotal = customQuotaTotal - currentUserCurrentLimit;
    const defaultPoolTotal = defaultUserCount * defaultQuotaMb * 1048576;
    
    const theoreticalTotalBytes = otherCustomTotal + (isDefault ? (defaultQuotaMb * 1048576) : targetLimitBytes) + defaultPoolTotal;
    const isCapacityViolated = theoreticalTotalBytes > ceilingBytes;

    return (
        <CustomModal
            isOpen={isOpen}
            onClose={onClose}
            title={`Quota Management: ${user?.name}`}
            showFooter={false}
        >
            <div className="p-1 px-2">
                {/* User Status Summary */}
                <div className={`rounded-3xl p-6 mb-8 border transition-all duration-500 ${
                    isCapacityViolated ? 'bg-red-50 border-red-200' : 'bg-indigo-50/50 border-indigo-100/50'
                }`}>
                    <div className="flex justify-between items-center mb-4">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isCapacityViolated ? 'text-red-500' : 'text-indigo-500'}`}>
                            {isCapacityViolated ? 'Capacity Violation' : 'Current Occupancy'}
                        </span>
                        <span className="text-xs font-black text-gray-900">{formatBytes(usageBytes)} used</span>
                    </div>
                    <div className={`h-4 w-full rounded-full overflow-hidden p-1 shadow-inner ${isCapacityViolated ? 'bg-red-100' : 'bg-indigo-100/50'}`}>
                        <div 
                            className={`h-full rounded-full transition-all duration-700 ${
                                isCapacityViolated ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]' 
                                : isExceeding ? 'bg-orange-500' 
                                : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]'
                            }`}
                            style={{ width: `${usagePercent}%` }}
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    {/* policy switcher */}
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setIsDefault(true)}
                            className={`flex-1 p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${isDefault ? 'bg-white border-indigo-500 shadow-xl shadow-indigo-100 ring-4 ring-indigo-50' : 'bg-gray-50 border-gray-100 text-gray-400 grayscale'}`}
                        >
                            <RefreshCw className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase">Global Policy</span>
                            <span className="text-sm font-bold text-gray-900">{defaultQuotaMb}MB</span>
                        </button>
                        <button 
                            onClick={() => setIsDefault(false)}
                            className={`flex-1 p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${!isDefault ? 'bg-white border-purple-500 shadow-xl shadow-purple-100 ring-4 ring-purple-50' : 'bg-gray-50 border-gray-100 text-gray-400 grayscale'}`}
                        >
                            <Star className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase">Custom Override</span>
                            <span className="text-sm font-bold text-gray-900">{mbValue ? (mbValue < 1024 ? `${mbValue}MB` : mbValue < 1048576 ? `${(mbValue/1024).toFixed(1)}GB` : `${(mbValue/1048576).toFixed(2)}TB`) : 'Manual'}</span>
                        </button>
                    </div>

                    {!isDefault && (
                        <div className="animate-in slide-in-from-top-4 duration-300">
                             <div className="flex items-center justify-between mb-3 ml-1">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Custom Limit</label>
                                <div className="flex bg-gray-50 p-0.5 rounded-lg border border-gray-100">
                                    {['MB', 'GB', 'TB'].map(u => (
                                        <button
                                            key={u}
                                            type="button"
                                            onClick={() => setUnit(u)}
                                            className={`px-3 py-1 rounded-md text-[9px] font-black transition-all ${
                                                unit === u ? 'bg-white text-indigo-600 shadow-sm border border-gray-200' : 'text-gray-400 opacity-60'
                                            }`}
                                        >
                                            {u}
                                        </button>
                                    ))}
                                </div>
                             </div>
                             
                             <div className="relative group mb-4">
                                <input 
                                    type="number"
                                    className="input-field py-5 text-xl font-black pr-16"
                                    value={unit === 'TB' ? (mbValue / 1048576).toFixed(2) : unit === 'GB' ? (mbValue / 1024).toFixed(1) : mbValue}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setMbValue(unit === 'TB' ? Math.round(val * 1048576) : unit === 'GB' ? Math.round(val * 1024) : Math.round(val));
                                    }}
                                    placeholder={`Enter ${unit} limit...`}
                                    autoFocus
                                />
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 font-black text-sm uppercase">{unit}</div>
                             </div>

                             <div className="flex flex-wrap gap-2">
                                {(unit === 'MB' ? [100, 250, 500, 750] 
                                  : unit === 'GB' ? [1, 2, 5, 10, 25, 50, 100] 
                                  : [0.1, 0.25, 0.5, 1, 2]).map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setMbValue(unit === 'TB' ? Math.round(p * 1048576) : unit === 'GB' ? Math.round(p * 1024) : Math.round(p))}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                                            mbValue === (unit === 'TB' ? Math.round(p * 1048576) : unit === 'GB' ? Math.round(p * 1024) : Math.round(p))
                                                ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border-gray-100'
                                        }`}
                                    >
                                        {p} {unit}
                                    </button>
                                ))}
                             </div>
                        </div>
                    )}

                    {isCapacityViolated && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-[1.5rem] flex flex-col gap-3">
                            <div className="flex items-start gap-4">
                                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                <p className="text-red-700 text-[10px] font-bold leading-relaxed uppercase">
                                    Allocation Denied: Theoretical total exceeds platform capacity.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 p-3 bg-white/50 rounded-xl border border-red-100 text-[9px] font-black uppercase tracking-tight">
                                <div className="flex flex-col">
                                    <span className="text-red-400 mb-0.5">Proposed Total</span>
                                    <span className="text-red-600">{(theoreticalTotalBytes / 1073741824).toFixed(2)} GB</span>
                                </div>
                                <div className="flex flex-col border-l border-red-100 pl-4">
                                    <span className="text-gray-400 mb-0.5">Platform Limit</span>
                                    <span className="text-gray-900">{ceilingGb} GB</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isCapacityViolated && isExceeding && (
                        <div className="p-4 bg-orange-50 border border-orange-100 rounded-[1.5rem] flex items-start gap-4 animate-pulse">
                            <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                            <p className="text-orange-700 text-[10px] font-bold leading-relaxed uppercase">
                                Warning: Target limit is less than current physical occupancy. User will be unable to upload new assets.
                            </p>
                        </div>
                    )}

                    <div className="pt-6 flex gap-4">
                        <button 
                            disabled={isLoading}
                            onClick={onClose}
                            className="flex-1 py-4 font-black text-[10px] uppercase tracking-[0.2em] text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            disabled={isLoading || (!isDefault && !mbValue) || isCapacityViolated}
                            onClick={handleSave}
                            className={`flex-[2] py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
                                isCapacityViolated ? 'bg-gray-300 shadow-none cursor-not-allowed grayscale'
                                : isExceeding ? 'bg-orange-500 shadow-orange-100' 
                                : 'bg-indigo-600 shadow-indigo-100'
                            }`}
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <HardDrive className="w-4 h-4" />
                                    Apply Quota Update
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </CustomModal>
    );
};

export default QuotaOverrideModal;

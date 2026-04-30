import React, { useState, useEffect } from 'react';
import { adminService } from '@/features/admin/services/AdminService';
import { 
    ShieldAlert, 
    CheckCircle2, 
    X, 
    AlertTriangle, 
    Clock, 
    User, 
    FileText,
    ExternalLink,
    Trash2,
    Activity
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';

const AdminAlertCentre = ({ limit = 5, onUpdate }) => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAlerts = async () => {
        try {
            const res = await adminService.getAlerts({ isResolved: false, limit });
            setAlerts(res.data?.data || []);
        } catch (err) {
            console.error('Failed to fetch alerts', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
        // Poll for new alerts every 30 seconds
        const interval = setInterval(fetchAlerts, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleResolve = async (id) => {
        try {
            await adminService.resolveAlert(id);
            toast.success('Incident resolved');
            fetchAlerts();
            if (onUpdate) onUpdate();
        } catch (err) {
            toast.error('Failed to resolve alert');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this alert record?')) return;
        try {
            await adminService.deleteAlert(id);
            toast.success('Alert deleted');
            fetchAlerts();
            if (onUpdate) onUpdate();
        } catch (err) {
            toast.error('Failed to delete alert');
        }
    };

    if (loading && alerts.length === 0) {
        return (
            <div className="space-y-4 animate-pulse">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-28 bg-gray-100 rounded-[2rem]"></div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <ShieldAlert className="w-6 h-6 text-coral" /> 
                    <span>Live Incidents</span>
                </div>
                {alerts.length > 0 && (
                    <span className="text-[10px] font-black bg-coral/10 text-coral px-3 py-1 rounded-full uppercase tracking-widest anim-pulse">
                        {alerts.length} Active
                    </span>
                )}
            </h2>

            <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {alerts.length > 0 ? (
                    alerts.map((alert, idx) => (
                        <div 
                            key={alert.id} 
                            className={`group relative p-6 rounded-[2rem] border transition-all duration-300 hover:shadow-lg animate-in slide-in-from-right-4 bg-white ${
                                alert.severity === 'CRITICAL' ? 'border-red-200 ring-2 ring-red-50' : 
                                alert.severity === 'ERROR' ? 'border-orange-200' : 'border-gray-100'
                            }`}
                            style={{ animationDelay: `${idx * 100}ms` }}
                        >
                            {/* Severity Badge */}
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                        alert.severity === 'CRITICAL' ? 'bg-red-600 anim-pulse' : 
                                        alert.severity === 'ERROR' ? 'bg-orange-500' : 'bg-amber-400'
                                    }`}></div>
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${
                                        alert.severity === 'CRITICAL' ? 'text-red-600' : 
                                        alert.severity === 'ERROR' ? 'text-orange-600' : 'text-amber-600'
                                    }`}>
                                        {alert.severity}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleResolve(alert.id)}
                                        className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors tooltip"
                                        title="Mark as Resolved"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(alert.id)}
                                        className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-base font-black text-gray-900 mb-1 leading-tight">{alert.title}</h3>
                            <p className="text-xs font-medium text-gray-500 leading-relaxed mb-4 line-clamp-2">
                                {alert.message}
                            </p>

                            <div className="flex flex-wrap gap-3 mt-auto pt-3 border-t border-gray-50">
                                <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                                    <Clock className="w-3 h-3" />
                                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                                </div>
                                {alert.user_name && (
                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-500 uppercase tracking-tighter bg-indigo-50 px-2 py-0.5 rounded-md">
                                        <User className="w-3 h-3" />
                                        {alert.user_name}
                                    </div>
                                )}
                                {alert.type === 'GENERATION_FAILURE' && (
                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-purple-500 uppercase tracking-tighter bg-purple-50 px-2 py-0.5 rounded-md">
                                        <FileText className="w-3 h-3" />
                                        Material Error
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-gray-100 rounded-[3rem] bg-gray-50/30">
                        <div className="w-20 h-20 bg-white rounded-[2rem] shadow-xl shadow-emerald-100/50 flex items-center justify-center mb-6">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 mb-2">System Nominal</h3>
                        <p className="text-sm font-medium text-gray-400 max-w-[200px]">
                            No critical incidents or failed generations detected in the last 24 hours.
                        </p>
                    </div>
                )}
            </div>

            {/* Quick Status Bar */}
            <div className="mt-8 p-5 bg-gray-900 rounded-[2rem] border border-gray-800 shadow-2xl shadow-indigo-900/20">
                 <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
                             <Activity className="w-4 h-4 text-emerald-400" />
                         </div>
                         <div>
                             <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest leading-none mb-1">Infrastructure</p>
                             <p className="text-xs font-bold text-white">All Nodes Operational</p>
                         </div>
                     </div>
                     <span className="w-2 h-2 rounded-full bg-emerald-500 anim-pulse"></span>
                 </div>
            </div>
        </div>
    );
};

export default AdminAlertCentre;

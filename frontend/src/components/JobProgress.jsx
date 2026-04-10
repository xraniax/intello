import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle2, AlertCircle, X, Cpu, Layers, HardDrive } from 'lucide-react';
import { FAILED, SUCCESS, normalizeStatus } from '@/constants/statusConstants';
import { useMaterialStore } from '@/store/useMaterialStore';

const JobProgress = ({ job }) => {
    const cancelJob = useMaterialStore((state) => state.actions.cancelJob);
    if (!job) return null;

    const { stage, progress, message, materialId } = job;
    const isError = normalizeStatus(stage) === FAILED;
    const isSuccess = normalizeStatus(stage) === SUCCESS;

    const getStageIcon = () => {
        if (isError) return <AlertCircle className="w-5 h-5 text-red-500" />;
        if (isSuccess) return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;

        switch (stage) {
            case 'ocr': return <Cpu className="w-5 h-5 text-indigo-600 animate-pulse" />;
            case 'chunking': return <Layers className="w-5 h-5 text-purple-600 animate-pulse" />;
            case 'embedding': return <HardDrive className="w-5 h-5 text-blue-600 animate-pulse" />;
            default: return <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />;
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="fixed bottom-8 right-8 z-50 w-80 bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-white/20 p-5 overflow-hidden group"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            {getStageIcon()}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                                {stage || 'Processing'}
                            </span>
                            <span className="text-sm font-black text-indigo-600 leading-none">{progress}%</span>
                        </div>
                    </div>

                    {!isError && !isSuccess && (
                        <button
                            onClick={() => cancelJob(materialId)}
                            className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                            title="Cancel Processing"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <h4 className="text-sm font-bold text-gray-900 mb-3 leading-tight line-clamp-2">{message}</h4>

                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden relative">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ type: 'spring', stiffness: 50, damping: 20 }}
                        className={`h-full rounded-full ${isError ? 'bg-red-500' : isSuccess ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500'
                            }`}
                    ></motion.div>
                </div>

                {/* Subtle Background Glow */}
                <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 -z-10 transition-colors duration-500 ${isError ? 'bg-red-500' : isSuccess ? 'bg-emerald-500' : 'bg-indigo-500'
                    }`}></div>
            </motion.div>
        </AnimatePresence>
    );
};

export default JobProgress;

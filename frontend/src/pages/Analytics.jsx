import React from 'react';
import { motion } from 'framer-motion';
import {
    Brain, Target, Activity, Zap,
    Sparkles, ArrowRight, Layers,
    TrendingUp, ShieldCheck
} from 'lucide-react';

const FeaturePill = ({ icon: Icon, label }) => (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 border border-indigo-100/50 backdrop-blur-sm">
        <Icon className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900/70">{label}</span>
    </div>
);

const Analytics = () => {
    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar relative flex flex-col items-center justify-center p-6" style={{ background: 'var(--c-canvas)' }}>

            {/* Ambient Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-200/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-200/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                
                {/* Decorative Grid/Noise */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#4f46e5 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-2xl w-full text-center relative z-10"
            >
                {/* Icon Hub */}
                <div className="relative inline-block mb-10">
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.05, 1],
                            rotate: [0, 5, -5, 0]
                        }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                        className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-200"
                    >
                        <Brain className="w-12 h-12 text-white" />
                    </motion.div>
                    
                    {/* Floating Orbits */}
                    <div className="absolute -top-4 -right-4 w-10 h-10 rounded-2xl bg-white shadow-lg flex items-center justify-center animate-bounce" style={{ animationDuration: '3s' }}>
                        <Target className="w-5 h-5 text-rose-500" />
                    </div>
                    <div className="absolute -bottom-2 -left-6 w-12 h-12 rounded-2xl bg-white shadow-lg flex items-center justify-center animate-bounce" style={{ animationDuration: '4s', animationDelay: '0.5s' }}>
                        <Activity className="w-6 h-6 text-emerald-500" />
                    </div>
                </div>

                {/* Content */}
                <div className="space-y-4 mb-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 mb-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-[0.15em]">Phase 2: Intelligence Hub</span>
                    </div>
                    
                    <h1 className="text-[42px] font-black leading-tight tracking-tight text-gray-900">
                        Cognify Intelligence is <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                            Gathering your study data
                        </span>
                    </h1>
                    
                    <p className="text-[17px] text-gray-500 leading-relaxed max-w-lg mx-auto font-medium">
                        We are building an ultra-intelligent dashboard to track your <b>Understanding</b>, 
                        <b> Retention</b>, and <b>Mastery</b> in real-time. Your personal study 
                        intelligence is arriving soon.
                    </p>
                </div>

                {/* Feature Preview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
                    <FeaturePill icon={TrendingUp} label="Progress Trends" />
                    <FeaturePill icon={Layers} label="Concept Maps" />
                    <FeaturePill icon={Zap} label="Momentum Scale" />
                    <FeaturePill icon={ShieldCheck} label="Exam Prep Score" />
                </div>

                {/* Progress Visual */}
                <div className="max-w-md mx-auto mb-12">
                    <div className="flex justify-between items-end mb-2 px-1">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Neural Link Sync</span>
                        <span className="text-xs font-black text-indigo-600 uppercase tabular-nums">Processing Chunks...</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-50">
                        <motion.div 
                            initial={{ width: "0%" }}
                            animate={{ width: "65%" }}
                            transition={{ duration: 2, ease: "easeInOut" }}
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full shadow-[0_0_10px_rgba(99,91,255,0.4)]"
                        />
                    </div>
                </div>

                {/* Action */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="group flex items-center gap-3 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold text-sm transition-all hover:bg-gray-800 hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-gray-200"
                    >
                        Go back to Workspace
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </button>
                    
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                        Available in Beta v1.2
                    </p>
                </div>
            </motion.div>

            {/* Bottom Credits */}
            <div className="absolute bottom-8 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
                    &copy; 2026 Cognify Intelligence System
                </p>
            </div>
        </div>
    );
};

export default Analytics;

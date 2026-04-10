import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { Brain, Sparkles, BookOpen, Layers, ArrowRight, BookMarked } from 'lucide-react';
import { motion } from 'framer-motion';

const Welcome = () => {
    const user = useAuthStore((state) => state.data.user);

    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="min-h-[calc(100vh-80px)] flex flex-col bg-[#FFF8F0]/30 animate-in fade-in duration-700">
            {/* Hero Section */}
            <main className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-16 pb-24 relative overflow-hidden">
                {/* Decorative background elements */}
                <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl mix-blend-multiply opacity-50 animate-blob"></div>
                <div className="absolute top-1/4 -right-32 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl mix-blend-multiply opacity-50 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-mint-200/40 rounded-full blur-3xl mix-blend-multiply opacity-50 animate-blob animation-delay-4000"></div>

                <div className="relative z-10 max-w-4xl mx-auto space-y-8 flex flex-col items-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center justify-center p-2 bg-purple-50 rounded-2xl border border-purple-100/50 mb-4 shadow-sm"
                    >
                        <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-xl shadow-sm text-purple-600 font-bold text-xs uppercase tracking-widest">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>AI-Powered E-Learning</span>
                        </div>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-6xl md:text-8xl font-black text-gray-900 tracking-tighter leading-[1.1]"
                    >
                        Cultivate Your <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 drop-shadow-sm">
                            Cognitive Garden
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-xl md:text-2xl text-gray-500 font-medium max-w-2xl leading-relaxed"
                    >
                        Transform scattered documents and lecture notes into active, intelligent study spaces. Experience retrieval-augmented tutoring tailored exactly to your curriculum.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center gap-4 pt-8 w-full sm:w-auto"
                    >
                        <Link
                            to="/dashboard"
                            className="btn-vibrant w-full sm:w-auto px-10 py-5 text-lg flex items-center justify-center gap-3 group relative overflow-hidden"
                        >
                            <span className="relative z-10 font-bold flex items-center gap-2">
                                {user ? 'Go to Workspace' : 'Start Exploring'}
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </Link>

                        {!user && (
                            <div className="flex items-center gap-4 w-full sm:w-auto justify-center">
                                <Link
                                    to="/login"
                                    className="px-8 py-5 text-gray-500 hover:text-gray-900 font-bold text-lg hover:bg-gray-50 rounded-2xl transition-all"
                                >
                                    Log In
                                </Link>
                                <span className="text-xs font-black text-gray-300 uppercase tracking-widest">or</span>
                                <Link
                                    to="/dashboard"
                                    className="text-sm font-bold text-indigo-500 hover:text-indigo-600 underline underline-offset-4 decoration-2"
                                >
                                    Try without account
                                </Link>
                            </div>
                        )}
                    </motion.div>
                </div>
            </main>

            {/* Features Row */}
            <div className="border-t border-purple-100/30 bg-white/50 backdrop-blur-md py-16">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    <div className="space-y-4 p-6">
                        <div className="w-14 h-14 mx-auto bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shadow-inner">
                            <Layers className="w-7 h-7" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900">Curated Workspaces</h3>
                        <p className="text-gray-500 font-medium">Organize your materials by subject and instantly locate relevant concepts without cognitive overload.</p>
                    </div>
                    <div className="space-y-4 p-6">
                        <div className="w-14 h-14 mx-auto bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                            <Brain className="w-7 h-7" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900">Contextual AI Tutor</h3>
                        <p className="text-gray-500 font-medium">Ask questions and receive answers strictly grounded in your uploaded documents and notes.</p>
                    </div>
                    <div className="space-y-4 p-6">
                        <div className="w-14 h-14 mx-auto bg-mint-50 text-mint-700 rounded-2xl flex items-center justify-center shadow-inner">
                            <BookMarked className="w-7 h-7" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900">Active Generation</h3>
                        <p className="text-gray-500 font-medium">Automatically transform passive PDFs into interactive quizzes and intelligent summaries.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Welcome;

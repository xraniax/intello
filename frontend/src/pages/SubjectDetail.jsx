import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PanelLeft, PanelRight, Upload, BookOpen, Lock, Minimize2,
} from 'lucide-react';
import { requireAuth } from '@/utils/requireAuth';

import WorkspaceLayout from '@/features/subjects/components/WorkspaceLayout';
import WorkspaceTabs from '@/features/subjects/components/WorkspaceTabs';
import FilePanel from '@/features/subjects/components/FilePanel';
import ChatPanel from '@/features/subjects/components/ChatPanel';
import UploadModal from '@/features/subjects/components/UploadModal';
import TabContent from '@/features/subjects/components/TabContent';

import CustomModal from '@/components/ui/CustomModal';
import MobilePanelSwitcher from '@/components/MobilePanelSwitcher';
import FloatingActionButton from '@/components/ui/FloatingActionButton';
import Skeleton from '@/components/ui/Skeleton';

import { useSubjectWorkspace } from '@/features/subjects/hooks/useSubjectWorkspace';

const SubjectDetail = () => {
    const { id } = useParams();
    const ws = useSubjectWorkspace(id);
    const {
        subject, uploads, loading, isAnyBlocking, isPublic, user,
        tabs, setTabs, activeTabId, setActiveTabId,
        selectedUploads, toggleSelection,
        showUploadModal, setShowUploadModal, handleUploadSuccess,
        handleDeleteUpload, handleRenameMaterial,
        chatMessages, currentQuestion, setCurrentQuestion,
        handleChat, isThinking, chatError, setChatMessages, setChatError,
        chatEndRef, chatCollapsed, setChatCollapsed,
        filePanelCollapsed, setFilePanelCollapsed,
        genType, setGenType, handleGenerate, isGenerating,
        genResult, setGenResult, genError, jobProgress,
        retryGeneration, generationStartTime,
        isListening, isSpeaking, stopSpeaking, listen, speak,
        isModalOpen, setIsModalOpen, modalConfig,
    } = ws;

    const isExpanded = filePanelCollapsed && chatCollapsed;

    const [focusModeTabId, setFocusModeTabId] = useState(null);
    const openFocusMode  = useCallback((tabId) => setFocusModeTabId(tabId), []);
    const closeFocusMode = useCallback(() => setFocusModeTabId(null), []);

    useEffect(() => {
        if (!focusModeTabId) return;
        const onKey = (e) => { if (e.key === 'Escape') closeFocusMode(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [focusModeTabId, closeFocusMode]);

    const tabContentProps = {
        tabs, isExpanded, subjectId: id, subjectName: subject?.name,
        genType, setGenType, handleGenerate, isGenerating,
        jobProgress, selectedUploads, genResult, setGenResult, genError,
        retryGeneration, generationStartTime, requireAuth,
    };

    if (loading && (!subject || isAnyBlocking)) {
        return (
            <div className="h-full flex flex-col animate-in fade-in duration-700">
                <div className="h-20 border-b px-8 flex items-center justify-between" style={{ borderColor: 'var(--c-border-soft)', background: 'var(--c-surface)' }}>
                    <div className="flex items-center gap-6">
                        <Skeleton className="w-10 h-10 rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-48 rounded-md" />
                            <Skeleton className="h-3 w-32 rounded-sm" />
                        </div>
                    </div>
                    <Skeleton className="w-32 h-10 rounded-xl" />
                </div>
                <div className="flex-1 flex overflow-hidden">
                    <div className="w-80 border-r p-6 space-y-6" style={{ borderColor: 'var(--c-border-soft)', background: 'var(--c-canvas)' }}>
                        <Skeleton className="h-12 w-full rounded-2xl" />
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
                        </div>
                    </div>
                    <div className="flex-1 p-8 space-y-6">
                        <Skeleton className="h-4 w-32 rounded-full" />
                        <div className="grid grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                        </div>
                        <Skeleton className="h-12 w-full rounded-2xl" />
                        <div className="border rounded-[2rem] p-8 space-y-4 shadow-sm" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border-soft)' }}>
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                    </div>
                    <div className="w-96 border-l p-6 flex flex-col justify-end" style={{ borderColor: 'var(--c-border-soft)', background: 'var(--c-surface)' }}>
                        <Skeleton className="h-12 w-full rounded-2xl mb-4" />
                    </div>
                </div>
            </div>
        );
    }

    if (!subject && isPublic) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in h-[calc(100vh-80px)]" style={{ background: 'var(--c-canvas)' }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-inner" style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)' }}>
                    <BookOpen className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--c-text)' }}>Subject Unavailable</h2>
                <p className="max-w-sm mb-6" style={{ color: 'var(--c-text-muted)' }}>This space may be private or deleted. Please log in if it belongs to you.</p>
                <Link to="/login" className="btn-vibrant px-8 py-3 w-auto shadow-xl">
                    Log In to Cognify
                </Link>
            </div>
        );
    }

    return (
        <div className="subject-page flex-1 min-h-0 flex flex-col animate-in fade-in duration-700 pb-20 md:pb-0 bg-[var(--c-canvas)]">
            <div className="px-6 md:px-8 py-3 md:py-4 border-b-4 border-white shadow-sm flex items-center justify-between sticky top-0 z-20 bg-white/80 backdrop-blur-xl">
                <div className="flex items-center gap-4 md:gap-6">
                    <Link
                        to="/dashboard"
                        className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all group bg-indigo-50 text-indigo-500 hover:bg-indigo-600 hover:text-white shadow-sm shadow-indigo-100"
                        title="Back to Garden"
                    >
                        <svg className="w-6 h-6 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 md:gap-3">
                            <h1 className="text-xl md:text-3xl font-black tracking-tight truncate leading-tight bg-gradient-to-r from-indigo-950 to-indigo-700 bg-clip-text text-transparent">{subject?.name}</h1>
                            <span className="hidden sm:inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap bg-indigo-50 text-indigo-600 border-2 border-indigo-100">
                                {uploads.length} Sources
                            </span>
                        </div>
                        <p className="text-[10px] md:text-xs font-bold truncate max-w-[150px] sm:max-w-md mt-1 text-gray-400 uppercase tracking-widest">
                            {subject?.description || 'Refining knowledge with AI clarity.'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    <div className="hidden lg:flex items-center p-1.5 rounded-2xl bg-gray-100/50 border-2 border-white shadow-inner">
                        <button
                            onClick={() => setFilePanelCollapsed(!filePanelCollapsed)}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2 ${!filePanelCollapsed ? 'bg-white text-indigo-600 shadow-md transform scale-105' : 'text-gray-400 hover:text-indigo-400'}`}
                        >
                            <PanelLeft className="w-4 h-4" />
                            <span>Sources</span>
                        </button>
                        <button
                            onClick={() => setChatCollapsed(!chatCollapsed)}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2 ${!chatCollapsed ? 'bg-white text-indigo-600 shadow-md transform scale-105' : 'text-gray-400 hover:text-indigo-400'}`}
                        >
                            <span>Tutor</span>
                            <PanelRight className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        onClick={() => requireAuth(() => setShowUploadModal(true))}
                        className="btn-primary py-3 px-6 text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-200 hover:scale-105 active:scale-95 hidden md:flex items-center gap-2"
                    >
                        {(isPublic && !user) ? <Lock className="w-3.5 h-3.5" /> : <Upload className="w-4 h-4" />}
                        <span>Add Content</span>
                    </button>
                </div>
            </div>

            <WorkspaceLayout
                leftPanelCollapsed={filePanelCollapsed}
                rightPanelCollapsed={chatCollapsed}
                leftPanel={
                    <FilePanel
                        materials={uploads}
                        selectedMaterials={selectedUploads}
                        toggleSelection={toggleSelection}
                        onDelete={handleDeleteUpload}
                        onRename={handleRenameMaterial}
                        onGenerate={handleGenerate}
                        onOpenUpload={() => requireAuth(() => setShowUploadModal(true))}
                        onCollapse={() => setFilePanelCollapsed(true)}
                        isPublic={isPublic}
                    />
                }
                middlePanel={
                    <WorkspaceTabs
                        tabs={tabs}
                        setTabs={setTabs}
                        activeTabId={activeTabId}
                        setActiveTabId={setActiveTabId}
                        renderTabContent={(tabId) => <TabContent tabId={tabId} {...tabContentProps} />}
                        onFocusMode={openFocusMode}
                    />
                }
                rightPanel={
                    <ChatPanel
                        messages={chatMessages}
                        currentQuestion={currentQuestion}
                        setCurrentQuestion={setCurrentQuestion}
                        handleChat={handleChat}
                        handleVoiceInput={() => listen((transcript) => setCurrentQuestion(transcript))}
                        handleTTS={speak}
                        isSpeaking={isSpeaking}
                        stopSpeaking={stopSpeaking}
                        isThinking={isThinking}
                        isListening={isListening}
                        chatEndRef={chatEndRef}
                        contextInfo={selectedUploads.length > 0 ? 'Grounded in selected context' : 'Using all subject data'}
                        chatError={chatError}
                        onClearChat={() => setChatMessages([])}
                        onCollapse={() => setChatCollapsed(true)}
                    />
                }
            />

            <MobilePanelSwitcher />
            <FloatingActionButton
                onClick={() => requireAuth(() => setShowUploadModal(true))}
                icon={(isPublic && !user) ? Lock : Upload}
                label="Add Content"
            />

            <UploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                subjectId={id}
                onSuccess={handleUploadSuccess}
            />

            <CustomModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                {...modalConfig}
            />

            {/* ── Focus Mode Overlay ── */}
            {createPortal(
                <AnimatePresence>
                    {focusModeTabId && (
                        <>
                            <motion.div
                                key="focus-backdrop"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="fixed inset-0 z-[900]"
                                style={{ background: 'rgba(8,8,20,0.72)', backdropFilter: 'blur(6px)' }}
                                onClick={closeFocusMode}
                            />
                            <motion.div
                                key="focus-panel"
                                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96, y: 16 }}
                                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                                className="fixed z-[901] flex flex-col overflow-hidden"
                                style={{
                                    inset: '24px', borderRadius: '20px',
                                    background: 'var(--c-surface)',
                                    boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
                                }}
                            >
                                <div
                                    className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b"
                                    style={{ background: 'var(--c-surface-alt)', borderColor: 'var(--c-border)' }}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex gap-1.5">
                                            <span className="w-3 h-3 rounded-full bg-rose-400" />
                                            <span className="w-3 h-3 rounded-full bg-amber-400" />
                                            <span className="w-3 h-3 rounded-full bg-emerald-400" />
                                        </div>
                                        <span className="text-xs font-bold" style={{ color: 'var(--c-text-muted)' }}>
                                            {tabs.find(t => t.id === focusModeTabId)?.title ?? 'Focus Mode'}
                                        </span>
                                    </div>
                                    <button
                                        onClick={closeFocusMode}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all hover:bg-gray-100"
                                        style={{ color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}
                                        title="Exit focus mode (Esc)"
                                    >
                                        <Minimize2 className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Exit focus</span>
                                        <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-gray-100 text-gray-400">Esc</kbd>
                                    </button>
                                </div>
                                <div className="flex-1 overflow-hidden min-h-0">
                                    <TabContent tabId={focusModeTabId} {...tabContentProps} />
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};

export default SubjectDetail;

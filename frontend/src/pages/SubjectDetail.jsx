import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BASE_URL } from '@/services/api';
import {
    PanelLeft,
    PanelRight,
    Upload,
    BookOpen,
    Lock,
    Sparkles,
    XCircle,
    BarChart2,
    Minimize2,
    X as XIcon,
} from 'lucide-react';
import { requireAuth } from '@/utils/requireAuth';

// Feature Components
import WorkspaceLayout from '@/features/subjects/components/WorkspaceLayout';
import WorkspaceTabs from '@/features/subjects/components/WorkspaceTabs';
import FilePanel from '@/features/subjects/components/FilePanel';
import MaterialsPanel from '@/features/subjects/components/MaterialsPanel';
import ChatPanel from '@/features/subjects/components/ChatPanel';
import UploadModal from '@/features/subjects/components/UploadModal';
import QuizView from '@/features/subjects/components/QuizView';
import FlashcardsView from '@/features/subjects/components/FlashcardsView';
import ExamView from '@/features/subjects/components/ExamView';
import SummaryView from '@/features/subjects/components/SummaryView';
import AnalyticsView from '@/features/subjects/components/AnalyticsView';

// UI Components
import CustomModal from '@/components/ui/CustomModal';
import MobilePanelSwitcher from '@/components/MobilePanelSwitcher';
import FloatingActionButton from '@/components/ui/FloatingActionButton';
import Skeleton from '@/components/ui/Skeleton';

// Hooks
import { useSubjectWorkspace } from '@/features/subjects/hooks/useSubjectWorkspace';

// --- Error Boundary for Material Views ---
class MaterialErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error("Material Rendering Error:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-10 border-4 rounded-[2.5rem] text-center my-6 animate-in zoom-in-95 duration-300 relative overflow-hidden bg-white shadow-xl shadow-red-900/5 group" style={{ borderColor: '#FEE2E2' }}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full opacity-50 transition-transform group-hover:scale-110"></div>
                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 bg-red-100 text-red-600 shadow-sm relative z-10">
                        <XCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-black mb-2 text-red-600 uppercase tracking-tight relative z-10">Oops! Something went wrong</h3>
                    <p className="text-gray-500 font-bold mb-8 max-w-sm mx-auto relative z-10">Our neural engines hit a bump while processing this {this.props.type || 'content'}.</p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-200 relative z-10"
                    >
                        Try again
                    </button>
                    <details className="mt-8 text-left relative z-10">
                        <summary className="text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer opacity-40 hover:opacity-100 transition-opacity text-gray-400">Technical Details</summary>
                        <pre className="mt-4 p-5 text-[11px] rounded-2xl overflow-auto max-h-40 bg-gray-50 font-mono text-gray-500 border border-red-50">
                            {this.state.error?.toString()}
                        </pre>
                    </details>
                </div>
            );
        }
        return this.props.children;
    }
}

const SubjectDetail = () => {
    const { id } = useParams();
    const ws = useSubjectWorkspace(id);
    const {
        subject,
        uploads,
        loading,
        isAnyBlocking,
        isPublic,
        user,
        tabs,
        setTabs,
        activeTabId,
        setActiveTabId,
        selectedUploads,
        toggleSelection,
        showUploadModal,
        setShowUploadModal,
        handleUploadSuccess,
        handleDeleteUpload,
        handleRenameMaterial,
        chatMessages,
        currentQuestion,
        setCurrentQuestion,
        handleChat,
        isThinking,
        chatError,
        setChatMessages,
        setChatError,
        chatEndRef,
        chatCollapsed,
        setChatCollapsed,
        filePanelCollapsed,
        setFilePanelCollapsed,
        genType,
        setGenType,
        handleGenerate,
        isGenerating,
        genResult,
        setGenResult,
        genError,
        jobProgress,
        retryGeneration,
        generationStartTime,
        isListening,
        listen,
        speak,
        isModalOpen,
        setIsModalOpen,
        modalConfig
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

    const renderTabContent = (tabId) => {
        if (tabId === 'generator') {
            return (
                <MaterialsPanel
                    genType={genType}
                    setGenType={setGenType}
                    handleGenerate={(options) => requireAuth(() => handleGenerate(options))}
                    isGenerating={isGenerating}
                    jobProgress={jobProgress}
                    selectedCount={selectedUploads.length}
                    genResult={genResult}
                    setGenResult={setGenResult}
                    genError={genError}
                    isExpanded={isExpanded}
                    onRetry={retryGeneration}
                    generationStartTime={generationStartTime}
                />
            );
        }

        if (tabId === 'analytics') {
            return <AnalyticsView subjectId={id} isExpanded={isExpanded} />;
        }

        const tab = tabs.find(t => t.id === tabId);
        if (!tab) return null;

        const material = tab.material;

        if (!material) {
            return (
                <div className="flex-1 flex items-center justify-center p-12">
                    <Skeleton className="w-full max-w-2xl h-64 rounded-[2rem]" />
                </div>
            );
        }

        if (tab.type === 'upload') {
            const hasFile = !!material.file_path;
            const hasContent = !!material.content;

            if (hasFile) {
                const fileUrl = `${BASE_URL}/${material.file_path}`;
                if (material.file_path.toLowerCase().endsWith('.pdf')) {
                    return (
                        <div className="flex-1 h-full w-full flex flex-col" style={{ background: 'var(--c-canvas)' }}>
                            <iframe
                                src={`${fileUrl}#view=FitH&toolbar=0&navpanes=0&scrollbar=1`}
                                className="w-full flex-1 border-none"
                                title={tab.title}
                                sandbox="allow-scripts allow-same-origin"
                            />
                        </div>
                    );
                } else {
                    return (
                        <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center" style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}>
                            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: 'var(--c-primary)' }} />
                            <h3 className="text-lg font-bold mb-2">{tab.title}</h3>
                            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="mt-4 px-4 py-2 font-bold text-sm transition-colors rounded-lg" style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)' }}>
                                Download File
                            </a>
                        </div>
                    );
                }
            } else if (hasContent) {
                return (
                    <div className={`mx-auto ${isExpanded ? 'max-w-6xl py-16' : 'max-w-4xl py-8 md:py-12'} px-6 transition-all duration-500`}>
                        <div className="border rounded-[1.5rem] p-8 shadow-sm leading-relaxed text-sm whitespace-pre-wrap font-mono" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border-soft)', color: 'var(--c-text)' }}>
                            {typeof material.content === 'object' ? JSON.stringify(material.content, null, 2) : (material.content || 'No content')}
                        </div>
                    </div>
                );
            }

            return (
                <div className="flex-1 h-full flex items-center justify-center p-8 text-center" style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}>
                    <div>
                        <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-bold mb-2">{tab.title}</h3>
                        <p className="text-sm">Document preview is not available.</p>
                    </div>
                </div>
            );
        }

        let parsedContent = material.ai_generated_content || material.content || '';
        if (typeof parsedContent === 'string') {
            try { parsedContent = JSON.parse(parsedContent); } catch { }
        }
        if (parsedContent?.result) parsedContent = parsedContent.result;
        
        if (typeof parsedContent === 'object' && parsedContent) {
            parsedContent.id = material.id;
            parsedContent.title = parsedContent.title || material.title || '';
        }

        if (tab.type === 'quiz' || material.type === 'quiz') {
            return (
                <div className="flex-1 h-full overflow-y-auto bg-transparent">
                    <MaterialErrorBoundary type="quiz">
                        <QuizView key={parsedContent?.id || 'quiz'} quizData={parsedContent} subjectId={id} materialId={material.id} isExpanded={isExpanded} />
                    </MaterialErrorBoundary>
                </div>
            );
        }

        if (tab.type === 'flashcards' || material.type === 'flashcards') {
            return (
                <div className="flex-1 h-full overflow-y-auto bg-transparent">
                    <MaterialErrorBoundary type="flashcards">
                        <FlashcardsView flashcardsData={parsedContent} subjectId={id} isExpanded={isExpanded} />
                    </MaterialErrorBoundary>
                </div>
            );
        }

        if (tab.type === 'exam_session') {
            return (
                <div className="flex-1 h-full overflow-y-auto bg-transparent">
                    <MaterialErrorBoundary type="exam">
                        <ExamView examData={material.ai_generated_content} examId={material.id} subjectId={id} isExpanded={isExpanded} />
                    </MaterialErrorBoundary>
                </div>
            );
        }

        if (tab.type === 'exam' || material.type === 'exam') {
            return (
                <div className="flex-1 h-full overflow-y-auto bg-transparent">
                    <MaterialErrorBoundary type="exam">
                        <ExamView key={material.id} examData={parsedContent} examId={material.id} subjectId={id} isExpanded={isExpanded} />
                    </MaterialErrorBoundary>
                </div>
            );
        }

        if (tab.type === 'summary' || material.type === 'summary') {
            return (
                <MaterialErrorBoundary type="summary">
                    <SummaryView summaryData={parsedContent} title={tab.title} isExpanded={isExpanded} />
                </MaterialErrorBoundary>
            );
        }

        const displayContent = typeof parsedContent === 'object' ? JSON.stringify(parsedContent, null, 2) : String(parsedContent);

        return (
            <div className={`flex-1 h-full overflow-y-auto ${isExpanded ? 'p-12' : 'p-6 md:p-12'} bg-transparent transition-all duration-500`}>
                <div className={`${isExpanded ? 'max-w-5xl space-y-10' : 'max-w-5xl space-y-8'} mx-auto animate-in fade-in duration-500 transition-all`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`rounded-lg flex items-center justify-center transition-all ${isExpanded ? 'w-10 h-10' : 'w-8 h-8'}`} style={{ background: 'var(--c-primary-light)' }}>
                            <Sparkles className={`${isExpanded ? 'w-5 h-5' : 'w-4 h-4'}`} style={{ color: 'var(--c-primary)' }} />
                        </div>
                        <h3 className={`${isExpanded ? 'text-2xl' : 'text-lg'} font-black tracking-tight capitalize transition-all`} style={{ color: 'var(--c-text)' }}>{tab.type.replace('_', ' ')} Insight</h3>
                    </div>
                    <div className={`border rounded-[2.5rem] shadow-xl text-gray-800 leading-relaxed transition-all duration-500 relative overflow-hidden group ${isExpanded ? 'p-12 text-base' : 'p-8 text-sm'}`} style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border-soft)' }}>
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-[4rem] group-hover:scale-110 transition-transform opacity-30" style={{ background: 'var(--c-primary-light)' }}></div>
                        {displayContent}
                    </div>
                </div>
            </div>
        );
    };

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
                            onClick={() => {
                                const hasTab = tabs.some(t => t.id === 'analytics');
                                if (!hasTab) {
                                    setTabs(prev => [...prev, { id: 'analytics', title: 'Analytics', type: 'analytics', pinned: false }]);
                                }
                                setActiveTabId('analytics');
                            }}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2 ${activeTabId === 'analytics' ? 'bg-white text-indigo-600 shadow-md transform scale-105' : 'text-gray-400 hover:text-indigo-400'}`}
                        >
                            <BarChart2 className="w-4 h-4" />
                            <span>Analytics</span>
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
                        className="btn-primary py-3 px-6 text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-200 hover:scale-105 active:scale-95 hidden md:block"
                    >
                        {(isPublic && !user) && <Lock className="w-3.5 h-3.5 inline-block mr-1.5" />}
                        Grow Space
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
                        renderTabContent={renderTabContent}
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
                label="Grow Space"
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

            {/* ── Focus Mode Overlay ──────────────────────────────────────── */}
            {createPortal(
                <AnimatePresence>
                    {focusModeTabId && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                key="focus-backdrop"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="fixed inset-0 z-[900]"
                                style={{ background: 'rgba(8,8,20,0.72)', backdropFilter: 'blur(6px)' }}
                                onClick={closeFocusMode}
                            />

                            {/* Panel */}
                            <motion.div
                                key="focus-panel"
                                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                                animate={{ opacity: 1, scale: 1,    y: 0  }}
                                exit={{   opacity: 0, scale: 0.96, y: 16  }}
                                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                                className="fixed z-[901] flex flex-col overflow-hidden"
                                style={{
                                    inset: '24px',
                                    borderRadius: '20px',
                                    background: 'var(--c-surface)',
                                    boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
                                }}
                            >
                                {/* Focus bar */}
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

                                {/* Content — full height */}
                                <div className="flex-1 overflow-hidden min-h-0">
                                    {renderTabContent(focusModeTabId)}
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

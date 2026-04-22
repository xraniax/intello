import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { BASE_URL } from '@/services/api';
import {
    PanelLeft,
    PanelRight,
    Upload,
    BookOpen,
    Lock,
    Sparkles,
    XCircle
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
                <div className="p-8 bg-rose-50 border border-rose-100 rounded-2xl text-center my-4">
                    <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <XCircle className="w-6 h-6 text-rose-500" />
                    </div>
                    <h3 className="text-lg font-bold text-rose-700 mb-2">Failed to render material</h3>
                    <p className="text-sm text-rose-600 mb-4">There was an error processing this {this.props.type || 'content'}.</p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="px-4 py-2 bg-rose-500 text-white rounded-lg font-bold hover:bg-rose-600 transition-colors"
                    >
                        Try again
                    </button>
                    <details className="mt-4 text-left">
                        <summary className="text-xs text-rose-400 cursor-pointer">Error details</summary>
                        <pre className="mt-2 p-3 bg-rose-900 text-rose-50 text-[10px] rounded-lg overflow-auto max-h-40">
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
        isListening,
        listen,
        speak,
        isModalOpen,
        setIsModalOpen,
        modalConfig
    } = ws;

    const isExpanded = filePanelCollapsed && chatCollapsed;

    if (loading && (!subject || isAnyBlocking)) {
        return (
            <div className="h-full flex flex-col animate-in fade-in duration-700">
                <div className="h-20 border-b border-gray-100 bg-white/80 backdrop-blur-md px-8 flex items-center justify-between">
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
                    <div className="w-80 border-r border-gray-100 bg-[#FAFBFF] p-6 space-y-6">
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
                        <div className="bg-white border border-gray-100 rounded-[2rem] p-8 space-y-4 shadow-sm">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                    </div>
                    <div className="w-96 border-l border-gray-100 bg-white p-6 flex flex-col justify-end">
                        <Skeleton className="h-12 w-full rounded-2xl mb-4" />
                    </div>
                </div>
            </div>
        );
    }

    if (!subject && isPublic) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in bg-[#FFF8F0]/30 h-[calc(100vh-80px)]">
                <div className="w-16 h-16 bg-purple-50 text-purple-300 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <BookOpen className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Subject Unavailable</h2>
                <p className="text-gray-500 max-w-sm mb-6">This space may be private or deleted. Please log in if it belongs to you.</p>
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
                />
            );
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
                        <div className="flex-1 h-full w-full bg-gray-100 flex flex-col">
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
                        <div className="flex-1 h-full bg-gray-50 flex flex-col items-center justify-center p-8 text-center text-gray-500">
                            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50 text-indigo-400" />
                            <h3 className="text-lg font-bold mb-2">{tab.title}</h3>
                            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-bold text-sm transition-colors">
                                Download File
                            </a>
                        </div>
                    );
                }
            } else if (hasContent) {
                return (
                    <div className={`mx-auto ${isExpanded ? 'max-w-6xl py-16' : 'max-w-4xl py-8 md:py-12'} px-6 transition-all duration-500`}>
                        <div className="bg-white border border-gray-100 rounded-[1.5rem] p-8 shadow-sm text-gray-800 leading-relaxed text-sm whitespace-pre-wrap font-mono">
                            {material.content}
                        </div>
                    </div>
                );
            }

            return (
                <div className="flex-1 h-full bg-gray-50 flex items-center justify-center p-8 text-center text-gray-400">
                    <div>
                        <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-bold text-gray-500 mb-2">{tab.title}</h3>
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

        if (tab.type === 'quiz' || material.type === 'quiz') {
            return (
                <div className="flex-1 h-full overflow-y-auto bg-transparent">
                    <MaterialErrorBoundary type="quiz">
                        <QuizView key={parsedContent?.id || 'quiz'} quizData={parsedContent} isExpanded={isExpanded} />
                    </MaterialErrorBoundary>
                </div>
            );
        }

        if (tab.type === 'flashcards' || material.type === 'flashcards') {
            return (
                <div className="flex-1 h-full overflow-y-auto bg-transparent">
                    <MaterialErrorBoundary type="flashcards">
                        <FlashcardsView flashcardsData={parsedContent} isExpanded={isExpanded} />
                    </MaterialErrorBoundary>
                </div>
            );
        }

        if (tab.type === 'exam_session') {
            return (
                <div className="flex-1 h-full overflow-y-auto bg-transparent">
                    <MaterialErrorBoundary type="exam">
                        <ExamView examData={material.ai_generated_content} isExpanded={isExpanded} />
                    </MaterialErrorBoundary>
                </div>
            );
        }

        if (tab.type === 'exam' || material.type === 'exam') {
            return (
                <div className="flex-1 h-full overflow-y-auto bg-transparent">
                    <MaterialErrorBoundary type="exam">
                        <ExamView key={parsedContent?.id || 'exam'} examData={parsedContent} isExpanded={isExpanded} />
                    </MaterialErrorBoundary>
                </div>
            );
        }

        if (tab.type === 'summary' || material.type === 'summary') {
            return (
                <SummaryView summaryData={parsedContent} title={tab.title} isExpanded={isExpanded} />
            );
        }

        const displayContent = typeof parsedContent === 'object' ? JSON.stringify(parsedContent, null, 2) : String(parsedContent);

        return (
            <div className={`flex-1 h-full overflow-y-auto ${isExpanded ? 'p-12' : 'p-6 md:p-12'} bg-transparent transition-all duration-500`}>
                <div className={`${isExpanded ? 'max-w-5xl space-y-10' : 'max-w-5xl space-y-8'} mx-auto animate-in fade-in duration-500 transition-all`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`rounded-lg bg-indigo-50 flex items-center justify-center transition-all ${isExpanded ? 'w-10 h-10' : 'w-8 h-8'}`}>
                            <Sparkles className={`${isExpanded ? 'w-5 h-5' : 'w-4 h-4'} text-indigo-500`} />
                        </div>
                        <h3 className={`${isExpanded ? 'text-2xl' : 'text-lg'} font-black text-gray-900 tracking-tight capitalize transition-all`}>{tab.type.replace('_', ' ')} Insight</h3>
                    </div>
                    <div className={`bg-white border border-gray-100 rounded-[2.5rem] shadow-2xl shadow-indigo-100/20 text-gray-800 leading-relaxed transition-all duration-500 relative overflow-hidden group ${isExpanded ? 'p-12 text-base' : 'p-8 text-sm'}`}>
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-bl-[4rem] group-hover:scale-110 transition-transform"></div>
                        {displayContent}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="subject-page flex-1 min-h-0 flex flex-col bg-[#FFF8F0]/30 animate-in fade-in duration-700 pb-20 md:pb-0">
            <div className="px-6 md:px-8 py-2 md:py-3 border-b border-purple-100/50 bg-white/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4 md:gap-6">
                    <Link
                        to="/dashboard"
                        className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all group"
                        title="Back to Garden"
                    >
                        <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 md:gap-3">
                            <h1 className="text-lg md:text-xl font-black text-gray-900 tracking-tight truncate leading-tight">{subject?.name}</h1>
                            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-500 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap border border-purple-100/50">
                                {uploads.length} Sources
                            </span>
                        </div>
                        <p className="text-[10px] md:text-xs text-gray-400 font-medium truncate max-w-[150px] sm:max-w-md mt-0.5">
                            {subject?.description || 'Refining knowledge with AI clarity.'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    <div className="hidden lg:flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
                        <button
                            onClick={() => setFilePanelCollapsed(!filePanelCollapsed)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${!filePanelCollapsed ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <PanelLeft className="w-4 h-4" />
                            <span>Sources</span>
                        </button>
                        <button
                            onClick={() => setChatCollapsed(!chatCollapsed)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${!chatCollapsed ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <span>Tutor</span>
                            <PanelRight className="w-4 h-4" />
                        </button>
                    </div>

                    <button
                        onClick={() => requireAuth(() => setShowUploadModal(true))}
                        className="btn-primary py-2 px-4 md:px-6 text-xs md:text-sm whitespace-nowrap hidden md:block"
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
        </div>
    );
};

export default SubjectDetail;

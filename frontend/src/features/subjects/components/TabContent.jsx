import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Cloud, Sparkles, AlertTriangle, Trash2 } from 'lucide-react';
import { BASE_URL } from '@/services/api';
import Skeleton from '@/components/ui/Skeleton';
import MaterialErrorBoundary from './MaterialErrorBoundary';
import MaterialsPanel from './MaterialsPanel';
import QuizView from './QuizView';
import FlashcardsView from './FlashcardsView';
import ExamView from './ExamView';
import SummaryView from './SummaryView';
import { extractExamData } from '../utils/examUtils';

const TabContent = ({
    tabId,
    tabs,
    isExpanded,
    subjectId,
    subjectName,
    genType, setGenType,
    handleGenerate,
    isGenerating,
    jobProgress,
    selectedUploads,
    genResult, setGenResult,
    genError,
    retryGeneration,
    generationStartTime,
    requireAuth,
}) => {
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

    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return null;

    if (tab.type === 'quiz' && tab.quizMode === 'adaptive') {
        return (
            <div className="flex-1 h-full overflow-y-auto bg-transparent">
                <MaterialErrorBoundary type="quiz">
                    <QuizView
                        key={tab.id}
                        quizMode="adaptive"
                        quizData={null}
                        isExpanded={isExpanded}
                        subjectId={subjectId}
                        topic={subjectName || null}
                        language="en"
                    />
                </MaterialErrorBoundary>
            </div>
        );
    }

    const material = tab.material;

    // Banner for deleted materials
    const DeletedBanner = tab.isDeleted ? (
        <div className="flex-shrink-0 px-4 py-3 border-b" style={{ background: 'var(--c-danger-light)', borderColor: 'rgba(239,68,68,0.2)' }}>
            <div className="flex items-center gap-3 max-w-5xl mx-auto">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}>
                    <AlertTriangle className="w-4 h-4" style={{ color: 'var(--c-danger)' }} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--c-danger)' }}>
                        This material has been moved to trash
                    </p>
                    <p className="text-xs" style={{ color: 'var(--c-text-muted)' }}>
                        You can recover it from the Trash page
                    </p>
                </div>
                <Link
                    to="/trash"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02]"
                    style={{ background: 'var(--c-danger)', color: 'white' }}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    Visit Trash
                </Link>
            </div>
        </div>
    ) : null;

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
            const isDrive = material.file_path.includes('drive.google.com');
            const isMemory = material.file_path.startsWith('memory://');
            const lowerFilePath = (material.file_path || '').toLowerCase();
            const isPdf = lowerFilePath.endsWith('.pdf');
            const isImage = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].some((ext) => lowerFilePath.endsWith(ext));
            let fileUrl = (material.file_path.startsWith('http') || isMemory)
                ? material.file_path
                : `${BASE_URL.replace(/\/+$/, '')}/${material.file_path.replace(/^\/+/, '')}`;

            if (isDrive && fileUrl.includes('/view')) {
                fileUrl = fileUrl.replace('/view', '/preview');
            }

            if (isMemory && material.status !== 'FAILED') {
                return (
                    <div className="flex-1 h-full flex flex-col" style={{ background: 'var(--c-surface-alt)' }}>
                        {DeletedBanner}
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" style={{ color: 'var(--c-text-muted)' }}>
                            <div className="relative mb-6">
                                <div className="w-16 h-16 rounded-full border-4 border-dashed animate-spin" style={{ borderColor: 'var(--c-primary-light)', borderTopColor: 'var(--c-primary)' }} />
                                <Cloud className="w-6 h-6 absolute inset-0 m-auto opacity-50" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">Syncing with Cloud...</h3>
                            <p className="text-sm max-w-xs mx-auto">We're moving your document to Google Drive for permanent storage. This will only take a moment.</p>
                        </div>
                    </div>
                );
            }

            if (isPdf || isDrive) {
                return (
                    <div className="flex-1 h-full w-full flex flex-col" style={{ background: 'var(--c-canvas)' }}>
                        {DeletedBanner}
                        <iframe
                            key={tab.requestedPage ? `${fileUrl}-${tab.requestedPage}` : fileUrl}
                            src={isDrive ? (fileUrl.includes('?') ? `${fileUrl}&rm=minimal` : `${fileUrl}?rm=minimal`) : `${fileUrl}#page=${tab.requestedPage || 1}&view=Fit&zoom=page-fit`}
                            className="w-full flex-1 border-none"
                            title={tab.title}
                            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                        />
                    </div>
                );
            }

            if (isImage) {
                return (
                    <div className="flex-1 h-full w-full flex flex-col" style={{ background: 'var(--c-canvas)' }}>
                        {DeletedBanner}
                        <div className="flex-1 flex items-center justify-center p-6">
                            <img
                                src={fileUrl}
                                alt={tab.title}
                                className="max-w-full max-h-full object-contain rounded-2xl border shadow-sm"
                                style={{ borderColor: 'var(--c-border-soft)' }}
                            />
                        </div>
                    </div>
                );
            }

            return (
                <div className="flex-1 h-full flex flex-col" style={{ background: 'var(--c-surface-alt)' }}>
                    {DeletedBanner}
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" style={{ color: 'var(--c-text-muted)' }}>
                        <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: 'var(--c-primary)' }} />
                        <h3 className="text-lg font-bold mb-2">{tab.title}</h3>
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="mt-4 px-4 py-2 font-bold text-sm transition-colors rounded-lg" style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)' }}>
                            Download File
                        </a>
                    </div>
                </div>
            );
        }

        if (hasContent) {
            return (
                <div className="flex-1 h-full flex flex-col overflow-y-auto">
                    {DeletedBanner}
                    <div className={`mx-auto ${isExpanded ? 'max-w-6xl py-16' : 'max-w-4xl py-8 md:py-12'} px-6 transition-all duration-500`}>
                        <div className="border rounded-[1.5rem] p-8 shadow-sm leading-relaxed text-sm whitespace-pre-wrap font-mono" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border-soft)', color: 'var(--c-text)' }}>
                            {typeof material.content === 'object' ? JSON.stringify(material.content, null, 2) : (material.content || 'No content')}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex-1 h-full flex flex-col" style={{ background: 'var(--c-surface-alt)' }}>
                {DeletedBanner}
                <div className="flex-1 flex items-center justify-center p-8 text-center" style={{ color: 'var(--c-text-muted)' }}>
                    <div>
                        <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-bold mb-2">{tab.title}</h3>
                        <p className="text-sm">Document preview is not available.</p>
                    </div>
                </div>
            </div>
        );
    }

    // Use robust extraction utility to handle nested AI payloads
    let parsedContent = extractExamData(material.ai_generated_content || material.content || '');

    if (typeof parsedContent === 'object' && parsedContent) {
        parsedContent.id = material.id;
        parsedContent.title = parsedContent.title || material.title || '';
    }

    if (tab.type === 'quiz' || material.type === 'quiz') {
        return (
            <div className="flex-1 h-full flex flex-col overflow-y-auto bg-transparent">
                {DeletedBanner}
                <div className="flex-1">
                    <MaterialErrorBoundary type="quiz">
                        <QuizView key={tab.id} quizMode="static" quizData={parsedContent} isExpanded={isExpanded} subjectId={subjectId} topic={subjectName || null} language="en" />
                    </MaterialErrorBoundary>
                </div>
            </div>
        );
    }

    if (tab.type === 'flashcards' || material.type === 'flashcards') {
        return (
            <div className="flex-1 h-full flex flex-col overflow-y-auto bg-transparent">
                {DeletedBanner}
                <div className="flex-1">
                    <MaterialErrorBoundary type="flashcards">
                        <FlashcardsView flashcardsData={parsedContent} subjectId={subjectId} isExpanded={isExpanded} />
                    </MaterialErrorBoundary>
                </div>
            </div>
        );
    }

    if (tab.type === 'exam_session') {
        return (
            <div className="flex-1 h-full flex flex-col overflow-y-auto bg-transparent">
                {DeletedBanner}
                <div className="flex-1">
                    <MaterialErrorBoundary type="exam">
                        <ExamView examData={parsedContent} examId={material.id} subjectId={subjectId} isExpanded={isExpanded} />
                    </MaterialErrorBoundary>
                </div>
            </div>
        );
    }

    if (tab.type === 'exam' || material.type === 'exam') {
        return (
            <div className="flex-1 h-full flex flex-col overflow-y-auto bg-transparent">
                {DeletedBanner}
                <div className="flex-1">
                    <MaterialErrorBoundary type="exam">
                        <ExamView key={material.id} examData={parsedContent} examId={material.id} subjectId={subjectId} isExpanded={isExpanded} />
                    </MaterialErrorBoundary>
                </div>
            </div>
        );
    }

    if (tab.type === 'summary' || material.type === 'summary') {
        const summaryMode = material.ai_generated_content?.metadata?.summary_mode || material.ai_generated_content?.summary_mode;
        return (
            <div className="flex-1 h-full flex flex-col overflow-y-auto">
                {DeletedBanner}
                <div className="flex-1">
                    <MaterialErrorBoundary type="summary">
                        <SummaryView 
                            summaryData={parsedContent} 
                            title={tab.title} 
                            isExpanded={isExpanded} 
                            summaryMode={summaryMode}
                        />
                    </MaterialErrorBoundary>
                </div>
            </div>
        );
    }

    const displayContent = typeof parsedContent === 'object' ? JSON.stringify(parsedContent, null, 2) : String(parsedContent);

    return (
        <div className="flex-1 h-full flex flex-col overflow-y-auto">
            {DeletedBanner}
            <div className={`flex-1 ${isExpanded ? 'p-12' : 'p-6 md:p-12'} bg-transparent transition-all duration-500`}>
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
        </div>
    );
};

export default TabContent;

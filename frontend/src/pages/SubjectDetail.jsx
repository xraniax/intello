import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { materialService, examService, BASE_URL } from '../services/api';
import { useSpeech } from '../hooks/useSpeech';
import { 
    PanelLeft, 
    PanelRight, 
    Upload, 
    BookOpen, 
    Lock, 
    Sparkles, 
    XCircle,
    ChevronRight,
    FileText,
    Layout,
    MoreHorizontal,
    Plus,
    Search,
    Settings,
    Trash2,
    X,
    Check,
    MessageSquare,
    History,
    RefreshCw
} from 'lucide-react';
import { useSubjectStore } from '../store/useSubjectStore';
import { setFlashcardsExpectedCount } from '../components/Subject/FlashcardsView';
import { useMaterialStore } from '../store/useMaterialStore';
import { useUIStore } from '../store/useUIStore';
import { useAuthStore } from '../store/useAuthStore';
import { PROCESSING } from '../constants/statusConstants';
import toast from 'react-hot-toast';
import CustomModal from '../components/Common/CustomModal';
import MobilePanelSwitcher from '../components/Common/MobilePanelSwitcher';
import FloatingActionButton from '../components/Common/FloatingActionButton';
import { requireAuth } from '../utils/requireAuth';

import WorkspaceLayout from '../components/Subject/WorkspaceLayout';
import WorkspaceTabs from '../components/Subject/WorkspaceTabs';
import FilePanel from '../components/Subject/FilePanel';
import MaterialsPanel from '../components/Subject/MaterialsPanel';
import ChatPanel from '../components/Subject/ChatPanel';
import UploadModal from '../components/Subject/UploadModal';
import Skeleton from '../components/Common/Skeleton';
import QuizView from '../components/Subject/QuizView';
import FlashcardsView from '../components/Subject/FlashcardsView';
import ExamView from '../components/Subject/ExamView';
import SummaryView from '../components/Subject/SummaryView';

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
    const location = useLocation();
    const normalizedId = String(id);
    const redirectedMaterialId = location.state?.openMaterialId;
    
    const subjects = useSubjectStore((state) => state.data.subjects);
    const fetchSubjects = useSubjectStore((state) => state.actions.fetchSubjects);
    const materials = useMaterialStore((state) => state.data.materials);
    const materialsLoadingState = useUIStore(state => state.data.loadingStates['materials']);
    const subjectsLoadingState = useUIStore(state => state.data.loadingStates['subjects']);
    const isPublic = useSubjectStore((state) => state.data.isPublic);
    const user = useAuthStore((state) => state.data.user);
    const fetchMaterials = useMaterialStore((state) => state.actions.fetchMaterials);
    const clearAllPolling = useMaterialStore((state) => state.actions.clearAllPolling);
    const setWorkspacePanel = useUIStore(state => state.actions.setWorkspacePanel);

    const loading = materialsLoadingState?.loading || subjectsLoadingState?.loading;
    const isAnyBlocking = materialsLoadingState?.blocking || subjectsLoadingState?.blocking;

    const subject = subjects.find((s) => String(s.id) === normalizedId);
    
    // Derived state for document list
    const uploads = useMemo(() => {
        return (materials || []).filter((m) => {
            const mid = m.subject_id || (m.subject && m.subject.id);
            return String(mid) === String(normalizedId);
        });
    }, [materials, normalizedId]);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState({});

    // Selection & Generation state
    const [selectedUploads, setSelectedUploads] = useState([]);
    const [showUploadModal, setShowUploadModal] = useState(false);

    // Chat state
    const [chatError, setChatError] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [chatCollapsed, setChatCollapsed] = useState(false);
    const [filePanelCollapsed, setFilePanelCollapsed] = useState(false);
    
    const jobProgress = useMaterialStore((state) => state.data.jobProgress);
    
    // Generation state
    const [genError, setGenError] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [genResult, setGenResult] = useState('');
    const [genType, setGenType] = useState('summary');

    // Tabs State & Persistence
    const savedTabsKey = `cognify_tabs_${id}`;
    const savedActiveTabKey = `cognify_active_tab_${id}`;

    const [tabs, setTabs] = useState(() => {
        const saved = localStorage.getItem(savedTabsKey);
        const base = { id: 'generator', title: 'Study Intelligence', type: 'generator', pinned: true };
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const otherTabs = parsed.filter(t => t.id !== 'generator');
                return [base, ...otherTabs];
            } catch {
                return [base];
            }
        }
        return [base];
    });

    const [activeTabId, setActiveTabId] = useState(() => {
        return localStorage.getItem(savedActiveTabKey) || 'generator';
    });

    const chatEndRef = useRef(null);
    const { speak, listen, isListening, cancel } = useSpeech();

    // Persistence Sync
    useEffect(() => {
        localStorage.setItem(savedTabsKey, JSON.stringify(tabs));
    }, [tabs, savedTabsKey]);

    // Compute enhanced tabs with deleted status
    const enhancedTabs = useMemo(() => {
        return tabs.map(tab => {
            if (tab.id === 'generator') return { ...tab, isDeleted: false };
            const exists = (materials || []).some(m => String(m.id) === String(tab.id));
            return { ...tab, isDeleted: !exists };
        });
    }, [tabs, materials]);

    useEffect(() => {
        if (activeTabId) {
            localStorage.setItem(savedActiveTabKey, activeTabId);
        }
    }, [activeTabId, savedActiveTabKey]);

    useEffect(() => {
        const init = async () => {
            try {
                await Promise.all([fetchSubjects(), fetchMaterials()]);
                setWorkspacePanel('content');
                
                // Handle redirected material selection
                if (redirectedMaterialId) {
                    const mid = redirectedMaterialId;
                    const currentMaterials = useMaterialStore.getState().data.materials;
                    const redirectedMaterial = currentMaterials.find(m => m.id === mid);
                    
                    if (redirectedMaterial && redirectedMaterial.type !== 'upload') {
                        // Open generated insight in a tab
                        setTabs(prev => {
                            if (!prev.find(t => String(t.id) === String(mid))) {
                                return [...prev, {
                                    id: mid,
                                    title: redirectedMaterial.title || redirectedMaterial.type,
                                    type: redirectedMaterial.type,
                                    material: redirectedMaterial,
                                    pinned: false
                                }];
                            }
                            return prev;
                        });
                        setActiveTabId(mid);
                    } else if (redirectedMaterial && redirectedMaterial.type === 'upload') {
                        // Open source document in a tab
                        setTabs(prev => {
                            if (!prev.find(t => String(t.id) === String(mid))) {
                                return [...prev, {
                                    id: mid,
                                    title: redirectedMaterial.title,
                                    type: 'upload',
                                    material: redirectedMaterial,
                                    pinned: false
                                }];
                            }
                            return prev;
                        });
                        setActiveTabId(mid);
                        setSelectedUploads([mid]);
                    }
                }
            } catch {
                console.error('Failed to load subject details');
            }
        };
        init();
        return () => {
            clearAllPolling();
            cancel();
        };
    }, [id, fetchSubjects, fetchMaterials, clearAllPolling, redirectedMaterialId, setWorkspacePanel, cancel, user]);

    useEffect(() => {
        const handleOpenMaterial = (e) => {
            const { id } = e.detail;
            const currentMaterials = useMaterialStore.getState().data.materials;
            const material = currentMaterials.find(m => String(m.id) === String(id));
            
            if (material) {
                setTabs(prev => {
                    if (!prev.find(t => String(t.id) === String(id))) {
                        return [...prev, {
                            id,
                            title: material.title || material.type,
                            type: material.type,
                            material,
                            pinned: false
                        }];
                    }
                    return prev;
                });
                setActiveTabId(id);
                setWorkspacePanel('content');
            }
        };

        window.addEventListener('open-material', handleOpenMaterial);
        return () => window.removeEventListener('open-material', handleOpenMaterial);
    }, [setWorkspacePanel]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isThinking]);

    // Sync generation result from polling state
    useEffect(() => {
        if (!jobProgress) return;

        if (jobProgress.result) {
            const rawResult = jobProgress.result;
            const resultStr = typeof rawResult === 'object' ? JSON.stringify(rawResult, null, 2) : String(rawResult);
            
            if (resultStr.includes('cyclic') || resultStr.includes('circular')) {
                setGenError('Internal Technical Error: A circular data structure was detected in the AI output.');
                setIsGenerating(false);
            } else {
                setGenResult(resultStr);
                setIsGenerating(false);
                
                // After success, wait briefly, then automatically open the new material in a tab
                // Let fetchMaterials catch up so the material is available in store
                setTimeout(async () => {
                    await fetchMaterials();
                    
                    // Use the specific material ID we tracked during generation
                    const currentMaterials = useMaterialStore.getState().data.materials;
                    const newMatId = jobProgress.materialId; 
                    const newMat = currentMaterials.find(m => String(m.id) === String(newMatId));
                    
                    if (newMat) {
                        setTabs(prev => {
                            if (!prev.find(t => String(t.id) === String(newMat.id))) {
                                return [...prev, {
                                    id: newMat.id,
                                    title: newMat.title || newMat.type,
                                    type: newMat.type,
                                    material: newMat,
                                    pinned: false
                                }];
                            }
                            return prev;
                        });
                        setActiveTabId(newMat.id);
                        setGenResult('');
                    }
                }, 1500);
            }
        }

        if (jobProgress.stage === 'failed') {
            let msg = jobProgress.message || 'Generation failed.';
            if (typeof msg === 'string' && (msg.includes('cyclic') || msg.includes('circular'))) {
                msg = 'Internal Technical Error: Circular data detected in error reporting. Please refresh the page.';
            }
            setGenError(msg);
            setIsGenerating(false);
        }
    }, [jobProgress, fetchMaterials]);

    const handleUploadSuccess = async () => {
        await fetchMaterials();
        setShowUploadModal(false);
    };

    const handleDeleteUpload = (materialId, materialName) => {
        setModalConfig({
            title: 'Delete document?',
            message: `Are you sure you want to delete "${materialName || 'this file'}"? This cannot be undone.`,
            type: 'warning',
            confirmText: 'Delete permanently',
            onConfirm: async () => {
                try {
                    await materialService.delete(materialId);
                    await fetchMaterials();
                    setSelectedUploads(prev => prev.filter(id => id !== materialId));
                    toast.success('Document removed');
                } catch {
                    toast.error('Failed to delete material');
                } finally {
                    setIsModalOpen(false);
                }
            }
        });
        setIsModalOpen(true);
    };

    const handleChat = async (e) => {
        e.preventDefault();
        if (!currentQuestion.trim() || isThinking) return;
        setChatError('');
        const userMsg = { role: 'user', content: currentQuestion };
        setChatMessages(prev => [...prev, userMsg]);
        setCurrentQuestion('');
        setIsThinking(true);
        try {
            const contextIds = selectedUploads.length > 0 ? selectedUploads : uploads.map(m => m.id);
            const res = await materialService.chatCombined(contextIds, userMsg.content);
            setChatMessages(prev => [...prev, { role: 'ai', content: res.data.data.result }]);
        } catch (err) {
            setChatError(err.message || 'AI engine is unreachable. Please try again.');
            setChatMessages(prev => [...prev, { role: 'ai', content: `Error: ${err.message}` }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleClearChat = () => {
        setChatMessages([]);
        setChatError('');
    };

    const handleGenerate = async (idOrOptionsOrEvent = null) => {
        setGenError('');
        
        let singleId = null;
        let genOptions = undefined;

        if (typeof idOrOptionsOrEvent === 'string') {
            singleId = idOrOptionsOrEvent;
        } else if (idOrOptionsOrEvent && typeof idOrOptionsOrEvent === 'object' && !idOrOptionsOrEvent.nativeEvent) {
            genOptions = idOrOptionsOrEvent;
        }

        const rawTargets = singleId ? [singleId] : selectedUploads;
        // FINAL GUARD: Ensure only non-empty strings are passed to the backend
        const targets = rawTargets
            .filter(t => t && typeof t === 'string' && t !== '[object Object]')
            .map(t => String(t));

        if (genType !== 'mock_exam' && targets.length === 0) {
            setGenError('Select at least one document from the Source Files panel first.');
            return;
        }
        setIsGenerating(true);
        setGenResult('');
        
        if (genType === 'flashcards' && genOptions?.count) {
            setFlashcardsExpectedCount(genOptions.count);
        }
        
        try {
            if (genType === 'mock_exam') {
                const diffMap = { Default: 'mixed', Hard: 'hard', Expert: 'hard' };
                const topics = (genOptions?.topics || subject?.name || '')
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean);
                const selectedTypes = Array.isArray(genOptions?.examTypes) && genOptions.examTypes.length > 0
                    ? genOptions.examTypes
                    : ['single_choice', 'multiple_select', 'short_answer', 'problem', 'fill_blank', 'matching', 'scenario'];

                const payload = {
                    subject_id: normalizedId,
                    numberOfQuestions: genOptions?.count || 10,
                    difficulty: genOptions?.difficulty || 'Inter',
                    topics: topics.length > 0 ? topics : [subject?.name || 'General'],
                    types: selectedTypes,
                    title: `${subject?.name || 'General'} Mock Exam`,
                    timeLimit: genOptions?.timeLimit || 30,
                };

                const examRes = await examService.generate(payload);
                const exam = examRes?.data?.data;
                if (!exam?.id || !Array.isArray(exam.questions)) {
                    throw new Error('Failed to generate exam');
                }

                const tabId = `exam-${exam.id}`;
                setTabs(prev => {
                    const withoutOldSession = prev.filter((t) => t.type !== 'exam_session');
                    return [...withoutOldSession, {
                        id: tabId,
                        title: exam.title || 'Mock Exam',
                        type: 'exam_session',
                        material: {
                            id: tabId,
                            type: 'exam_session',
                            ai_generated_content: exam,
                        },
                        pinned: false,
                    }];
                });
                setActiveTabId(tabId);
                setIsGenerating(false);
                setGenResult('');
                return;
            }

            console.debug('[SubjectDetail] Triggering generation for sanitized targets:', targets, genType, id, genOptions);
            const res = await materialService.generateCombined(targets, genType, id, genOptions);
            
            if (!res?.data?.data) {
                throw new Error('Malformed response from server: Missing data field.');
            }

            const { material_id, job_id } = res.data.data;
            console.info(`[SubjectDetail] Generation Trigger SUCCESS: materialId=${material_id}, jobId=${job_id}`);

            if (material_id) {
                const safeMid = String(material_id);
                fetchMaterials(); 
                
                // Set the active tab to generator immediately
                setActiveTabId('generator');

                // Start streaming if it's a summary (best for text)
                // We'll also stream for others to show "Thinking" progress
                materialService.streamMaterial(
                    material_id,
                    (chunk) => {
                        setGenResult(prev => (prev || '') + chunk);
                        setIsGenerating(true); // Keep spinner/neural pulse active
                    },
                    () => {
                        console.info(`[SubjectDetail] Stream completed for ${material_id}`);
                        setIsGenerating(false);
                        
                        // Force a status sync with the backend to ensure Celery results are persisted to DB
                        materialService.sync(material_id).then(() => {
                            // Now fetch the updated materials list
                            fetchMaterials().then(() => {
                                const currentMaterials = useMaterialStore.getState().data.materials;
                                const newMat = currentMaterials.find(m => String(m.id) === String(material_id));
                                
                                if (newMat) {
                                    setTabs(prev => {
                                        if (!prev.find(t => String(t.id) === String(newMat.id))) {
                                            return [...prev, {
                                                id: newMat.id,
                                                title: newMat.title || newMat.type,
                                                type: newMat.type,
                                                material: newMat,
                                                pinned: false
                                            }];
                                        }
                                        return prev;
                                    });
                                    setActiveTabId(newMat.id);
                                    // Clear the generation preview once opened in its own tab
                                    setGenResult('');
                                }
                            });
                        }).catch(err => {
                            console.error('[SubjectDetail] Sync failed after stream:', err);
                            fetchMaterials(); // Fallback fetch anyway
                        });
                    },
                    (err) => {
                        console.warn(`[SubjectDetail] Stream error for ${material_id}:`, err);
                        // Fallback to polling if stream fails
                        useMaterialStore.getState().actions.startPolling(safeMid);
                    }
                );
            } else {
                const fallbackResult = res.data.data.result || res.data.data.content || '';
                setGenResult(typeof fallbackResult === 'object' ? JSON.stringify(fallbackResult, null, 2) : String(fallbackResult));
                setIsGenerating(false);
            }
        } catch (err) {
            console.error('[SubjectDetail] handleGenerate Error:', err);
            
            let displayError = err.message || 'Generation failed. Please try again.';
            if (displayError.toLowerCase().includes('cyclic') || displayError.toLowerCase().includes('circular')) {
                displayError = 'Internal Technical Error: A circular reference was detected. Please refresh the page and try again.';
            }
            
            setGenError(displayError);
            setIsGenerating(false);
        }
    };

    const toggleSelection = (mid) => {
        setSelectedUploads(prev => {
            const isAdding = !prev.includes(mid);
            if (isAdding) {
                setActiveTabId('generator');
            }
            return isAdding ? [...prev, mid] : prev.filter(id => id !== mid);
        });
    };

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
                    handleGenerate={handleGenerate}
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

        // Ensure we have the material object (fallback to store if missing from persisted tab)
        const material = tab.material || (materials || []).find(m => String(m.id) === String(tabId));
        
        if (!material) {
            return (
                <div className="flex-1 flex items-center justify-center p-12">
                    <Skeleton className="w-full max-w-2xl h-64 rounded-[2rem]" />
                </div>
            );
        }

        if (tab.type === 'upload') {
            const hasFile = !!tab.material?.file_path;
            const hasContent = !!tab.material?.content;
            
            if (hasFile) {
                const fileUrl = `${BASE_URL}/${tab.material.file_path}`;
                if (tab.material.file_path.toLowerCase().endsWith('.pdf')) {
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
                            <p className="text-xs mt-4 text-gray-400">Use the Study Intelligence tab to analyze this file.</p>
                        </div>
                    );
                }
            } else if (hasContent) {
                return (
                    <div className={`mx-auto ${isExpanded ? 'max-w-6xl py-16' : 'max-w-4xl py-8 md:py-12'} px-6 transition-all duration-500`}>
                        <div className="bg-white border border-gray-100 rounded-[1.5rem] p-8 shadow-sm text-gray-800 leading-relaxed text-sm whitespace-pre-wrap font-mono">
                            {tab.material.content}
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
                        <p className="text-xs mt-2">Use the Study Intelligence tab to analyze this file.</p>
                    </div>
                </div>
            );
        }

        let parsedContent = tab.material?.ai_generated_content || tab.material?.content || '';
        if (typeof parsedContent === 'string') {
            try { parsedContent = JSON.parse(parsedContent); } catch {
                // non-json content
            }
        }
        if (parsedContent?.result) parsedContent = parsedContent.result;
        
        // Handle specialized rendering for structured content
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
                        <ExamView examData={tab.material?.ai_generated_content} isExpanded={isExpanded} />
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
            {/* Page Header - Compact Optimization */}
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

            {/* Three-Panel Workspace */}
            <WorkspaceLayout
                leftPanelCollapsed={filePanelCollapsed}
                rightPanelCollapsed={chatCollapsed}
                leftPanel={
                    <FilePanel
                        materials={uploads}
                        selectedMaterials={selectedUploads}
                        toggleSelection={toggleSelection}
                        onDelete={handleDeleteUpload}
                        onGenerate={handleGenerate}
                        onOpenUpload={() => requireAuth(() => setShowUploadModal(true))}
                        onCollapse={() => setFilePanelCollapsed(true)}
                        isPublic={isPublic}
                    />
                }
                middlePanel={
                    <WorkspaceTabs 
                        tabs={enhancedTabs} 
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
                        onClearChat={handleClearChat}
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

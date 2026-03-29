import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { materialService } from '../services/api';
import { useSpeech } from '../hooks/useSpeech';
import { PanelLeft, PanelRight, Upload, BookOpen, Lock } from 'lucide-react';
import { useSubjectStore } from '../store/useSubjectStore';
import { useMaterialStore } from '../store/useMaterialStore';
import { useUIStore } from '../store/useUIStore';
import { useAuthStore } from '../store/useAuthStore';
import { PROCESSING, normalizeStatus } from '../constants/statusConstants';
import toast from 'react-hot-toast';
import CustomModal from '../components/Common/CustomModal';
import MobilePanelSwitcher from '../components/Common/MobilePanelSwitcher';
import FloatingActionButton from '../components/Common/FloatingActionButton';
import { requireAuth } from '../utils/requireAuth';

import WorkspaceLayout from '../components/Subject/WorkspaceLayout';
import FilePanel from '../components/Subject/FilePanel';
import MaterialsPanel from '../components/Subject/MaterialsPanel';
import ChatPanel from '../components/Subject/ChatPanel';
import UploadModal from '../components/Subject/UploadModal';
import Skeleton from '../components/Common/Skeleton';

const SubjectDetail = () => {
    const { id } = useParams();
    const location = useLocation();
    const normalizedId = String(id);
    const redirectedMaterialId = location.state?.openMaterialId;
    
    const subjects = useSubjectStore((state) => state.data.subjects);
    const isPublic = useSubjectStore((state) => state.data.isPublic);
    const user = useAuthStore((state) => state.data.user);
    const subjectsLoading = useUIStore(state => state.data.loadingStates['subjects']?.loading);
    const fetchSubjects = useSubjectStore((state) => state.actions.fetchSubjects);
    const materials = useMaterialStore((state) => state.data.materials);
    const materialsLoading = useUIStore(state => state.data.loadingStates['materials']?.loading);
    const fetchMaterials = useMaterialStore((state) => state.actions.fetchMaterials);
    const clearAllPolling = useMaterialStore((state) => state.actions.clearAllPolling);
    
    const setWorkspacePanel = useUIStore(state => state.actions.setWorkspacePanel);
    
    const subject = subjects.find((s) => String(s.id) === normalizedId);
    const uploads = (materials || []).filter((m) => {
        const mid = m.subject_id || (m.subject && m.subject.id);
        return String(mid) == String(normalizedId);
    });
    const loading = subjectsLoading || materialsLoading;

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
    
    // Generation state
    const [genError, setGenError] = useState('');
    const [genType, setGenType] = useState('summary');
    const [isGenerating, setIsGenerating] = useState(false);
    const [genResult, setGenResult] = useState('');

    const chatEndRef = useRef(null);
    const { speak, listen, isListening, cancel } = useSpeech();

    useEffect(() => {
        const init = async () => {
            try {
                await Promise.all([fetchSubjects(), fetchMaterials()]);
                setWorkspacePanel('content');
                
                // Handle redirected material selection
                if (redirectedMaterialId) {
                    const mid = redirectedMaterialId;
                    setSelectedUploads([mid]);
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
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isThinking]);

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

    const handleGenerate = async (singleId = null) => {
        setGenError('');
        const targets = singleId ? [singleId] : selectedUploads;

        if (targets.length === 0) {
            setGenError('Select at least one document from the Source Files panel first.');
            return;
        }
        setIsGenerating(true);
        setGenResult('');
        try {
            const res = await materialService.generateCombined(targets, genType);
            setGenResult(res.data.data.result);
        } catch (err) {
            setGenError(err.message || 'Generation failed. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const toggleSelection = (mid) =>
        setSelectedUploads(prev =>
            prev.includes(mid) ? prev.filter(id => id !== mid) : [...prev, mid]
        );

    if (loading) {
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

    return (
        <div className="subject-page flex-1 min-h-0 flex flex-col bg-[#FFF8F0]/30 animate-in fade-in duration-700 pb-20 md:pb-0">
            {/* Page Header */}
            <div className="px-6 md:px-8 py-4 md:py-6 border-b border-purple-100/50 bg-white/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
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
                            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight truncate">{subject?.name}</h1>
                            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                {uploads.length} Sources
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-gray-400 font-medium truncate max-w-[150px] sm:max-w-md">
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
                    <MaterialsPanel
                        genType={genType}
                        setGenType={setGenType}
                        handleGenerate={handleGenerate}
                        isGenerating={isGenerating}
                        selectedCount={selectedUploads.length}
                        genResult={genResult}
                        setGenResult={setGenResult}
                        genError={genError}
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

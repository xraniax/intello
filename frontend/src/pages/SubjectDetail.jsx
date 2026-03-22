import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { subjectService, materialService } from '../services/api';
import { useSpeech } from '../hooks/useSpeech';
import { PanelLeft, PanelRight } from 'lucide-react';
import toast from 'react-hot-toast';
import CustomModal from '../components/Common/CustomModal';

import WorkspaceLayout from '../components/Subject/WorkspaceLayout';
import FilePanel from '../components/Subject/FilePanel';
import MaterialsPanel from '../components/Subject/MaterialsPanel';
import ChatPanel from '../components/Subject/ChatPanel';
import UploadModal from '../components/Subject/UploadModal';
import Skeleton from '../components/Common/Skeleton';

const SubjectDetail = () => {
    const { id } = useParams();
    const location = useLocation();
    const [subject, setSubject] = useState(null);
    const [uploads, setUploads] = useState([]);
    const [loading, setLoading] = useState(true);

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
    const chatEndRef = useRef(null);

    // Generation state
    const [genError, setGenError] = useState('');
    const [genType, setGenType] = useState('summary');
    const [isGenerating, setIsGenerating] = useState(false);
    const [genResult, setGenResult] = useState('');

    const { isListening, speak, listen } = useSpeech();

    useEffect(() => { fetchDetails(); }, [id]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isThinking]);

    const fetchDetails = async () => {
        try {
            const res = await subjectService.getOne(id);
            const fetchedMaterials = res.data.data.materials;
            setSubject(res.data.data.subject);
            setUploads(fetchedMaterials);

            // Handle redirected material selection
            if (location.state?.openMaterialId) {
                const mid = location.state.openMaterialId;
                if (!selectedUploads.includes(mid)) {
                    setSelectedUploads([mid]);
                    // Auto-trigger summary generation for this material
                    setTimeout(() => handleGenerate(mid), 500);
                }
            }
        } catch (err) {
            console.error('Failed to fetch subject details:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUploadSuccess = async () => {
        await fetchDetails();
    };

    const handleDeleteUpload = (materialId) => {
        const material = uploads.find(m => m.id === materialId);
        setModalConfig({
            title: 'Delete document?',
            message: `Are you sure you want to delete "${material?.title || 'this file'}"? This cannot be undone.`,
            type: 'warning',
            confirmText: 'Delete permanently',
            onConfirm: async () => {
                try {
                    await materialService.delete(materialId);
                    setUploads(prev => prev.filter(m => m.id !== materialId));
                    setSelectedUploads(prev => prev.filter(id => id !== materialId));
                    toast.success('Document removed');
                } catch (err) {
                    console.error('Failed to delete material:', err);
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

    return (
        <div className="subject-page flex-1 min-h-0 flex flex-col bg-[#FFF8F0]/30 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="px-8 py-6 border-b border-purple-100/50 bg-white/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-6">
                    <Link 
                        to="/dashboard" 
                        className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all group"
                        title="Back to Garden"
                    >
                        <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">{subject?.name}</h1>
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 text-[10px] font-black uppercase tracking-widest">
                                {uploads.length} Sources
                            </span>
                        </div>
                        <p className="text-sm text-gray-400 font-medium truncate max-w-md">
                            {subject?.description || 'Refining knowledge with AI clarity.'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
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
                        onClick={() => setShowUploadModal(true)}
                        className="btn-primary py-2.5 px-6 text-sm"
                    >
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
                        onOpenUpload={() => setShowUploadModal(true)}
                        onCollapse={() => setFilePanelCollapsed(true)}
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

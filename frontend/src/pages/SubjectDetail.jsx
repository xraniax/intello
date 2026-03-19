import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { subjectService, materialService } from '../services/api';
import { useSpeech } from '../hooks/useSpeech';
import { PanelLeft, PanelRight } from 'lucide-react';

import WorkspaceLayout from '../components/Subject/WorkspaceLayout';
import FilePanel from '../components/Subject/FilePanel';
import MaterialsPanel from '../components/Subject/MaterialsPanel';
import ChatPanel from '../components/Subject/ChatPanel';
import UploadModal from '../components/Subject/UploadModal';

const SubjectDetail = () => {
    const { id } = useParams();
    const [subject, setSubject] = useState(null);
    const [uploads, setUploads] = useState([]);
    const [loading, setLoading] = useState(true);

    // Upload state
    const [selectedUploads, setSelectedUploads] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [uploadValidationErrors, setUploadValidationErrors] = useState({});
    const [uploadSuccess, setUploadSuccess] = useState('');
    const [newUploadTitle, setNewUploadTitle] = useState('');
    const [newUploadContent, setNewUploadContent] = useState('');
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadFileError, setUploadFileError] = useState('');
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
            setSubject(res.data.data.subject);
            setUploads(res.data.data.materials);
        } catch (err) {
            console.error('Failed to fetch subject details:', err);
        } finally {
            setLoading(false);
        }
    };

    const validatePdfFile = (file) => {
        if (!file) return null;
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'pdf' || file.type !== 'application/pdf') return 'Only .pdf files are accepted.';
        if (file.size > 10 * 1024 * 1024) return 'File must be under 10 MB.';
        return null;
    };

    const handleFileChange = (e) => {
        const selected = e.target.files[0] || null;
        const err = validatePdfFile(selected);
        setUploadFileError(err || '');
        setUploadFile(err ? null : selected);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        setUploadError('');
        setUploadSuccess('');
        if (uploadFileError) return;

        // Handle title logic for validation
        const titleToValidate = (newUploadTitle && newUploadTitle.trim()) || (uploadFile ? uploadFile.name : '');

        // Check for duplicate titles
        const isDuplicate = uploads.some(m => m.title.toLowerCase() === titleToValidate.toLowerCase());
        if (isDuplicate) {
            setUploadError(`A material with the title "${titleToValidate}" already exists in this workspace.`);
            return;
        }

        if (!newUploadContent.trim() && !uploadFile) {
            setUploadError('Please provide either text content or a PDF document.');
            return;
        }

        setUploading(true);
        setUploadValidationErrors({}); // clear previous Zod errors
        try {
            if (uploadFile) {
                const formData = new FormData();
                formData.append('file', uploadFile);
                if (newUploadTitle) formData.append('title', newUploadTitle);
                if (newUploadContent) formData.append('content', newUploadContent);
                formData.append('type', 'upload');
                formData.append('subjectId', id);
                await materialService.upload(formData);
            } else {
                await materialService.upload({
                    title: newUploadTitle || 'New Resource',
                    content: newUploadContent,
                    type: 'upload',
                    subjectId: id,
                });
            }
            setNewUploadTitle('');
            setNewUploadContent('');
            setUploadFile(null);
            setUploadSuccess('Material uploaded — AI is processing it.');
            setShowUploadModal(false); // Close modal on success
            await fetchDetails();
        } catch (err) {
            if (err.code === 'VALIDATION_ERROR') {
                setUploadValidationErrors(err.validationErrors || {});
                setUploadError('Please check the form for errors.');
            } else {
                setUploadError('Upload failed. Please try again.');
            }
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteUpload = async (materialId) => {
        if (!window.confirm('Are you sure you want to delete this file? This cannot be undone.')) return;
        try {
            await materialService.delete(materialId);
            setUploads(prev => prev.filter(m => m.id !== materialId));
            setSelectedUploads(prev => prev.filter(id => id !== materialId));
        } catch (err) {
            console.error('Failed to delete material:', err);
            alert('Failed to delete material. Please try again.');
        }
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
            <div style={{ padding: '2rem', color: '#6b7280' }}>
                Loading subject details...
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
                        onOpenUpload={() => {
                            setUploadError('');
                            setUploadSuccess('');
                            setUploadValidationErrors({});
                            setShowUploadModal(true);
                        }}
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
                handleUpload={handleUpload}
                uploading={uploading}
                newUploadTitle={newUploadTitle}
                setNewUploadTitle={setNewUploadTitle}
                newUploadContent={newUploadContent}
                setNewUploadContent={setNewUploadContent}
                handleFileChange={handleFileChange}
                uploadFile={uploadFile}
                uploadFileError={uploadFileError}
                uploadError={uploadError}
                uploadValidationErrors={uploadValidationErrors}
                uploadSuccess={uploadSuccess}
            />
        </div>
    );
};

export default SubjectDetail;

import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { subjectService, materialService } from '../services/api';
import { useSpeech } from '../hooks/useSpeech';

import WorkspaceLayout from '../components/Subject/WorkspaceLayout';
import FilePanel from '../components/Subject/FilePanel';
import MaterialsPanel from '../components/Subject/MaterialsPanel';
import ChatPanel from '../components/Subject/ChatPanel';

const SubjectDetail = () => {
    const { id } = useParams();
    const [subject, setSubject] = useState(null);
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);

    // Upload state
    const [selectedMaterials, setSelectedMaterials] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [uploadSuccess, setUploadSuccess] = useState('');
    const [newUploadTitle, setNewUploadTitle] = useState('');
    const [newUploadContent, setNewUploadContent] = useState('');
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadFileError, setUploadFileError] = useState('');

    // Chat state
    const [chatError, setChatError] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [isThinking, setIsThinking] = useState(false);
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
            setMaterials(res.data.data.materials);
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
        if (!newUploadContent.trim() && !uploadFile) {
            setUploadError('Please provide either text content or a PDF document.');
            return;
        }
        setUploading(true);
        try {
            if (uploadFile) {
                const formData = new FormData();
                formData.append('file', uploadFile);
                if (newUploadTitle) formData.append('title', newUploadTitle);
                if (newUploadContent) formData.append('content', newUploadContent);
                formData.append('type', 'note');
                formData.append('subjectId', id);
                await materialService.upload(formData);
            } else {
                await materialService.upload({
                    title: newUploadTitle || 'New Resource',
                    content: newUploadContent,
                    type: 'note',
                    subjectId: id,
                });
            }
            setNewUploadTitle('');
            setNewUploadContent('');
            setUploadFile(null);
            setUploadSuccess('Material uploaded — AI is processing it.');
            await fetchDetails();
        } catch (err) {
            setUploadError(err.response?.data?.message || 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
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
            const contextIds = selectedMaterials.length > 0 ? selectedMaterials : materials.map(m => m.id);
            const res = await materialService.chatCombined(contextIds, userMsg.content);
            setChatMessages(prev => [...prev, { role: 'ai', content: res.data.data.result }]);
        } catch (err) {
            setChatError('AI engine is unreachable. Please try again.');
            setChatMessages(prev => [...prev, { role: 'ai', content: 'Error: AI engine unreachable.' }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleGenerate = async () => {
        setGenError('');
        if (selectedMaterials.length === 0) {
            setGenError('Select at least one document from the Files panel first.');
            return;
        }
        setIsGenerating(true);
        setGenResult('');
        try {
            const res = await materialService.generateCombined(selectedMaterials, genType);
            setGenResult(res.data.data.result);
        } catch (err) {
            setGenError('Generation failed. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const toggleSelection = (mid) =>
        setSelectedMaterials(prev =>
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
        <div className="subject-page">
            {/* Page Header */}
            <div className="subject-header">
                <Link to="/dashboard" className="back-link">← Dashboard</Link>
                <div className="subject-header__info">
                    <h1 className="subject-title">{subject?.name}</h1>
                    <span className="subject-description">
                        {subject?.description || 'Your learning workspace.'}
                    </span>
                </div>
                <span className="subject-meta">{materials.length} documents</span>
            </div>

            {/* Three-Panel Workspace */}
            <WorkspaceLayout
                leftPanel={
                    <FilePanel
                        materials={materials}
                        selectedMaterials={selectedMaterials}
                        toggleSelection={toggleSelection}
                        handleUpload={handleUpload}
                        uploading={uploading}
                        uploadFile={uploadFile}
                        newUploadTitle={newUploadTitle}
                        setNewUploadTitle={setNewUploadTitle}
                        newUploadContent={newUploadContent}
                        setNewUploadContent={setNewUploadContent}
                        handleFileChange={handleFileChange}
                        uploadFileError={uploadFileError}
                        uploadError={uploadError}
                        uploadSuccess={uploadSuccess}
                    />
                }
                middlePanel={
                    <MaterialsPanel
                        genType={genType}
                        setGenType={setGenType}
                        handleGenerate={handleGenerate}
                        isGenerating={isGenerating}
                        selectedCount={selectedMaterials.length}
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
                        contextInfo={selectedMaterials.length > 0 ? 'Grounded in selected context' : 'Using all subject data'}
                        chatError={chatError}
                    />
                }
            />
        </div>
    );
};

export default SubjectDetail;

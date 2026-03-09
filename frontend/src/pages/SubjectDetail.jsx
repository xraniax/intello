import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { subjectService, materialService } from '../services/api';
import { useSpeech } from '../hooks/useSpeech';

import ResourceLibrary from '../components/Subject/ResourceLibrary';
import AITutor from '../components/Subject/AITutor';
import StudyGenerator from '../components/Subject/StudyGenerator';

const SubjectDetail = () => {
    const { id } = useParams();
    const [subject, setSubject] = useState(null);
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedMaterials, setSelectedMaterials] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [newUploadTitle, setNewUploadTitle] = useState('');
    const [newUploadContent, setNewUploadContent] = useState('');
    const [uploadFile, setUploadFile] = useState(null);

    const [chatMessages, setChatMessages] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const chatEndRef = useRef(null);

    const [genType, setGenType] = useState('summary');
    const [isGenerating, setIsGenerating] = useState(false);
    const [genResult, setGenResult] = useState('');

    const { isListening, speak, listen } = useSpeech();

    useEffect(() => {
        fetchDetails();
    }, [id]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isThinking]);

    const fetchDetails = async () => {
        try {
            const res = await subjectService.getOne(id);
            setSubject(res.data.data.subject);
            setMaterials(res.data.data.materials);
        } catch (err) {
            alert('Failed to fetch subject details');
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!newUploadContent.trim() && !uploadFile) {
            alert('Please provide either text content or a PDF document.');
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
                    subjectId: id
                });
            }

            setNewUploadTitle('');
            setNewUploadContent('');
            setUploadFile(null);
            alert('Material uploaded and processing...');
            await fetchDetails();
        } catch (err) {
            alert('Upload failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setUploading(false);
        }
    };

    const handleChat = async (e) => {
        e.preventDefault();
        if (!currentQuestion.trim() || isThinking) return;

        const userMsg = { role: 'user', content: currentQuestion };
        setChatMessages(prev => [...prev, userMsg]);
        setCurrentQuestion('');
        setIsThinking(true);

        try {
            const contextIds = selectedMaterials.length > 0 ? selectedMaterials : materials.map(m => m.id);
            const res = await materialService.chatCombined(contextIds, userMsg.content);
            setChatMessages(prev => [...prev, { role: 'ai', content: res.data.data.result }]);
        } catch (err) {
            alert('AI error');
            setChatMessages(prev => [...prev, { role: 'ai', content: "Error: AI engine unreachable." }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleGenerate = async () => {
        if (selectedMaterials.length === 0) {
            alert('Select at least one material.');
            return;
        }
        setIsGenerating(true);
        setGenResult('');
        try {
            const res = await materialService.generateCombined(selectedMaterials, genType);
            setGenResult(res.data.data.result);
            alert('Study material generated!');
        } catch (err) {
            alert('Generation failed.');
        } finally {
            setIsGenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <span className="text-gray-500">Loading subject details...</span>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            <Link to="/dashboard" className="text-blue-600 hover:underline mb-4 inline-block">
                &larr; Back to Dashboard
            </Link>

            <header className="mb-6 p-6 border border-gray-200 bg-white rounded">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold mb-2">{subject?.name}</h1>
                        <p className="text-gray-600">{subject?.description || 'Your specialized learning workspace.'}</p>
                    </div>
                    <div className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded">
                        {materials.length} Resources
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <ResourceLibrary
                        materials={materials}
                        selectedMaterials={selectedMaterials}
                        toggleSelection={(mid) => setSelectedMaterials(prev => prev.includes(mid) ? prev.filter(id => id !== mid) : [...prev, mid])}
                    />

                    <StudyGenerator
                        genType={genType}
                        setGenType={setGenType}
                        handleGenerate={handleGenerate}
                        isGenerating={isGenerating}
                        selectedCount={selectedMaterials.length}
                        genResult={genResult}
                        setGenResult={setGenResult}
                    />
                </div>

                <div className="lg:col-span-3 space-y-6">
                    <section className="bg-white p-6 border border-gray-200 rounded">
                        <h3 className="text-lg font-bold mb-4">Upload Document</h3>
                        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-4">
                                <div>
                                    <label className="input-label">Title (Optional)</label>
                                    <input
                                        type="text"
                                        className="input-field text-sm"
                                        placeholder="e.g. Chapter 1 Notes"
                                        value={newUploadTitle}
                                        onChange={(e) => setNewUploadTitle(e.target.value)}
                                        disabled={uploading}
                                    />
                                </div>
                                <div>
                                    <label className="input-label">PDF File</label>
                                    <input
                                        type="file"
                                        accept=".pdf,application/pdf"
                                        className="input-field text-sm"
                                        onChange={(e) => setUploadFile(e.target.files[0])}
                                        disabled={uploading}
                                    />
                                </div>
                            </div>
                            <div className="space-y-4 flex flex-col">
                                <div className="flex-1">
                                    <label className="input-label">Text Content (Optional if PDF provided)</label>
                                    <textarea
                                        className="input-field text-sm h-[114px] resize-none"
                                        placeholder="Paste notes, raw text, or summaries here..."
                                        value={newUploadContent}
                                        onChange={(e) => setNewUploadContent(e.target.value)}
                                        disabled={uploading}
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-2 flex justify-end mt-2">
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="btn-primary w-full md:w-auto"
                                >
                                    {uploading ? 'Processing with AI...' : 'Upload to Subject'}
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className="bg-white border border-gray-200 rounded">
                        <AITutor
                            messages={chatMessages}
                            currentQuestion={currentQuestion}
                            setCurrentQuestion={setCurrentQuestion}
                            handleChat={handleChat}
                            handleVoiceInput={() => listen((transcript) => setCurrentQuestion(transcript))}
                            handleTTS={speak}
                            isThinking={isThinking}
                            isListening={isListening}
                            chatEndRef={chatEndRef}
                            contextInfo={selectedMaterials.length > 0 ? "Grounded in selected context" : "Using all subject data"}
                        />
                    </section>
                </div>
            </div>
        </div>
    );
};

export default SubjectDetail;

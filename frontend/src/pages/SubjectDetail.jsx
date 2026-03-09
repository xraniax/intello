import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { subjectService, materialService } from '../services/api';
import {
    Book, Loader2, ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSpeech } from '../hooks/useSpeech';

// Subcomponents
import ResourceLibrary from '../components/Subject/ResourceLibrary';
import AITutor from '../components/Subject/AITutor';
import StudyGenerator from '../components/Subject/StudyGenerator';

const SubjectDetail = () => {
    const { id } = useParams();
    const [subject, setSubject] = useState(null);
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);

    // AI Suite State
    const [selectedMaterials, setSelectedMaterials] = useState([]);
    const [activeTab, setActiveTab] = useState('resources'); // resources, chat, generator

    // Upload State
    const [uploading, setUploading] = useState(false);
    const [newUploadTitle, setNewUploadTitle] = useState('');
    const [newUploadContent, setNewUploadContent] = useState('');

    // Chat State
    const [chatMessages, setChatMessages] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const chatEndRef = useRef(null);

    // Generator State
    const [genType, setGenType] = useState('summary');
    const [isGenerating, setIsGenerating] = useState(false);
    const [genResult, setGenResult] = useState('');

    // Hooks
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
            toast.error('Failed to fetch subject details');
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!newUploadContent.trim()) return;
        setUploading(true);
        try {
            await materialService.upload({
                title: newUploadTitle || 'New Resource',
                content: newUploadContent,
                type: 'note',
                subjectId: id
            });
            setNewUploadTitle('');
            setNewUploadContent('');
            toast.success('Material uploaded and processing...');
            await fetchDetails();
        } catch (err) {
            toast.error('Upload failed');
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
            toast.error('AI error');
            setChatMessages(prev => [...prev, { role: 'ai', content: "Error: AI engine unreachable." }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleGenerate = async () => {
        if (selectedMaterials.length === 0) {
            toast.error('Select at least one material.');
            return;
        }
        setIsGenerating(true);
        setGenResult('');
        try {
            const res = await materialService.generateCombined(selectedMaterials, genType);
            setGenResult(res.data.data.result);
            toast.success('Study material generated!');
        } catch (err) {
            toast.error('Generation failed.');
        } finally {
            setIsGenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-slate-950">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl animate-fade-in text-slate-100 min-h-screen">
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors">
                <ArrowLeft size={18} />
                Back to Dashboard
            </Link>

            <header className="glass-card mb-8 border-l-4 border-l-primary relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Book size={120} />
                </div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter mb-2">{subject?.name}</h1>
                        <p className="text-slate-400 max-w-2xl">{subject?.description || 'Your specialized learning workspace.'}</p>
                    </div>
                    <div className="flex gap-2">
                        <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest text-slate-500">
                            {materials.length} Resources
                        </span>
                        <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                            AI Active
                        </span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-4 space-y-6">
                    <ResourceLibrary
                        materials={materials}
                        selectedMaterials={selectedMaterials}
                        toggleSelection={(id) => setSelectedMaterials(prev => prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id])}
                        handleUpload={handleUpload}
                        uploadState={{
                            uploading,
                            title: newUploadTitle,
                            setTitle: setNewUploadTitle,
                            content: newUploadContent,
                            setContent: setNewUploadContent
                        }}
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

                <div className="lg:col-span-8">
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
                </div>
            </div>
        </div>
    );
};

export default SubjectDetail;

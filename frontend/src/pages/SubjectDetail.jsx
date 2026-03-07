import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { subjectService, materialService } from '../services/api';
import {
    Book, FileText, ChevronRight, ArrowLeft, Loader2,
    MessageSquare, Sparkles, Send, Mic, Volume2,
    Upload as UploadIcon, CheckSquare, Square, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SubjectDetail = () => {
    const { id } = useParams();
    const [subject, setSubject] = useState(null);
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [activeTab, setActiveTab] = useState('resources'); // 'resources', 'chat', 'generator'
    const [selectedMaterials, setSelectedMaterials] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [newUploadTitle, setNewUploadTitle] = useState('');
    const [newUploadContent, setNewUploadContent] = useState('');

    // AI Chat State
    const [chatMessages, setChatMessages] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const chatEndRef = useRef(null);

    // Generator State
    const [genType, setGenType] = useState('summary');
    const [isGenerating, setIsGenerating] = useState(false);
    const [genResult, setGenResult] = useState('');

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
            console.error('Failed to fetch subject details', err);
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
            await fetchDetails();
        } catch (err) {
            alert('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const toggleMaterialSelection = (materialId) => {
        setSelectedMaterials(prev =>
            prev.includes(materialId)
                ? prev.filter(mid => mid !== materialId)
                : [...prev, materialId]
        );
    };

    const handleChat = async (e) => {
        e.preventDefault();
        if (!currentQuestion.trim() || isThinking) return;

        const userMsg = { role: 'user', content: currentQuestion };
        setChatMessages(prev => [...prev, userMsg]);
        setCurrentQuestion('');
        setIsThinking(true);

        try {
            // Use active materials as context if selected, otherwise use all in subject
            const contextIds = selectedMaterials.length > 0
                ? selectedMaterials
                : materials.map(m => m.id);

            const res = await materialService.chatCombined(contextIds, userMsg.content);
            setChatMessages(prev => [...prev, { role: 'ai', content: res.data.data.result }]);
        } catch (err) {
            setChatMessages(prev => [...prev, { role: 'ai', content: "Error: AI engine unreachable." }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleVoiceInput = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Browser does not support voice recognition.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setCurrentQuestion(transcript);
        };
        recognition.start();
    };

    const handleTTS = (text) => {
        const speech = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(speech);
    };

    const handleGenerate = async () => {
        if (selectedMaterials.length === 0) {
            alert("Please select at least one material to generate study tools.");
            return;
        }
        setIsGenerating(true);
        setGenResult('');
        try {
            const res = await materialService.generateCombined(selectedMaterials, genType);
            setGenResult(res.data.data.result);
            setActiveTab('resources'); // Show the results area or staying on generator
        } catch (err) {
            alert("Generation failed.");
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

            {/* Header */}
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

            {/* Main Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* Left Column: Resource Library (Col 4) */}
                <div className="lg:col-span-4 space-y-6">
                    <section className="glass-card">
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-4 flex justify-between items-center">
                            Library
                            <span className="text-[10px] text-primary">{selectedMaterials.length} Selected</span>
                        </h3>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                            {materials.length === 0 ? (
                                <p className="text-slate-500 italic text-sm text-center py-8">Library is empty.</p>
                            ) : (
                                materials.map((m) => (
                                    <div
                                        key={m.id}
                                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${selectedMaterials.includes(m.id)
                                                ? 'bg-primary/10 border-primary/40 shadow-lg shadow-primary/5'
                                                : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                                            }`}
                                        onClick={() => toggleMaterialSelection(m.id)}
                                    >
                                        <div className={selectedMaterials.includes(m.id) ? 'text-primary' : 'text-slate-600'}>
                                            {selectedMaterials.includes(m.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-bold truncate">{m.title}</h4>
                                            <p className="text-[10px] text-slate-500 capitalize">{m.type}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-800/50">
                            <form onSubmit={handleUpload} className="space-y-3">
                                <input
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-2 text-xs focus:border-primary outline-none transition-colors"
                                    placeholder="Resource Title..."
                                    value={newUploadTitle}
                                    onChange={(e) => setNewUploadTitle(e.target.value)}
                                />
                                <textarea
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-xs focus:border-primary outline-none transition-colors min-h-[100px] resize-none"
                                    placeholder="Paste notes, text, or content..."
                                    value={newUploadContent}
                                    onChange={(e) => setNewUploadContent(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="w-full btn-modern-primary !py-2 !text-xs"
                                >
                                    {uploading ? <Loader2 className="animate-spin" size={14} /> : <><UploadIcon size={14} /> Add to Library</>}
                                </button>
                            </form>
                        </div>
                    </section>

                    <section className="glass-card bg-slate-950/20">
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-4">Study Generator</h3>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {['summary', 'quiz', 'notes', 'flashcards'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setGenType(type)}
                                    className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${genType === type ? 'bg-secondary text-slate-900' : 'bg-slate-800 text-slate-400'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || selectedMaterials.length === 0}
                            className="w-full bg-gradient-to-r from-secondary/80 to-primary/80 hover:from-secondary hover:to-primary text-slate-900 font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/10 flex items-center justify-center gap-2 group"
                        >
                            {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <><Sparkles size={18} className="group-hover:animate-pulse" /> Generate Tools</>}
                        </button>
                        {selectedMaterials.length === 0 && (
                            <span className="text-[10px] text-slate-500 mt-2 block text-center italic">Select files to use as context</span>
                        )}
                    </section>
                </div>

                {/* Right Column: AI Suite (Col 8) */}
                <div className="lg:col-span-8 space-y-8">

                    {/* Chat Area */}
                    <div className="glass-card bg-slate-900/30 flex flex-col h-[600px] border-slate-800/80 shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-800/50 bg-slate-900/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <h3 className="text-xs font-black uppercase tracking-widest">AI Subject Tutor</h3>
                            </div>
                            <span className="text-[10px] text-slate-500 italic">
                                {selectedMaterials.length > 0 ? "Grounded in selected context" : "Using all subject data"}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {chatMessages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                                    <MessageSquare size={48} className="mb-4" />
                                    <p className="max-w-xs text-sm">Ask me anything about these resources. Dictate your question or type below.</p>
                                </div>
                            )}

                            {chatMessages.map((msg, i) => (
                                <motion.div
                                    initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    key={i}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`relative max-w-[80%] p-4 rounded-2xl text-sm ${msg.role === 'user'
                                            ? 'bg-primary text-white ml-12 rounded-tr-none'
                                            : 'bg-slate-800 text-slate-100 mr-12 rounded-tl-none border border-slate-700/50'
                                        }`}>
                                        {msg.content}
                                        {msg.role === 'ai' && (
                                            <button
                                                onClick={() => handleTTS(msg.content)}
                                                className="absolute -bottom-6 right-0 text-slate-500 hover:text-secondary transition-colors"
                                                title="Read AI response"
                                            >
                                                <Volume2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            {isThinking && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-800/50 p-4 rounded-2xl rounded-tl-none flex gap-2">
                                        <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" />
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Generation Result Overlay (if exists) */}
                        <AnimatePresence>
                            {genResult && (
                                <motion.div
                                    initial={{ y: 50, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 50, opacity: 0 }}
                                    className="absolute inset-x-4 bottom-24 p-6 glass-card bg-slate-950 border-secondary/50 shadow-2xl z-20 max-h-[70%] overflow-y-auto"
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-black text-secondary uppercase tracking-widest text-xs flex items-center gap-2">
                                            <Sparkles size={14} /> Generated Result
                                        </h4>
                                        <button onClick={() => setGenResult('')} className="text-slate-500 hover:text-white">&times;</button>
                                    </div>
                                    <div className="text-sm leading-relaxed whitespace-pre-wrap text-slate-200">
                                        {genResult}
                                    </div>
                                    <div className="mt-6 flex justify-end">
                                        <button className="btn-modern-secondary !py-2 !text-xs flex items-center gap-2">
                                            <Download size={14} /> Export Note
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="p-4 bg-slate-900/80 border-t border-slate-800/50">
                            <form onSubmit={handleChat} className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleVoiceInput}
                                    className={`p-3 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-secondary'}`}
                                >
                                    <Mic size={20} />
                                </button>
                                <input
                                    className="flex-1 bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition-colors"
                                    placeholder="Ask about your selected resources..."
                                    value={currentQuestion}
                                    onChange={(e) => setCurrentQuestion(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    disabled={isThinking || !currentQuestion.trim()}
                                    className="bg-primary hover:bg-primary-dark text-white p-3 rounded-xl transition-all disabled:opacity-50"
                                >
                                    <Send size={20} />
                                </button>
                            </form>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default SubjectDetail;

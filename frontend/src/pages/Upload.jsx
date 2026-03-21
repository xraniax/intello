import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { materialService, subjectService } from '../services/api';

const UploadPage = () => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [file, setFile] = useState(null);
    const [fileError, setFileError] = useState('');
    const [type, setType] = useState('summary');
    const [subjectId, setSubjectId] = useState('');
    const [subjects, setSubjects] = useState([]);
    const [sending, setSending] = useState(false);
    const [success, setSuccess] = useState(false);
    const [err, setErr] = useState('');
    const [validationErrors, setValidationErrors] = useState({});

    // Client-side PDF validation (mirrors backend constraints)
    const MAX_FILE_SIZE_MB = 10;
    const validatePdfFile = (selectedFile) => {
        if (!selectedFile) return null;
        const ext = selectedFile.name.split('.').pop().toLowerCase();
        if (ext !== 'pdf' || selectedFile.type !== 'application/pdf') {
            return 'Only .pdf files are accepted.';
        }
        if (selectedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            return `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`;
        }
        return null; // valid
    };

    const handleFileChange = (e) => {
        const selected = e.target.files[0] || null;
        const error = validatePdfFile(selected);
        setFileError(error || '');
        setFile(error ? null : selected);
    };

    const navigate = useNavigate();

    useEffect(() => {
        const fetchSubjects = async () => {
            try {
                const res = await subjectService.getAll();
                setSubjects(res.data.data);
            } catch (err) {
                console.error('Failed to fetch subjects', err);
            }
        };
        fetchSubjects();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setValidationErrors({});

        // Re-run validation before submit in case state is stale
        if (file) {
            const error = validatePdfFile(file);
            if (error) { setFileError(error); return; }
        }

        if (!content.trim() && !file) {
            setErr('Please provide either text content or upload a PDF file.');
            return;
        }

        setSending(true);
        setErr('');

        console.log('[UploadPage] handleSubmit - subjectId:', subjectId);
        console.log('[UploadPage] handleSubmit - title:', title);

        try {
            const finalTitle = title.trim() || (file ? file.name : 'Untitled Document');
            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('title', finalTitle);
                formData.append('content', content);
                formData.append('type', 'upload'); 
                if (subjectId) formData.append('subjectId', subjectId);

                console.log('[UploadPage] Sending FormData with subjectId:', subjectId);
                await materialService.upload(formData);
            } else {
                console.log('[UploadPage] Sending JSON with subjectId:', subjectId);
                await materialService.upload({
                    title: finalTitle,
                    content,
                    type: 'upload',
                    subjectId: subjectId || undefined
                });
            }
            setSuccess(true);
            setTimeout(() => navigate('/history'), 2000);
        } catch (error) {
            if (error.code === 'VALIDATION_ERROR') {
                setValidationErrors(error.validationErrors || {});
                setErr('Please review the highlighted fields below.');
            } else {
                setErr(error.message || 'Failed to upload document');
            }
        } finally {
            setSending(false);
        }
    };

    if (success) {
        return (
            <div className="max-w-2xl mx-auto mt-12 p-8 border border-green-100 bg-green-50 shadow-sm text-center rounded-xl">
                <h2 className="text-2xl font-bold text-green-800 mb-3">Document Uploaded Successfully!</h2>
                <p className="text-green-600 font-medium">The AI engine is processing your content. Redirecting to workspace history...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 md:p-10 animate-in fade-in duration-700">
            <div className="mb-12">
                <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-2">Grow Your Knowledge</h1>
                <p className="text-gray-500 font-medium text-lg">Upload your source documents and let AI cultivate study materials for you.</p>
            </div>

            <div className="card-minimal border-indigo-50/50">
                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Section 1: Identity */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Document Title</label>
                            <input
                                type="text"
                                className={`input-field ${validationErrors.title ? 'border-red-400 ring-4 ring-red-50' : ''}`}
                                placeholder="e.g. Quantum Physics 101"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                            {validationErrors.title && (
                                <p className="text-red-500 text-xs mt-2 ml-1 font-medium">{validationErrors.title}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Subject Garden</label>
                            <div className="relative group">
                                <select
                                    className={`input-field bg-white pr-10 appearance-none cursor-pointer ${validationErrors.subjectId ? 'border-red-400 ring-4 ring-red-50' : ''}`}
                                    value={subjectId}
                                    onChange={(e) => setSubjectId(e.target.value)}
                                >
                                    <option value="">Quick Import (No Subject)</option>
                                    {subjects.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-indigo-500 transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            {validationErrors.subjectId && (
                                <p className="text-red-500 text-xs mt-2 ml-1 font-medium">{validationErrors.subjectId}</p>
                            )}
                        </div>
                    </div>

                    {/* Section 2: Source Selection */}
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">Upload PDF Source</label>
                            <label 
                                htmlFor="pdf-upload" 
                                className={`upload-zone ${file ? 'upload-zone--has-file' : ''} ${fileError ? 'border-red-300 bg-red-50/50' : ''}`}
                            >
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all ${file ? 'bg-green-100 text-green-600' : 'bg-indigo-50 text-indigo-500'}`}>
                                    {file ? (
                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                    )}
                                </div>
                                <span className="text-lg font-bold text-gray-900 mb-1">
                                    {file ? file.name : 'Click to select or drag PDF'}
                                </span>
                                <span className="text-gray-500 text-sm font-medium">
                                    {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'PDF files only, up to 10MB'}
                                </span>
                                <input
                                    id="pdf-upload"
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </label>
                            {fileError && (
                                <p className="text-red-500 text-xs mt-2 ml-1 font-medium flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {fileError}
                                </p>
                            )}
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-100"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase tracking-widest text-gray-300 font-bold">
                                <span className="bg-white px-4">OR PASTE TEXT</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Content Editor</label>
                            <textarea
                                className={`input-field font-medium text-sm min-h-[200px] leading-relaxed py-4 transition-all focus:min-h-[300px] ${validationErrors.content ? 'border-red-400 ring-4 ring-red-50' : ''}`}
                                placeholder="Paste your transcripts, lecture notes, or research papers here..."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                            ></textarea>
                            {validationErrors.content && (
                                <p className="text-red-500 text-xs mt-2 ml-1 font-medium">{validationErrors.content}</p>
                            )}
                        </div>
                    </div>

                    {err && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-semibold border border-red-100 flex items-center gap-2 animate-in slide-in-from-left-4">
                            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {err}
                        </div>
                    )}

                    <div className="pt-10 border-t border-gray-50 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
                        <button 
                            type="button" 
                            onClick={() => navigate(-1)} 
                            className="text-gray-400 hover:text-gray-600 font-bold text-sm uppercase tracking-widest transition-colors px-6 py-2"
                        >
                            Discard
                        </button>
                        <button 
                            type="submit" 
                            className="btn-vibrant w-full sm:w-auto px-12 py-4 text-base" 
                            disabled={sending}
                        >
                            {sending ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Processing...
                                </div>
                            ) : 'Grow Document'}
                        </button>
                    </div>
                </form>
            </div>

            <p className="mt-12 text-xs text-gray-400 font-bold uppercase tracking-widest text-center">
                Cultivate Clarity &bull; Seed Success
            </p>
        </div>
    );
};

export default UploadPage;

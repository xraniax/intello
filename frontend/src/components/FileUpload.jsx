import React, { useState, useEffect } from 'react';
import { useMaterialStore } from '@/store/useMaterialStore';
import { useUIStore } from '@/store/useUIStore';
import { useSubjectStore } from '@/store/useSubjectStore';
import { subjectService } from '@/features/subjects/services/SubjectService';
import { Cloud, X, AlertCircle, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { validateRequired } from '@/utils/validators';

const FileUpload = ({ subjectId: initialSubjectId, onSuccess, onCancel, inline = false }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [file, setFile] = useState(null);
    const [fileError, setFileError] = useState('');
    const [isTouched, setIsTouched] = useState(false);
    const [titleError, setTitleError] = useState('');
    const [subjectId, setSubjectId] = useState(initialSubjectId || '');
    const [validationErrors, setValidationErrors] = useState({});
    const [systemLimits, setSystemLimits] = useState({ 
        max_file_size_mb: 10, 
        allowed_types: ['application/pdf'] 
    });

    const uploadMaterial = useMaterialStore((state) => state.actions.uploadMaterial);
    const uploading = useUIStore((state) => !!state.data.loadingStates['upload']?.loading);
    const uiError = useUIStore(state => state.data.errors['upload']);
    const subjects = useSubjectStore((state) => state.data.subjects);
    const fetchSubjects = useSubjectStore((state) => state.actions.fetchSubjects);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settingsRes = await subjectService.getSettings();
                if (settingsRes.data?.data) {
                    setSystemLimits(settingsRes.data.data);
                }
            } catch (err) {
                console.warn('Failed to fetch settings', err);
            }
        };
        loadSettings();
        if (!initialSubjectId && subjects.length === 0) {
            fetchSubjects();
        }
    }, [initialSubjectId, subjects.length, fetchSubjects]);

    const handleFileChange = (e) => {
        if (uploading) return;
        const selected = e.target.files[0] || null;
        if (!selected) return;

        const ext = selected.name.split('.').pop().toLowerCase();
        const isMimeAllowed = systemLimits.allowed_types.includes(selected.type);
        const isPdfFallback = ext === 'pdf' && systemLimits.allowed_types.includes('application/pdf');

        if (!isMimeAllowed && !isPdfFallback) {
            setFileError(`Only ${systemLimits.allowed_types.join(', ')} files are accepted.`);
            setFile(null);
            return;
        }

        if (selected.size > systemLimits.max_file_size_mb * 1024 * 1024) {
            setFileError(`File is too large. Maximum size is ${systemLimits.max_file_size_mb} MB.`);
            setFile(null);
            return;
        }

        setFileError('');
        setFile(selected);
        if (!title) {
            const newTitle = selected.name.replace(`.${ext}`, '');
            setTitle(newTitle);
            if (isTouched) runValidation(newTitle);
        }
    };

    const runValidation = (value) => {
        const result = validateRequired(value, 'Title');
        setTitleError(result.valid ? '' : result.message);
        return result.valid;
    };

    const validate = () => {
        const errors = {};
        const titleValid = runValidation(title);
        
        if (!titleValid) errors.title = titleError || 'Title is required';
        if (!file && !content.trim()) {
            errors.content = 'Document content or PDF is required';
        }
        
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsTouched(true);
        if (!validate()) return;

        try {
            const payload = file ? new FormData() : {};
            const finalTitle = title.trim();

            if (file) {
                payload.append('file', file);
                payload.append('title', finalTitle);
                payload.append('content', content);
                payload.append('type', 'upload');
                if (subjectId) payload.append('subjectId', subjectId);
            } else {
                Object.assign(payload, {
                    title: finalTitle,
                    content,
                    type: 'upload',
                    subjectId: subjectId || undefined
                });
            }

            await uploadMaterial(payload);
            if (onSuccess) onSuccess();
        } catch (err) {
            if (err.fieldErrors) {
                setValidationErrors(err.fieldErrors);
                if (err.fieldErrors.title) setTitleError(err.fieldErrors.title);
            }
        }
    };

    const titleErrorVisible = (isTouched && titleError) || validationErrors.title;

    return (
        <form onSubmit={handleSubmit} className={`space-y-6 ${inline ? '' : 'animate-in fade-in duration-500'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Document Title</label>
                    <input
                        type="text"
                        placeholder="e.g. Machine Learning Basics"
                        className={`input-field text-sm ${titleErrorVisible ? 'border-red-400 ring-4 ring-red-50' : ''}`}
                        value={title}
                        onChange={(e) => {
                            setTitle(e.target.value);
                            if (isTouched) runValidation(e.target.value);
                            if (validationErrors.title) setValidationErrors(prev => ({ ...prev, title: '' }));
                        }}
                        onBlur={() => {
                            setIsTouched(true);
                            runValidation(title);
                        }}
                    />
                    {titleErrorVisible && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">{titleError || validationErrors.title}</p>}
                </div>
                {!initialSubjectId && (
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Subject Garden</label>
                        <select
                            className="input-field text-sm bg-white"
                            value={subjectId}
                            onChange={(e) => setSubjectId(e.target.value)}
                        >
                            <option value="">Quick Import (No Subject)</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {uiError && !titleErrorVisible && !validationErrors.content && (
                <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-xs font-bold animate-in slide-in-from-top-2">
                    {uiError}
                </div>
            )}

            <div className="space-y-4">
                <div className="relative group">
                    <input
                        id="file-input"
                        type="file"
                        className="hidden"
                        accept={systemLimits.allowed_types.join(',')}
                        onChange={handleFileChange}
                        disabled={uploading}
                    />
                    <label
                        htmlFor="file-input"
                        className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl transition-all cursor-pointer ${uploading ? 'cursor-not-allowed opacity-60' : ''} ${file ? 'bg-indigo-50/30 border-indigo-200' : 'bg-gray-50/50 border-gray-200 hover:border-indigo-400 hover:bg-white'}`}
                    >
                        {file ? (
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-500 mb-3 border border-indigo-100">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-bold text-gray-900 mb-1">{file.name}</span>
                                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                                    {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready
                                </span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-400 mb-3 border border-gray-100 group-hover:text-indigo-500 group-hover:scale-110 transition-all">
                                    <Cloud className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-bold text-gray-700">Drop file here or click to browse</span>
                                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-1">Up to {systemLimits.max_file_size_mb}MB</span>
                            </div>
                        )}
                    </label>
                    {file && !uploading && (
                        <button
                            type="button"
                            onClick={() => {
                                setFile(null);
                                setFileError('');
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-white border border-gray-100 rounded-lg text-gray-400 hover:text-red-500 hover:border-red-100 shadow-sm transition-all"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {fileError && (
                    <div className="flex items-center gap-2 text-red-500 text-xs font-bold px-2 animate-in slide-in-from-top-2">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {fileError}
                    </div>
                )}

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-100"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
                        <span className="bg-white px-4">Or Paste text</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <textarea
                        className={`input-field min-h-[120px] text-sm py-3 leading-relaxed ${validationErrors.content ? 'border-red-400 ring-4 ring-red-50' : ''}`}
                        placeholder="Paste lecture notes, articles, or research content..."
                        value={content}
                        onChange={(e) => {
                            setContent(e.target.value);
                            if (validationErrors.content) setValidationErrors(prev => ({ ...prev, content: '' }));
                        }}
                    ></textarea>
                    {validationErrors.content && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">{validationErrors.content}</p>}
                </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors px-6"
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="submit"
                    className="btn-vibrant w-full sm:w-auto px-10 py-3.5 text-sm flex items-center justify-center gap-2"
                    disabled={uploading}
                >
                    {uploading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <CheckCircle2 className="w-4 h-4" />
                            Seed Document
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};

export default FileUpload;

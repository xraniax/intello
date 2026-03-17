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

        try {
            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('title', title);
                formData.append('content', content);
                formData.append('type', 'upload'); // Terminology cleanup: source is 'upload'
                if (subjectId) formData.append('subjectId', subjectId);

                await materialService.upload(formData);
            } else {
                await materialService.upload({
                    title,
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
        <div className="max-w-3xl mx-auto p-4 md:p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Upload Source Document</h1>
                <p className="text-gray-500 mt-2">Provide a PDF or text context to generate study materials.</p>
            </div>

            <div className="border border-gray-100 p-8 rounded-xl bg-white shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="input-label">Title</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="e.g. Introduction to Neural Networks"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        {validationErrors.title && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors.title}</p>
                        )}
                    </div>

                    <div>
                        <label className="input-label">Subject Folder</label>
                        <select
                            className="input-field bg-white"
                            value={subjectId}
                            onChange={(e) => setSubjectId(e.target.value)}
                        >
                            <option value="">Quick Upload (Imported Materials)</option>
                            {subjects.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        {validationErrors.subjectId && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors.subjectId}</p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="pdf-upload" className="input-label">Upload PDF file (optional)</label>
                        <input
                            id="pdf-upload"
                            type="file"
                            accept=".pdf,application/pdf"
                            className="input-field"
                            onChange={handleFileChange}
                        />
                        {fileError && (
                            <p className="text-red-600 text-xs mt-1">{fileError}</p>
                        )}
                        {validationErrors.file && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors.file}</p>
                        )}
                    </div>

                    <div>
                        <label className="input-label">Content Text (optional if file provided)</label>
                        <textarea
                            className="input-field font-mono text-sm"
                            rows="10"
                            placeholder="Paste your course content here..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        ></textarea>
                        {validationErrors.content && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors.content}</p>
                        )}
                    </div>

                    {err && <div className="text-red-600 bg-red-50 p-3 rounded text-sm mb-4">{err}</div>}

                    <div className="pt-6 border-t border-gray-100 mt-4 flex items-center justify-between">
                        <button type="button" onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors">
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={sending}>
                            {sending ? 'Processing Document...' : 'Upload Document'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UploadPage;

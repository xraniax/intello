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
                formData.append('type', type);
                if (subjectId) formData.append('subjectId', subjectId);

                await materialService.upload(formData);
            } else {
                await materialService.upload({
                    title,
                    content,
                    type,
                    subjectId: subjectId || undefined
                });
            }
            setSuccess(true);
            setTimeout(() => navigate('/history'), 2000);
        } catch (error) {
            setErr(error.response?.data?.message || 'Failed to upload material');
        } finally {
            setSending(false);
        }
    };

    if (success) {
        return (
            <div className="max-w-2xl mx-auto mt-10 p-8 border border-green-200 bg-green-50 text-center rounded">
                <h2 className="text-xl font-bold text-green-700 mb-2">Material Uploaded Successfully!</h2>
                <p className="text-green-600">The AI engine is processing your content. Redirecting you to history...</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Upload Material</h1>
                <p className="text-gray-600">Provide a PDF file or text content for AI processing.</p>
            </div>

            <div className="border border-gray-200 p-6 rounded bg-white">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="input-label">Title</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="e.g. Introduction to Neural Networks"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
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
                    </div>

                    <div>
                        <label className="input-label">AI Task</label>
                        <select
                            className="input-field bg-white"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                        >
                            <option value="summary">Generate Summary</option>
                            <option value="quiz">Generate Quiz</option>
                            <option value="note">Generate Notes</option>
                        </select>
                    </div>

                    <div>
                        <label className="input-label">Upload PDF file (optional)</label>
                        <input
                            type="file"
                            accept=".pdf,application/pdf"
                            className="input-field"
                            onChange={handleFileChange}
                        />
                        {fileError && (
                            <p className="text-red-600 text-xs mt-1">{fileError}</p>
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
                    </div>

                    {err && <div className="text-red-600 bg-red-50 p-3 rounded text-sm">{err}</div>}

                    <div className="pt-2 border-t border-gray-200">
                        <button type="submit" className="btn-primary flex ml-auto" disabled={sending}>
                            {sending ? 'Processing with AI...' : 'Submit Material'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UploadPage;

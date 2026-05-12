import React, { useState, useEffect } from 'react';
import { useMaterialStore } from '@/store/useMaterialStore';
import { useUIStore } from '@/store/useUIStore';
import { useSubjectStore } from '@/store/useSubjectStore';
import { MaterialService } from '@/services/MaterialService';
import {
  Cloud,
  X,
  AlertCircle,
  FileText,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  Eye,
  RotateCcw,
  Copy,
} from 'lucide-react';
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
  const [imagePreview, setImagePreview] = useState(null);
  const [collision, setCollision] = useState(null); // { materialId, title, type: 'active' | 'trash' }
  const [isRestoring, setIsRestoring] = useState(false);
  const [isUploadingNew, setIsUploadingNew] = useState(false);
  const [systemLimits, setSystemLimits] = useState({
    max_file_size_mb: 10,
    allowed_types: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
  });

  const uploadMaterial = useMaterialStore((state) => state.actions.uploadMaterial);
  const uploading = useUIStore((state) => !!state.data.loadingStates['upload']?.loading);
  const uiError = useUIStore((state) => state.data.errors['upload']);
  const subjects = useSubjectStore((state) => state.data.subjects);
  const fetchSubjects = useSubjectStore((state) => state.actions.fetchSubjects);

  useEffect(() => {
    if (subjects.length === 0) {
      fetchSubjects().catch(() => {});
    }
  }, [fetchSubjects, subjects.length]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    const ext = selected.name.split('.').pop();
    if (!systemLimits.allowed_types.includes(selected.type) && ext !== 'pdf') {
      setFileError(`Unsupported file type: ${ext}`);
      return;
    }

    if (selected.size > systemLimits.max_file_size_mb * 1024 * 1024) {
      setFileError(`File too large: Max ${systemLimits.max_file_size_mb}MB`);
      return;
    }

    setFile(selected);
    setFileError('');

    if (selected.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target.result);
      reader.readAsDataURL(selected);
    } else {
      setImagePreview(null);
    }

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

  const titleErrorVisible = (isTouched && titleError) || validationErrors.title;
  const isPending = uploading || isRestoring || isUploadingNew;

  const handleRestore = async () => {
    if (!collision || isPending) return;
    setIsRestoring(true);
    try {
      await MaterialService.restore(collision.materialId);
      const toast = (await import('react-hot-toast')).default;
      toast.success('Document restored from trash!');
      if (onSuccess) onSuccess({ id: collision.materialId, title: collision.title });
    } catch {
      const toast = (await import('react-hot-toast')).default;
      toast.error('Failed to restore document');
    } finally {
      setIsRestoring(false);
      setCollision(null);
    }
  };

  const handleViewExisting = () => {
    if (!collision) return;
    window.dispatchEvent(
      new CustomEvent('open-material', {
        detail: { id: collision.materialId, type: 'upload' },
      })
    );
    if (onCancel) onCancel();
  };

  const handleUploadAsDuplicate = async () => {
    if (!collision || isPending) return;
    setIsUploadingNew(true);
    try {
      const payload = file ? new FormData() : {};
      const finalTitle = title.trim();

      if (file) {
        payload.append('file', file);
        payload.append('title', finalTitle);
        payload.append('content', content);
        payload.append('type', 'upload');
        payload.append('conflictResolution', 'duplicate');
        if (subjectId) payload.append('subjectId', subjectId);
      } else {
        Object.assign(payload, {
          title: finalTitle,
          content,
          type: 'upload',
          conflictResolution: 'duplicate',
          subjectId: subjectId || undefined,
        });
      }

      const material = await uploadMaterial(payload);
      if (onSuccess) onSuccess(material);
    } catch (err) {
      const toast = (await import('react-hot-toast')).default;
      toast.error(err.message || 'Failed to upload duplicate');
    } finally {
      setIsUploadingNew(false);
      setCollision(null);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsTouched(true);

    const titleIsValid = runValidation(title);
    if (!titleIsValid || (!file && !content.trim())) {
      if (!file && !content.trim())
        setValidationErrors((prev) => ({
          ...prev,
          content: 'Please upload a file or paste content',
        }));
      return;
    }

    setCollision(null);

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
          subjectId: subjectId || undefined,
        });
      }

      const material = await uploadMaterial(payload);
      if (onSuccess) onSuccess(material);
    } catch (err) {
      const errData = err.data || {};
      const errCode = err.code;

      if (errCode === 'ACTIVE_DUPLICATE_MATERIAL') {
        setCollision({
          materialId: errData.materialId,
          title: errData.title || title,
          type: 'active',
          materialType: errData.type || null,
        });
      } else if (errCode === 'TRASH_DUPLICATE_MATERIAL') {
        setCollision({
          materialId: errData.materialId,
          title: errData.title || title,
          type: 'trash',
          materialType: errData.type || null,
        });
      } else {
        const errorMsg = err.message || 'Failed to seed document';
        const toast = (await import('react-hot-toast')).default;
        toast.error(errorMsg);
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-6 ${inline ? '' : 'animate-in fade-in duration-500'}`}
    >
      {!collision ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
            Document Title
          </label>
          <input
            type="text"
            placeholder="e.g. Machine Learning Basics"
            className={`input-field text-sm ${titleErrorVisible ? 'border-red-400 ring-4 ring-red-50' : ''}`}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (isTouched) runValidation(e.target.value);
              if (validationErrors.title) setValidationErrors((prev) => ({ ...prev, title: '' }));
            }}
            onBlur={() => {
              setIsTouched(true);
              runValidation(title);
            }}
            disabled={isPending}
          />
          {titleErrorVisible && (
            <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">
              {titleError || validationErrors.title}
            </p>
          )}
        </div>
        {!initialSubjectId && (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
              Subject Garden
            </label>
            <select
              className="input-field text-sm bg-white"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={isPending}
            >
              <option value="">Quick Import (No Subject)</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {uiError && !titleErrorVisible && !validationErrors.content && !collision && (
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
            disabled={isPending}
          />
          <label
            htmlFor="file-input"
            className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl transition-all cursor-pointer ${isPending ? 'cursor-not-allowed opacity-60' : ''} ${file ? 'bg-indigo-50/30 border-indigo-200' : 'bg-gray-50/50 border-gray-200 hover:border-indigo-400 hover:bg-white'}`}
          >
            {file ? (
              <div className="flex flex-col items-center text-center">
                {imagePreview ? (
                  <div className="w-full max-w-[200px] aspect-square rounded-2xl overflow-hidden mb-3 shadow-md border border-indigo-100">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-500 mb-3 border border-indigo-100">
                    <FileText className="w-6 h-6" />
                  </div>
                )}
                <span className="text-sm font-bold text-gray-900 mb-1">{file.name}</span>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <div className="flex gap-3 mb-3">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-400 border border-gray-100 group-hover:text-indigo-500 group-hover:scale-110 transition-all">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-400 border border-gray-100 group-hover:text-fuchsia-500 group-hover:scale-110 transition-all">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-700">
                  Drop file here or click to browse
                </span>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-1">
                  PDF & Images • Up to {systemLimits.max_file_size_mb}MB
                </span>
              </div>
            )}
          </label>
          {file && !isPending && (
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
              if (validationErrors.content)
                setValidationErrors((prev) => ({ ...prev, content: '' }));
            }}
            disabled={isPending}
          ></textarea>
          {validationErrors.content && (
            <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">
              {validationErrors.content}
            </p>
          )}
        </div>
      </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors px-6"
              disabled={isPending}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="btn-vibrant w-full sm:w-auto px-10 py-3.5 text-sm flex items-center justify-center gap-2"
            disabled={isPending}
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
      </>
      ) : (
        <div
          className={`rounded-2xl border-2 p-6 animate-in slide-in-from-top-4 space-y-6 ${collision.type === 'active' ? 'border-indigo-200 bg-indigo-50/50' : 'border-amber-200 bg-amber-50/50'}`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${collision.type === 'active' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}
            >
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3
                className={`text-base font-black tracking-tight ${collision.type === 'active' ? 'text-indigo-950' : 'text-amber-950'}`}
              >
                {collision.type === 'active' ? 'Document Already Exists' : 'Document Exists in Trash'}
              </h3>
              <p
                className={`text-sm mt-1 leading-relaxed ${collision.type === 'active' ? 'text-indigo-800' : 'text-amber-800'}`}
              >
                A document named <span className="font-bold">"{collision.title}"</span> already exists
                in this subject{collision.materialType ? ` (as a ${collision.materialType})` : ''}.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {collision.type === 'active' ? (
                <button
                  type="button"
                  onClick={handleViewExisting}
                  disabled={isPending}
                  className="py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs shadow-sm shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Eye className="w-4 h-4" />
                  View Existing
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={isPending}
                  className="py-3.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs shadow-sm shadow-amber-100 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  {isRestoring ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  Restore Existing
                </button>
              )}
              <button
                type="button"
                onClick={handleUploadAsDuplicate}
                disabled={isPending}
                className={`py-3.5 bg-white border-2 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 ${collision.type === 'active' ? 'border-indigo-200 text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50' : 'border-amber-200 text-amber-700 hover:border-amber-400 hover:bg-amber-50'}`}
              >
                {isUploadingNew ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                Upload as Duplicate
              </button>
            </div>

            <button
              type="button"
              onClick={() => (onCancel ? onCancel() : setCollision(null))}
              disabled={isPending}
              className="w-full py-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancel Upload
            </button>
          </div>
        </div>
      )}
    </form>
  );
};

export default FileUpload;

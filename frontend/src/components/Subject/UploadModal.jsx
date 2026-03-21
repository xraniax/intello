import { CloudUpload } from 'lucide-react';
import Modal from '../Common/Modal';

const UploadModal = ({
    isOpen,
    onClose,
    handleUpload,
    uploading,
    newUploadTitle,
    setNewUploadTitle,
    newUploadContent,
    setNewUploadContent,
    handleFileChange,
    uploadFile,
    uploadFileError,
    uploadError,
    uploadValidationErrors = {},
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Upload New Material">
            <form onSubmit={handleUpload} className="space-y-4">
                {/* ... existing fields ... */}
                <div>
                    <label className="input-label text-gray-400">Document Title <span className="text-[10px] font-normal lowercase">(Optional)</span></label>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. Lecture Notes - Week 1"
                        value={newUploadTitle}
                        onChange={(e) => setNewUploadTitle(e.target.value)}
                        disabled={uploading}
                    />
                    {uploadValidationErrors.title && (
                        <p className="text-red-500 text-xs mt-1">{uploadValidationErrors.title}</p>
                    )}
                </div>

                <div>
                    <label className="input-label mb-2">Select PDF Document</label>
                    <label
                        className={`upload-zone ${uploadFile ? 'upload-zone--has-file' : ''}`}
                        onDragOver={(e) => e.preventDefault()}
                    >
                        <input
                            type="file"
                            accept=".pdf,application/pdf"
                            className="hidden"
                            onChange={handleFileChange}
                            disabled={uploading}
                        />
                        <CloudUpload className={`w-10 h-10 ${uploadFile ? 'text-green-500' : 'text-blue-500'}`} />
                        <div className="space-y-1">
                            {uploadFile ? (
                                <p className="text-sm font-semibold text-green-700 truncate max-w-[250px]">
                                    {uploadFile.name}
                                </p>
                            ) : (
                                <>
                                    <p className="text-sm font-semibold text-gray-700">Click to browse or drag and drop</p>
                                    <p className="text-xs text-gray-500">Only PDF files up to 10MB are accepted</p>
                                </>
                            )}
                        </div>
                    </label>
                    {uploadFileError && (
                        <p className="text-red-600 text-xs mt-2 font-medium">{uploadFileError}</p>
                    )}
                    {uploadValidationErrors.file && (
                        <p className="text-red-500 text-xs mt-2 font-medium">{uploadValidationErrors.file}</p>
                    )}
                </div>

                <div>
                    <label className="input-label">Text Content (optional if PDF provided)</label>
                    <textarea
                        className="input-field"
                        rows={5}
                        placeholder="Paste notes or raw text here..."
                        value={newUploadContent}
                        onChange={(e) => setNewUploadContent(e.target.value)}
                        disabled={uploading}
                    />
                    {uploadValidationErrors.content && (
                        <p className="text-red-500 text-xs mt-1">{uploadValidationErrors.content}</p>
                    )}
                </div>

                {uploadError && (
                    <p className="text-red-600 text-sm bg-red-50 p-3 rounded">{uploadError}</p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-secondary px-6"
                        disabled={uploading}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn-vibrant flex items-center gap-2 px-12"
                        disabled={uploading || !!uploadFileError}
                    >
                        {uploading ? (
                            'Processing...'
                        ) : (
                            <>
                                <CloudUpload className="w-5 h-5" />
                                <span>Upload Material</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default UploadModal;

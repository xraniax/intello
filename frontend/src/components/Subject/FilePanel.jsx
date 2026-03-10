import React, { useState } from 'react';

const FilePanel = ({
    materials,
    selectedMaterials,
    toggleSelection,
    handleUpload,
    uploading,
    uploadFile,
    newUploadTitle,
    setNewUploadTitle,
    newUploadContent,
    setNewUploadContent,
    handleFileChange,
    uploadFileError,
    uploadError,
    uploadSuccess,
}) => {
    const [showUpload, setShowUpload] = useState(false);

    return (
        <div className="panel-inner">
            {/* Panel Header */}
            <div className="panel-header">
                <span className="panel-title">Files</span>
                <span className="panel-badge">{selectedMaterials.length} selected</span>
            </div>

            {/* Upload Toggle Button */}
            <div className="panel-body">
                <button
                    className="btn-secondary w-full text-sm mb-3"
                    onClick={() => setShowUpload(prev => !prev)}
                >
                    {showUpload ? '↑ Hide Upload' : '+ Upload Document'}
                </button>

                {/* Collapsible Upload Form */}
                {showUpload && (
                    <form onSubmit={(e) => { handleUpload(e); }} className="upload-form">
                        <div className="space-y-3 mb-3">
                            <div>
                                <label className="input-label">Title (optional)</label>
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
                                    onChange={handleFileChange}
                                    disabled={uploading}
                                />
                                {uploadFileError && (
                                    <p className="text-red-600 text-xs mt-1">{uploadFileError}</p>
                                )}
                            </div>
                            <div>
                                <label className="input-label">Text Content (optional if PDF provided)</label>
                                <textarea
                                    className="input-field text-sm"
                                    rows={3}
                                    placeholder="Paste notes or raw text..."
                                    value={newUploadContent}
                                    onChange={(e) => setNewUploadContent(e.target.value)}
                                    disabled={uploading}
                                />
                            </div>
                        </div>

                        {uploadError && (
                            <p className="text-red-600 text-xs bg-red-50 p-2 rounded mb-2">{uploadError}</p>
                        )}
                        {uploadSuccess && (
                            <p className="text-green-700 text-xs bg-green-50 p-2 rounded mb-2">{uploadSuccess}</p>
                        )}

                        <button
                            type="submit"
                            className="btn-primary w-full text-sm"
                            disabled={uploading || !!uploadFileError}
                        >
                            {uploading ? 'Processing...' : 'Upload'}
                        </button>
                    </form>
                )}

                {/* Document List */}
                <div className="file-list">
                    {materials.length === 0 ? (
                        <div className="empty-state">
                            <p>No documents yet.</p>
                            <p className="text-xs mt-1">Upload a PDF to get started.</p>
                        </div>
                    ) : (
                        materials.map((m) => (
                            <div
                                key={m.id}
                                className={`file-item ${selectedMaterials.includes(m.id) ? 'file-item--selected' : ''}`}
                                onClick={() => toggleSelection(m.id)}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedMaterials.includes(m.id)}
                                    readOnly
                                    className="flex-shrink-0 mt-0.5"
                                />
                                <div className="file-item__info">
                                    <span className="file-item__title">{m.title}</span>
                                    <div className="file-item__meta">
                                        <span className="capitalize">{m.type}</span>
                                        {m.status && (
                                            <span className={`status-badge status-badge--${m.status}`}>
                                                {m.status}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default FilePanel;

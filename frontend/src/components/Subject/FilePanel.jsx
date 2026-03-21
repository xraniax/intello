import React, { useState } from 'react';
import { Trash2, Sparkles, PanelLeftClose } from 'lucide-react';

const FilePanel = ({
    materials,
    selectedMaterials,
    toggleSelection,
    onDelete,
    onGenerate,
    onOpenUpload,
    onCollapse
}) => {

    return (
        <div className="panel-inner h-full flex flex-col">
            {/* Panel Header */}
            <div className="panel-header flex-shrink-0">
                <div className="flex items-center gap-2">
                    <span className="panel-title">Source Files</span>
                    <span className="panel-badge">{selectedMaterials.length} selected</span>
                </div>
                <button
                    onClick={onCollapse}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="Hide panel"
                >
                    <PanelLeftClose className="w-4 h-4" />
                </button>
            </div>

            {/* Upload Action */}
            <div className="panel-body flex-shrink-0 border-b border-gray-100 pb-2">
                <button
                    className="btn-vibrant w-full text-sm flex items-center justify-center gap-2 py-3 shadow-md"
                    onClick={onOpenUpload}
                >
                    <Sparkles className="w-4 h-4" />
                    <span>+ Upload Document</span>
                </button>
            </div>

            {/* Document List (Scrollable Area) */}
            <div className="panel-body flex-1 overflow-y-auto min-h-0 pt-2">
                <div className="file-list">
                    {materials.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center opacity-40">
                            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                                <Sparkles className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest leading-tight">No insights yet</p>
                            <p className="text-xs text-gray-400 mt-2 max-w-[140px]">Upload a PDF or paste text to begin your AI journey.</p>
                        </div>
                    ) : (
                        materials.map((m) => (
                            <div
                                key={m.id}
                                className={`file-item group ${selectedMaterials.includes(m.id) ? 'file-item--selected' : ''}`}
                                onClick={() => toggleSelection(m.id)}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedMaterials.includes(m.id)}
                                    readOnly
                                    className="flex-shrink-0 mt-1"
                                />
                                <div className="file-item__info flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-2">
                                        <span className="file-item__title truncate" title={m.title}>
                                            {m.title}
                                        </span>
                                        <span className="text-[10px] text-gray-400 whitespace-nowrap mt-0.5">
                                            {new Date(m.created_at).toLocaleDateString()}
                                        </span>
                                    </div>

                                    {/* Action Buttons - Visible on hover or when selected */}
                                    <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onGenerate(m.id);
                                            }}
                                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="Generate AI Tool"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(m.id);
                                            }}
                                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Delete File"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
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

import React from 'react';
import { Trash2, Sparkles, PanelLeftClose, FileText, CheckCircle2 } from 'lucide-react';

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

            {/* Quick Upload Action */}
            <div className="px-4 py-4 border-b border-gray-100 bg-gray-50/30">
                <button
                    className="w-full py-4 px-4 bg-white border-2 border-dashed border-indigo-100 rounded-2xl flex flex-col items-center justify-center gap-1 group hover:border-indigo-400 hover:bg-indigo-50/50 transition-all duration-300 shadow-sm hover:shadow-md"
                    onClick={onOpenUpload}
                >
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Sparkles className="w-5 h-5 text-indigo-500" />
                    </div>
                    <span className="text-xs font-black text-indigo-600 uppercase tracking-widest mt-1">Grow Your Space</span>
                    <span className="text-[10px] text-gray-400 font-medium">Add PDF or Text Source</span>
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
                        materials.map((m) => {
                            const isProcessing = String(m.status || '').toUpperCase() === 'PROCESSING';
                            const isSelected = selectedMaterials.includes(m.id);
                            
                            return (
                                <div
                                    key={m.id}
                                    className={`group relative bg-white border rounded-2xl p-4 transition-all duration-300 cursor-pointer mb-3 flex items-start gap-3 ${
                                        isSelected 
                                            ? 'border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/10' 
                                            : isProcessing
                                                ? 'border-indigo-200 bg-indigo-50/10 cursor-wait opacity-80'
                                                : 'border-gray-100 hover:border-indigo-200 hover:shadow-md'
                                    }`}
                                    onClick={() => !isProcessing && toggleSelection(m.id)}
                                >
                                    <div className={`mt-1 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                        isSelected ? 'bg-indigo-500 text-white' : 'bg-gray-50 text-gray-400'
                                    }`}>
                                        {isProcessing ? (
                                            <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                                        ) : isSelected ? (
                                            <CheckCircle2 className="w-4 h-4" />
                                        ) : (
                                            <FileText className="w-4 h-4" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-grow">
                                        <div className="flex items-center gap-2">
                                            <h4 className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                                                {m.title}
                                            </h4>
                                            {isProcessing && (
                                                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded">
                                                    AI Refining...
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                                {new Date(m.created_at).toLocaleDateString()}
                                            </span>
                                            <div className="flex gap-2 transition-all ml-auto">
                                                {!isProcessing && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onGenerate(m.id); }}
                                                        className="p-1.5 text-indigo-500 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        title="AI Insight"
                                                    >
                                                        <Sparkles className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}
                                                    className={`p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition-all ${isProcessing ? 'opacity-40' : 'opacity-0 group-hover:opacity-100'}`}
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default FilePanel;

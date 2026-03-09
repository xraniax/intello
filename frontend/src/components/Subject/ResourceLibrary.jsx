import React from 'react';
import {
    CheckSquare, Square, Loader2, Upload as UploadIcon, FileText
} from 'lucide-react';

const ResourceLibrary = ({
    materials,
    selectedMaterials,
    toggleSelection,
    handleUpload,
    uploadState // { uploading, title, setTitle, content, setContent }
}) => {
    return (
        <section className="glass-card">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-4 flex justify-between items-center">
                Library
                <span className="text-[10px] text-primary">{selectedMaterials.length} Selected</span>
            </h3>

            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                {materials.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                        <FileText size={40} className="mb-2 opacity-20" />
                        <p className="italic text-sm">Library is empty.</p>
                    </div>
                ) : (
                    materials.map((m) => (
                        <div
                            key={m.id}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${selectedMaterials.includes(m.id)
                                    ? 'bg-primary/10 border-primary/40 shadow-lg shadow-primary/5'
                                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                                }`}
                            onClick={() => toggleSelection(m.id)}
                        >
                            <div className={selectedMaterials.includes(m.id) ? 'text-primary' : 'text-slate-600'}>
                                {selectedMaterials.includes(m.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-bold truncate">{m.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[10px] text-slate-500 capitalize">{m.type}</p>
                                    {m.status && (
                                        <span className={`text-[8px] uppercase font-black px-1.5 py-0.5 rounded ${m.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                                m.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {m.status}
                                        </span>
                                    )}
                                </div>
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
                        value={uploadState.title}
                        onChange={(e) => uploadState.setTitle(e.target.value)}
                    />
                    <textarea
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-xs focus:border-primary outline-none transition-colors min-h-[100px] resize-none"
                        placeholder="Paste notes, text, or content..."
                        value={uploadState.content}
                        onChange={(e) => uploadState.setContent(e.target.value)}
                    />
                    <button
                        type="submit"
                        disabled={uploadState.uploading}
                        className="w-full btn-modern-primary !py-2 !text-xs"
                    >
                        {uploadState.uploading ? <Loader2 className="animate-spin" size={14} /> : <><UploadIcon size={14} /> Add to Library</>}
                    </button>
                </form>
            </div>
        </section>
    );
};

export default ResourceLibrary;

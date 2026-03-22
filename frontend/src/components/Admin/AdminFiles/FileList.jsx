import React, { useState } from 'react';
import { 
    File as FileIcon, Trash2, User, Book, Eye, 
    Filter, LayoutGrid, LayoutList, CheckSquare, Square, 
    Download, RefreshCw, X
} from 'lucide-react';
import { format } from 'date-fns';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const FileList = ({ files, onDelete, filters, setFilters, settings, selectedIds, setSelectedIds, onBulkDelete }) => {
    const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

    const handleSelectAll = () => {
        if (selectedIds.size === files.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(files.map(f => f.id)));
        }
    };

    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    // Card View Component
    const FileCard = ({ file }) => {
        const isSelected = selectedIds.has(file.id);
        const fileExt = file.original_name.split('.').pop().toUpperCase();
        
        return (
            <div 
                onClick={() => toggleSelection(file.id)}
                className={`bg-white rounded-3xl border transition-all duration-200 cursor-pointer overflow-hidden group ${isSelected ? 'border-indigo-400 shadow-md shadow-indigo-100 ring-2 ring-indigo-50' : 'border-gray-100 shadow-sm hover:border-gray-300'}`}
            >
                <div className="p-5 flex flex-col h-full relative">
                    {/* Checkbox Overlay */}
                    <div className="absolute top-4 right-4 z-10 transition-opacity">
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 group-hover:border-indigo-400 bg-white/80 backdrop-blur-sm'}`}>
                            {isSelected && <CheckSquare className="w-4 h-4 text-white" />}
                        </div>
                    </div>

                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-500 border border-indigo-100 flex items-center justify-center mb-4 shadow-sm shrink-0">
                        <FileIcon className="w-6 h-6" />
                    </div>
                    
                    <h3 className="font-bold text-gray-900 leading-tight mb-1 truncate pr-8" title={file.original_name}>
                        {file.original_name}
                    </h3>
                    
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-[10px] font-black xd bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md uppercase tracking-wider">{fileExt}</span>
                        <span className="text-xs font-bold text-gray-400">·</span>
                        <span className="text-xs font-bold text-gray-500">{formatBytes(file.size_bytes)}</span>
                    </div>

                    <div className="mt-auto pt-4 border-t border-gray-50 space-y-3">
                        <div className="flex items-center gap-2 text-gray-500">
                            <User className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-xs font-bold truncate max-w-[150px]">{file.user_name || file.user_email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-500">
                            <Book className="w-3.5 h-3.5 text-purple-400" />
                            <span className="text-xs font-bold truncate max-w-[150px]">{file.subject_name || <span className="italic text-gray-400">Orphaned</span>}</span>
                        </div>
                    </div>

                    {/* Hover Actions */}
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 w-full justify-end bg-gradient-to-b from-white/90 to-transparent pb-10 pointer-events-none">
                        <div className="pointer-events-auto flex gap-1 bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-xl p-1 mr-8">
                            <button className="p-2 text-gray-400 hover:text-indigo-500 rounded-lg transition-colors hover:bg-indigo-50" onClick={(e) => e.stopPropagation()}>
                                <Download className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors hover:bg-red-50" onClick={(e) => { e.stopPropagation(); onDelete(file.id, file.original_name); }}>
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 relative">
            {/* Filter & View Control Bar */}
            <div className="bg-white p-2 md:p-3 rounded-2xl flex flex-col xl:flex-row justify-between xl:items-center gap-4 border border-gray-100 shadow-sm relative z-20">
                <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
                    <div className="relative flex-1 md:w-36">
                        <input 
                            type="text" 
                            placeholder="Email or Name..." 
                            className="w-full bg-gray-50 hover:bg-gray-100 text-sm font-semibold text-gray-700 outline-none border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 rounded-xl py-2.5 px-3 transition-all"
                            value={filters.userId}
                            onChange={(e) => setFilters({...filters, userId: e.target.value})}
                        />
                    </div>
                    <div className="relative flex-1 md:w-36">
                        <input 
                            type="text" 
                            placeholder="Subject Name..." 
                            className="w-full bg-gray-50 hover:bg-gray-100 text-sm font-semibold text-gray-700 outline-none border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 rounded-xl py-2.5 px-3 transition-all"
                            value={filters.subjectId}
                            onChange={(e) => setFilters({...filters, subjectId: e.target.value})}
                        />
                    </div>
                    <div className="h-8 w-px bg-gray-100 hidden md:block mx-1"></div>
                    <div className="relative flex-1 md:w-32">
                        <select 
                            className="w-full h-full pl-3 pr-8 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm font-bold text-gray-600 border border-transparent focus:bg-white focus:border-indigo-100 outline-none rounded-xl appearance-none cursor-pointer transition-all"
                            value={filters.minSizeMb}
                            onChange={(e) => setFilters({...filters, minSizeMb: e.target.value})}
                        >
                            <option value="">Any Size</option>
                            <option value="1">&gt; 1 MB</option>
                            <option value="10">&gt; 10 MB</option>
                            <option value="50">&gt; 50 MB</option>
                            <option value="100">&gt; 100 MB</option>
                        </select>
                        <Filter className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <div className="relative flex-1 md:w-36">
                        <select 
                            className="w-full h-full pl-3 pr-8 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm font-bold text-gray-600 border border-transparent focus:bg-white focus:border-indigo-100 outline-none rounded-xl appearance-none cursor-pointer transition-all"
                            value={filters.mimeType}
                            onChange={(e) => setFilters({...filters, mimeType: e.target.value})}
                        >
                            <option value="">All File Types</option>
                            {settings?.allowed_types?.map(type => (
                                <option key={type} value={type}>{type.split('/').pop().toUpperCase()}</option>
                            ))}
                        </select>
                        <Filter className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                </div>

                <div className="flex items-center justify-between xl:justify-end gap-4 w-full xl:w-auto">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">
                        {files.length} Results
                    </span>
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button 
                            onClick={() => setViewMode('table')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <LayoutList className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {files.length === 0 ? (
                <div className="w-full py-24 bg-white border border-gray-200 border-dashed rounded-[3rem] text-center shadow-sm">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mx-auto mb-4 border border-gray-100">
                        <Search className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-2">No files tracked</h3>
                    <p className="text-gray-500 font-medium">Try verifying your filters or awaiting user ingestion.</p>
                </div>
            ) : viewMode === 'table' ? (
                <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="pl-6 pr-2 py-5 w-10">
                                        <button onClick={handleSelectAll} className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center text-indigo-600 hover:border-indigo-400 transition-colors">
                                            {selectedIds.size === files.length && <CheckSquare className="w-4 h-4" />}
                                            {selectedIds.size > 0 && selectedIds.size < files.length && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-sm"></div>}
                                        </button>
                                    </th>
                                    <th className="px-4 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Source File</th>
                                    <th className="px-4 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Owner</th>
                                    <th className="px-4 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Context space</th>
                                    <th className="px-4 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Size</th>
                                    <th className="px-4 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Uploaded</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {files.map(file => {
                                    const isSelected = selectedIds.has(file.id);
                                    return (
                                        <tr key={file.id} className={`transition-colors group ${isSelected ? 'bg-indigo-50/40' : 'hover:bg-gray-50/50'}`}>
                                            <td className="pl-6 pr-2 py-4">
                                                <button onClick={() => toggleSelection(file.id)} className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300 group-hover:border-indigo-400'}`}>
                                                    {isSelected && <CheckSquare className="w-4 h-4" />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center border border-orange-100 shrink-0">
                                                        <FileIcon className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex flex-col min-w-[150px] max-w-[200px]">
                                                        <span className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors truncate" title={file.original_name}>
                                                            {file.original_name}
                                                        </span>
                                                        <span className="text-[10px] font-medium text-gray-400 font-mono truncate">
                                                            {file.id}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 max-w-[150px]">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                                    <span className="text-xs font-bold text-gray-600 truncate" title={file.user_name}>{file.user_name}</span>
                                                </div>
                                                <span className="text-[10px] text-gray-400 block ml-5 font-medium truncate" title={file.user_email}>{file.user_email}</span>
                                            </td>
                                            <td className="px-4 py-4 max-w-[150px]">
                                                {file.subject_name ? (
                                                    <div className="flex items-center gap-2">
                                                        <Book className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                                        <span className="text-xs font-bold text-gray-600 truncate" title={file.subject_name}>{file.subject_name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-bold text-gray-300 italic">Global context</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="text-xs font-black text-gray-700 bg-gray-100 px-2 py-1 rounded-md">{formatBytes(file.size_bytes)}</span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="text-xs font-bold text-gray-500 block">{format(new Date(file.created_at), 'MMM dd, yyyy')}</span>
                                                <span className="text-[10px] text-gray-400 font-medium">{format(new Date(file.created_at), 'HH:mm')}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="p-2 rounded-xl text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => onDelete(file.id, file.original_name)}
                                                        className="p-2 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {files.map(file => <FileCard key={file.id} file={file} />)}
                </div>
            )}

            {/* Floating Action Bar for Bulk Selection */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-gray-900 shadow-2xl shadow-gray-900/40 rounded-full px-6 py-3 flex items-center gap-6 animate-in slide-in-from-bottom-8 border border-gray-700">
                    <div className="flex flex-col">
                        <span className="text-white font-bold text-sm leading-tight">{selectedIds.size} files selected</span>
                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Ready for action</span>
                    </div>
                    <div className="w-px h-8 bg-gray-700"></div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setSelectedIds(new Set())}
                            className="w-10 h-10 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center hover:bg-gray-700 transition-colors"
                            title="Clear selection"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={onBulkDelete}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 h-10 rounded-full font-bold text-sm transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete All
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileList;

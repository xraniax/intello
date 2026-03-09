import React from 'react';

const ResourceLibrary = ({
    materials,
    selectedMaterials,
    toggleSelection
}) => {
    return (
        <section className="border border-gray-200 p-4 rounded bg-white">
            <h3 className="text-lg font-bold mb-4 flex justify-between items-center">
                Library
                <span className="text-sm font-normal text-gray-500">{selectedMaterials.length} Selected</span>
            </h3>

            <div className="space-y-2 max-h-[400px] overflow-y-auto mb-4">
                {materials.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 border border-dashed border-gray-300 rounded">
                        <p>Library is empty.</p>
                    </div>
                ) : (
                    materials.map((m) => (
                        <div
                            key={m.id}
                            className="p-2 border border-gray-200 rounded flex items-start gap-2 hover:bg-gray-50 cursor-pointer"
                            onClick={() => toggleSelection(m.id)}
                        >
                            <input
                                type="checkbox"
                                checked={selectedMaterials.includes(m.id)}
                                readOnly
                                className="mt-1 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm truncate">{m.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-500 capitalize">{m.type}</span>
                                    {m.status && (
                                        <span className={`text-[10px] px-1 py-0.5 rounded ${m.status === 'completed' ? 'bg-green-100 text-green-800' :
                                            m.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
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
        </section>
    );
};

export default ResourceLibrary;

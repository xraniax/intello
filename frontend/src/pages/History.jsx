import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { materialService } from '../services/api';

const History = () => {
    const location = useLocation();
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await materialService.getHistory();
                const historyData = Array.isArray(res.data.data) ? res.data.data : [];
                setMaterials(historyData);

                // If we came from SubjectDetail with a selectedId, find and select it
                if (location.state?.selectedId) {
                    const found = historyData.find(m => m.id === location.state.selectedId);
                    if (found) setSelected(found);
                } else if (historyData.length > 0) {
                    setSelected(historyData[0]);
                }
            } catch (error) {
                console.error('Failed to fetch history', error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [location.state]);

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading your history...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Study History</h1>
                <p className="text-gray-600">Review your learning materials and AI-generated insights</p>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/3 flex flex-col gap-2">
                    {materials.length === 0 ? (
                        <div className="p-6 border border-gray-200 bg-gray-50 text-center rounded">
                            <p className="text-gray-600">No materials found. Start by uploading content!</p>
                        </div>
                    ) : (
                        materials.map((m) => (
                            <div
                                key={m.id}
                                className={`p-3 border rounded cursor-pointer ${selected?.id === m.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                                onClick={() => setSelected(m)}
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h4 className="font-semibold text-gray-900">{m.title}</h4>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {m.subject_name || 'Imported'}
                                        </div>
                                    </div>
                                    <span className="text-gray-400">&gt;</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="w-full md:w-2/3 border border-gray-200 bg-white rounded p-6 min-h-[500px]">
                    {selected ? (
                        <div>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-xl font-bold">{selected.title}</h2>
                                    <div className="flex gap-2 mt-2 text-xs">
                                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded uppercase font-medium">
                                            {selected.type}
                                        </span>
                                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                            {selected.subject_name || 'Imported Materials'}
                                        </span>
                                    </div>
                                </div>
                                <button className="text-sm text-red-600 border border-red-200 hover:bg-red-50 px-2 py-1 rounded">
                                    Delete
                                </button>
                            </div>

                            <div className="mb-8">
                                <h4 className="font-semibold text-gray-800 mb-2">AI Generated Insights</h4>
                                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded text-sm text-gray-800 whitespace-pre-wrap">
                                    {selected.ai_generated_content?.result ? (
                                        typeof selected.ai_generated_content.result === 'string' ? (
                                            selected.ai_generated_content.result
                                        ) : (
                                            <div className="flex flex-col gap-4">
                                                {selected.ai_generated_content.result.map((q, i) => (
                                                    <div key={i} className="pb-4 border-b border-blue-200 last:border-0 last:pb-0">
                                                        <p className="font-semibold text-gray-900">Q: {q.question}</p>
                                                        <p className="text-blue-800 mt-1">A: {q.answer}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    ) : (
                                        <span className="italic text-gray-500">No AI results generated yet.</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-700 mb-2">Source Content Clip</h4>
                                <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded border border-gray-200">
                                    {selected.content.substring(0, 500)}...
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-500">
                            Select a material from the list to view insights
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default History;

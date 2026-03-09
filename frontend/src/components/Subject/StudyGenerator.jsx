import React from 'react';

const StudyGenerator = ({
    genType,
    setGenType,
    handleGenerate,
    isGenerating,
    selectedCount,
    genResult,
    setGenResult
}) => {
    return (
        <section className="border border-gray-200 p-4 rounded bg-white mt-4">
            <h3 className="text-lg font-bold mb-4">Study Generator</h3>

            <div className="grid grid-cols-2 gap-2 mb-4">
                {['summary', 'quiz', 'notes', 'flashcards'].map(type => (
                    <button
                        key={type}
                        onClick={() => setGenType(type)}
                        className={`px-2 py-1 border rounded text-sm ${genType === type
                            ? 'bg-blue-100 border-blue-500 text-blue-800 font-medium'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        {type}
                    </button>
                ))}
            </div>

            <button
                onClick={handleGenerate}
                disabled={isGenerating || selectedCount === 0}
                className="btn-primary w-full text-sm"
            >
                {isGenerating ? 'Generating...' : 'Generate Tools'}
            </button>

            {selectedCount === 0 && (
                <p className="text-xs text-gray-500 mt-2 text-center">Select files to use as context</p>
            )}

            {genResult && (
                <div className="mt-4 p-3 border border-gray-200 bg-gray-50 rounded">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm">Result</span>
                        <button onClick={() => setGenResult('')} className="text-gray-500 hover:text-black">Close</button>
                    </div>
                    <div className="text-sm border border-gray-300 bg-white p-2 rounded max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                        {genResult}
                    </div>
                </div>
            )}
        </section>
    );
};

export default StudyGenerator;

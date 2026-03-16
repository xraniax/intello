import React from 'react';

const MATERIAL_TYPES = ['flashcards', 'summary', 'quiz', 'mock_exam'];

const MaterialsPanel = ({
    genType,
    setGenType,
    handleGenerate,
    isGenerating,
    selectedCount,
    genResult,
    setGenResult,
    genError,
}) => {
    return (
        <div className="panel-inner">
            {/* Panel Header */}
            <div className="panel-header">
                <span className="panel-title">AI Study Tools</span>
                {genResult && (
                    <button
                        className="text-xs text-gray-500 hover:text-red-600"
                        onClick={() => setGenResult('')}
                    >
                        Clear
                    </button>
                )}
            </div>

            <div className="panel-body">
                {/* Generation Controls */}
                <section className="materials-controls">
                    <p className="section-label">Select Tool</p>
                    <div className="type-selector">
                        {MATERIAL_TYPES.map(type => (
                            <button
                                key={type}
                                onClick={() => setGenType(type)}
                                className={`type-btn ${genType === type ? 'type-btn--active' : ''}`}
                            >
                                {type.replace('_', ' ')}
                            </button>
                        ))}
                    </div>

                    {genError && (
                        <p className="text-red-600 text-xs bg-red-50 p-2 rounded mt-2">{genError}</p>
                    )}

                    {selectedCount === 0 && (
                        <p className="text-xs text-gray-400 mt-2">
                            Select at least one document in the Files panel.
                        </p>
                    )}

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || selectedCount === 0}
                        className="btn-primary w-full mt-3 text-sm"
                    >
                        {isGenerating ? 'Generating...' : `Generate ${genType}`}
                    </button>
                </section>

                {/* Generated Output */}
                {genResult && (
                    <section className="materials-output">
                        <p className="section-label capitalize">{genType} Result</p>
                        <div className="output-box">
                            {genResult}
                        </div>
                    </section>
                )}

                {!genResult && !isGenerating && (
                    <div className="empty-state mt-6">
                        <p>No materials generated yet.</p>
                        <p className="text-xs mt-1">Select documents and choose a material type above.</p>
                    </div>
                )}

                {isGenerating && (
                    <div className="empty-state mt-6">
                        <p className="text-blue-600">Generating {genType}...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MaterialsPanel;

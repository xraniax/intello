import React from 'react';

const AITutor = ({
    messages,
    currentQuestion,
    setCurrentQuestion,
    handleChat,
    handleVoiceInput,
    handleTTS,
    isThinking,
    isListening,
    chatEndRef,
    contextInfo
}) => {
    return (
        <div className="border border-gray-200 rounded bg-white flex flex-col h-[600px]">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="font-bold">AI Subject Tutor</span>
                    {isThinking && <span className="text-xs text-blue-600 bg-blue-100 px-1 rounded">Thinking...</span>}
                </div>
                <span className="text-xs text-gray-500">
                    {contextInfo}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                        Ask a question about your selected resources.
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded text-sm ${msg.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 border border-gray-300 text-black'
                            }`}>
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                            {msg.role === 'ai' && (
                                <button
                                    onClick={() => handleTTS(msg.content)}
                                    className="text-xs text-blue-600 hover:underline mt-2 block"
                                >
                                    Read Aloud
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t border-gray-200 bg-gray-50">
                <form onSubmit={handleChat} className="flex gap-2">
                    <button
                        type="button"
                        onClick={handleVoiceInput}
                        className={`px-3 py-2 border rounded text-sm ${isListening
                            ? 'bg-red-600 border-red-700 text-white'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                            }`}
                    >
                        {isListening ? 'Listening...' : 'Mic'}
                    </button>
                    <input
                        className="input-field"
                        placeholder="Ask a question..."
                        value={currentQuestion}
                        onChange={(e) => setCurrentQuestion(e.target.value)}
                    />
                    <button
                        type="submit"
                        disabled={isThinking || !currentQuestion.trim()}
                        className="btn-primary"
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AITutor;

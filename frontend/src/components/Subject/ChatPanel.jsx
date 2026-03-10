import React, { useState } from 'react';

const ChatPanel = ({
    messages,
    currentQuestion,
    setCurrentQuestion,
    handleChat,
    handleVoiceInput,
    handleTTS,
    isThinking,
    isListening,
    chatEndRef,
    contextInfo,
    chatError,
}) => {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className={`panel-inner chat-panel ${collapsed ? 'chat-panel--collapsed' : ''}`}>
            {/* Panel Header — always visible */}
            <div className="panel-header">
                <span className="panel-title">AI Tutor</span>
                <div className="flex items-center gap-2">
                    {isThinking && !collapsed && (
                        <span className="text-xs text-blue-600">Thinking...</span>
                    )}
                    <button
                        className="text-xs text-gray-500 hover:text-gray-800 px-1"
                        onClick={() => setCollapsed(prev => !prev)}
                        title={collapsed ? 'Expand chat' : 'Collapse chat'}
                    >
                        {collapsed ? '◀ Show' : 'Hide ▶'}
                    </button>
                </div>
            </div>

            {/* Chat body — hidden when collapsed */}
            {!collapsed && (
                <>
                    {/* Context info */}
                    <div className="px-3 py-1 border-b border-gray-100 bg-gray-50">
                        <span className="text-xs text-gray-500">{contextInfo}</span>
                    </div>

                    {/* Messages */}
                    <div className="chat-messages">
                        {messages.length === 0 && (
                            <div className="empty-state h-full flex items-center justify-center">
                                <p>Ask a question about your selected documents.</p>
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <div key={i} className={`chat-message chat-message--${msg.role}`}>
                                <div className="chat-bubble">
                                    <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                                    {msg.role === 'ai' && (
                                        <button
                                            onClick={() => handleTTS(msg.content)}
                                            className="text-xs text-blue-600 hover:underline mt-1 block"
                                        >
                                            Read aloud
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {chatError && (
                            <p className="text-red-600 text-xs text-center px-3">{chatError}</p>
                        )}

                        <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    <div className="chat-input-area">
                        <form onSubmit={handleChat} className="flex gap-1">
                            <button
                                type="button"
                                onClick={handleVoiceInput}
                                className={`chat-mic-btn ${isListening ? 'chat-mic-btn--active' : ''}`}
                            >
                                {isListening ? '⏹' : '🎤'}
                            </button>
                            <input
                                className="input-field text-sm"
                                placeholder="Ask a question..."
                                value={currentQuestion}
                                onChange={(e) => setCurrentQuestion(e.target.value)}
                            />
                            <button
                                type="submit"
                                disabled={isThinking || !currentQuestion.trim()}
                                className="btn-primary text-sm px-3"
                            >
                                Send
                            </button>
                        </form>
                    </div>
                </>
            )}
        </div>
    );
};

export default ChatPanel;

import React from 'react';
import { XCircle } from 'lucide-react';

class MaterialErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Material Rendering Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-10 border-4 rounded-[2.5rem] text-center my-6 animate-in zoom-in-95 duration-300 relative overflow-hidden bg-white shadow-xl shadow-red-900/5 group" style={{ borderColor: '#FEE2E2' }}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full opacity-50 transition-transform group-hover:scale-110"></div>
                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 bg-red-100 text-red-600 shadow-sm relative z-10">
                        <XCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-black mb-2 text-red-600 uppercase tracking-tight relative z-10">Oops! Something went wrong</h3>
                    <p className="text-gray-500 font-bold mb-8 max-w-sm mx-auto relative z-10">Our neural engines hit a bump while processing this {this.props.type || 'content'}.</p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-200 relative z-10"
                    >
                        Try again
                    </button>
                    <details className="mt-8 text-left relative z-10">
                        <summary className="text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer opacity-40 hover:opacity-100 transition-opacity text-gray-400">Technical Details</summary>
                        <pre className="mt-4 p-5 text-[11px] rounded-2xl overflow-auto max-h-40 bg-gray-50 font-mono text-gray-500 border border-red-50">
                            {this.state.error?.toString()}
                        </pre>
                    </details>
                </div>
            );
        }
        return this.props.children;
    }
}

export default MaterialErrorBoundary;

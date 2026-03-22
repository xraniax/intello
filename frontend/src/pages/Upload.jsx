import React from 'react';
import { useNavigate } from 'react-router-dom';
import FileUpload from '../components/Common/FileUpload';

const UploadPage = () => {
    const navigate = useNavigate();

    return (
        <div className="max-w-4xl mx-auto p-6 md:p-10 animate-in fade-in duration-700">
            <div className="mb-12">
                <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-2">Grow Your Knowledge</h1>
                <p className="text-gray-500 font-medium text-lg">Upload your source documents and let AI cultivate study materials for you.</p>
            </div>

            <div className="card-minimal border-indigo-50/50 p-8 bg-white shadow-xl rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                <FileUpload 
                    onSuccess={() => {
                        setTimeout(() => navigate('/history'), 2000);
                    }} 
                />
            </div>

            <p className="mt-12 text-xs text-gray-400 font-bold uppercase tracking-widest text-center">
                Cultivate Clarity &bull; Seed Success
            </p>
        </div>
    );
};

export default UploadPage;

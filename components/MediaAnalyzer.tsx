
import React, { useState } from 'react';
import FileUpload from './common/FileUpload';
import Spinner from './common/Spinner';
import { analyzeVideo } from '../services/geminiService';
import { fileToBase64 } from '../utils/helpers';

const MediaAnalyzer: React.FC = () => {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [prompt, setPrompt] = useState<string>('Summarize this video and identify key information.');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [videoPreview, setVideoPreview] = useState<string | null>(null);

    const handleFileChange = (file: File) => {
        setVideoFile(file);
        setVideoPreview(URL.createObjectURL(file));
        setAnalysisResult(null);
        setError(null);
    };

    const handleSubmit = async () => {
        if (!videoFile || !prompt) {
            setError('Please upload a video and provide a prompt for analysis.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);

        try {
            // Note: Large video files might exceed browser memory or request size limits.
            // This implementation is best suited for short video clips.
            const base64 = await fileToBase64(videoFile);
            const response = await analyzeVideo(base64, videoFile.type, prompt);
            setAnalysisResult(response.text);
        } catch (err) {
            console.error(err);
            setError('Failed to analyze the video. Please try a smaller file or try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-slate-800/50 rounded-2xl shadow-2xl shadow-indigo-900/20 border border-slate-700">
            <h2 className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300 mb-2">Media Analyzer</h2>
            <p className="text-center text-slate-400 mb-8">Upload a video to have Gemini Pro analyze its contents for key information.</p>

            <div className="space-y-6">
                <FileUpload
                    onFileUpload={handleFileChange}
                    accept="video/*"
                    label="Upload a video file"
                />

                {videoPreview && (
                    <div className="flex justify-center">
                        <video src={videoPreview} controls className="max-w-full md:max-w-md rounded-lg"></video>
                    </div>
                )}
                
                <div>
                    <label htmlFor="prompt" className="block text-sm font-medium text-slate-300 mb-2">Analysis Prompt</label>
                    <textarea
                        id="prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white h-24 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={isLoading || !videoFile}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:from-indigo-600 hover:to-purple-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    {isLoading ? 'Analyzing...' : 'Analyze Video'}
                </button>

                {isLoading && <Spinner text="Analyzing video frames..." />}
                
                {error && <div className="text-center text-red-400 p-4 bg-red-900/50 rounded-lg">{error}</div>}

                {analysisResult && (
                    <div className="p-6 bg-slate-900 rounded-lg border border-slate-700 space-y-4 animate-fade-in-up">
                        <h3 className="text-xl font-semibold text-indigo-300">Analysis Results</h3>
                        <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{analysisResult}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MediaAnalyzer;

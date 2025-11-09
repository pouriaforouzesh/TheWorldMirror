import React, { useState, useEffect } from 'react';
import Spinner from './common/Spinner';
import FileUpload from './common/FileUpload';
import { generateImage, editImage, generateVideo, checkVideoStatus, fetchVideoBlob } from '../services/geminiService';
import { fileToBase64 } from '../utils/helpers';
import { VEO_LOADING_MESSAGES, ASPECT_RATIOS, VIDEO_ASPECT_RATIOS } from '../constants';
import { Operation } from '@google/genai';

type CreativeMode = 'generate' | 'edit' | 'video';

const CreativeStudio: React.FC = () => {
    const [mode, setMode] = useState<CreativeMode>('generate');
    
    const TabButton = ({ currentMode, label }: { currentMode: CreativeMode; label: string }) => (
        <button
          onClick={() => setMode(currentMode)}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${
            mode === currentMode
              ? 'bg-indigo-500 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          {label}
        </button>
    );

    return (
        <div className="max-w-6xl mx-auto p-6 bg-slate-800/50 rounded-2xl shadow-2xl shadow-indigo-900/20 border border-slate-700">
            <h2 className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300 mb-2">Creative Studio</h2>
            <p className="text-center text-slate-400 mb-8">Bring your visions to life with AI-powered image and video generation.</p>
            
            <div className="flex justify-center gap-2 mb-8">
                <TabButton currentMode="generate" label="Image Generation" />
                <TabButton currentMode="edit" label="Image Editing" />
                <TabButton currentMode="video" label="Video Generation" />
            </div>

            {mode === 'generate' && <ImageGenerator />}
            {mode === 'edit' && <ImageEditor />}
            {mode === 'video' && <VideoGenerator />}
        </div>
    );
};

const ImageGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string|null>(null);
    const [result, setResult] = useState<string|null>(null);

    const handleSubmit = async () => {
        if (!prompt) {
            setError('Please enter a prompt.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);
        try {
            const response = await generateImage(prompt, aspectRatio);
            const base64ImageBytes = response.generatedImages?.[0]?.image.imageBytes;
            if (base64ImageBytes) {
                setResult(`data:image/jpeg;base64,${base64ImageBytes}`);
            } else {
                setError('Could not generate image. Please try a different prompt.');
            }
        } catch (err: any) {
             if (err.message === "IMAGEN_BILLING_REQUIRED") {
                setError("Image generation for this model requires a billed account. Please check your API key's settings.");
            } else {
                setError('An error occurred. Please try again.');
            }
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="e.g., A robot holding a red skateboard."
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white h-24 resize-none"
            />
             <div className="flex flex-wrap gap-2">
                {ASPECT_RATIOS.map(ar => (
                    <button key={ar} onClick={() => setAspectRatio(ar)} className={`px-3 py-1 text-xs font-medium rounded-full ${aspectRatio === ar ? 'bg-indigo-500 text-white' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'}`}>{ar}</button>
                ))}
            </div>
            <button onClick={handleSubmit} disabled={isLoading} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:from-indigo-600 hover:to-purple-700 transition duration-300 disabled:opacity-50">
                Generate Image
            </button>
            {isLoading && <Spinner text="Generating..." />}
            {error && <p className="text-red-400">{error}</p>}
            {result && <img src={result} alt="Generated" className="mt-4 rounded-lg w-full max-w-lg mx-auto" />}
        </div>
    );
};

const ImageEditor: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [imageFile, setImageFile] = useState<File|null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string|null>(null);
    const [originalImage, setOriginalImage] = useState<string|null>(null);
    const [editedImage, setEditedImage] = useState<string|null>(null);

    const handleFile = (file: File) => {
        setImageFile(file);
        setOriginalImage(URL.createObjectURL(file));
        setEditedImage(null);
    };

    const handleSubmit = async () => {
        if (!prompt || !imageFile) {
            setError('Please upload an image and provide an editing prompt.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setEditedImage(null);
        try {
            const base64 = await fileToBase64(imageFile);
            const response = await editImage(base64, imageFile.type, prompt);
            const part = response.candidates?.[0]?.content?.parts?.[0];
            if (part && 'inlineData' in part && part.inlineData) {
                setEditedImage(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
            } else {
                setError('Could not edit the image.');
            }
        } catch (err) {
            setError('An error occurred during editing.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <FileUpload onFileUpload={handleFile} accept="image/*" label="Upload an image to edit"/>
            <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="e.g., Add a retro filter, remove the person in the background"
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white h-24 resize-none"
            />
            <button onClick={handleSubmit} disabled={isLoading} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:from-indigo-600 hover:to-purple-700 transition duration-300 disabled:opacity-50">
                Edit Image
            </button>
            {isLoading && <Spinner text="Editing..." />}
            {error && <p className="text-red-400">{error}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {originalImage && <div><h4 className="font-semibold mb-2 text-center">Original</h4><img src={originalImage} alt="Original" className="rounded-lg"/></div>}
                {editedImage && <div><h4 className="font-semibold mb-2 text-center">Edited</h4><img src={editedImage} alt="Edited" className="rounded-lg"/></div>}
            </div>
        </div>
    );
};

const VideoGenerator: React.FC = () => {
    const [apiKeySelected, setApiKeySelected] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState(VIDEO_ASPECT_RATIOS[0]);
    const [imageFile, setImageFile] = useState<File|null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string|null>(null);
    const [videoUrl, setVideoUrl] = useState<string|null>(null);
    const [loadingMessage, setLoadingMessage] = useState(VEO_LOADING_MESSAGES[0]);

    useEffect(() => {
        const checkApiKey = async () => {
            if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
                setApiKeySelected(true);
            }
        };
        checkApiKey();
    }, []);

    useEffect(() => {
        let interval: number;
        if (isLoading) {
            interval = window.setInterval(() => {
                setLoadingMessage(prev => {
                    const currentIndex = VEO_LOADING_MESSAGES.indexOf(prev);
                    return VEO_LOADING_MESSAGES[(currentIndex + 1) % VEO_LOADING_MESSAGES.length];
                });
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isLoading]);

    const handleSelectKey = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            // Assume success to avoid race condition and allow user to proceed.
            setApiKeySelected(true);
        }
    };
    
    const handleSubmit = async () => {
        if (!prompt && !imageFile) {
            setError('Please provide a prompt or an initial image.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setVideoUrl(null);
        setLoadingMessage(VEO_LOADING_MESSAGES[0]);

        try {
            let imagePayload;
            if (imageFile) {
                const base64 = await fileToBase64(imageFile);
                imagePayload = { base64, mimeType: imageFile.type };
            }

            let operation: Operation = await generateVideo(prompt, aspectRatio, imagePayload);
            
            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                operation = await checkVideoStatus(operation);
            }
            
            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
                const blob = await fetchVideoBlob(downloadLink);
                setVideoUrl(URL.createObjectURL(blob));
            } else {
                throw new Error("Video generation completed, but no download link was found.");
            }

        } catch (err: any) {
            let message = 'An error occurred during video generation.';
            if(err.message?.includes("Requested entity was not found")) {
                message = "API Key not found or invalid. Please select a valid key.";
                setApiKeySelected(false); // Reset key state
            }
            setError(message);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!apiKeySelected) {
        return (
             <div className="text-center p-8 bg-slate-700 rounded-lg">
                <h3 className="text-xl font-semibold mb-4">API Key Required for Video Generation</h3>
                <p className="text-slate-300 mb-6">Veo video generation requires a user-provided API key. Please select a key to continue.</p>
                <button onClick={handleSelectKey} className="bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-600 transition-colors">Select API Key</button>
                <p className="text-xs text-slate-400 mt-4">For more information, see the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-300">billing documentation</a>.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="e.g., A neon hologram of a cat driving at top speed"
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white h-24 resize-none"
            />
            <FileUpload onFileUpload={setImageFile} accept="image/*" label="Optionally, upload a starting image"/>
            <div className="flex flex-wrap gap-2">
                {VIDEO_ASPECT_RATIOS.map(ar => (
                    <button key={ar} onClick={() => setAspectRatio(ar)} className={`px-3 py-1 text-xs font-medium rounded-full ${aspectRatio === ar ? 'bg-indigo-500 text-white' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'}`}>{ar}</button>
                ))}
            </div>
            <button onClick={handleSubmit} disabled={isLoading} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:from-indigo-600 hover:to-purple-700 transition duration-300 disabled:opacity-50">
                Generate Video
            </button>
            {isLoading && <Spinner text={loadingMessage} />}
            {error && <p className="text-red-400">{error}</p>}
            {videoUrl && <video src={videoUrl} controls className="mt-4 rounded-lg w-full max-w-lg mx-auto" />}
        </div>
    );
};

export default CreativeStudio;
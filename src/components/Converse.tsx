import React, { useState, useRef, useEffect } from 'react';
import { sendMessageToChatbot, transcribeAudio } from '../services/geminiService';
import Spinner from './common/Spinner';
import { ChatMessage } from '../types';
import useGeolocation from '../hooks/useGeolocation';


type ConverseMode = 'live' | 'transcribe' | 'chat';

const Converse: React.FC = () => {
    const [mode, setMode] = useState<ConverseMode>('chat');
    
    const TabButton = ({ currentMode, label }: { currentMode: ConverseMode; label: string }) => (
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
        <div className="max-w-4xl mx-auto p-6 bg-slate-800/50 rounded-2xl shadow-2xl shadow-indigo-900/20 border border-slate-700">
            <h2 className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300 mb-2">Converse with AI</h2>
            <p className="text-center text-slate-400 mb-8">Engage in real-time conversations, transcribe audio, or chat with a helpful assistant.</p>
            
            <div className="flex justify-center gap-2 mb-8">
                <TabButton currentMode="chat" label="ChatBot" />
                <TabButton currentMode="live" label="Live Chat" />
                <TabButton currentMode="transcribe" label="Transcriber" />
            </div>

            {mode === 'chat' && <ChatBot />}
            {mode === 'live' && <LiveChat />}
            {mode === 'transcribe' && <AudioTranscriber />}
        </div>
    );
};


const LiveChat: React.FC = () => {
    // NOTE: The Live API (ai.live.connect) establishes a long-lived, stateful WebSocket-like connection
    // and cannot be proxied through a standard stateless serverless function like the other API calls in this app.
    // For security reasons, the API key is not exposed to the client-side. Therefore, this feature is
    // disabled in this deployment environment. It is intended for demonstration purposes in secure
    // environments like AI Studio where client-side API key management is handled.
    const explanation = "The Live Chat feature cannot be used in this web environment due to the technical requirements of establishing a direct, secure connection and the security risks of exposing API keys on the client-side. This feature is for demonstration purposes only.";

    return (
        <div className="space-y-4">
            <div className="text-center p-4 bg-slate-700/50 border border-slate-600 rounded-lg">
                <h3 className="text-lg font-semibold text-slate-300 mb-2">Live Chat Unavailable</h3>
                <p className="text-slate-400 text-sm">{explanation}</p>
            </div>
            <div className="flex justify-center">
                <button disabled className="bg-slate-600 text-slate-400 font-bold py-3 px-6 rounded-lg cursor-not-allowed">Start Conversation</button>
            </div>
            <div className="h-64 overflow-y-auto p-4 bg-slate-900 rounded-lg border border-slate-700 flex items-center justify-center">
                <p className="text-slate-500">Live transcription would appear here.</p>
            </div>
        </div>
    );
};


const AudioTranscriber: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder|null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        setTranscription('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
            mediaRecorderRef.current.onstop = handleTranscription;
            audioChunksRef.current = [];
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Failed to start recording:", err);
            setTranscription('Could not start recording. Please check microphone permissions.');
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        // Stop all media tracks to turn off the microphone indicator
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setIsLoading(true);
    };
    
    const handleTranscription = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {type: 'audio/webm'});
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            try {
                const response = await transcribeAudio(base64, 'audio/webm');
                setTranscription(response.text);
            } catch (error) {
                console.error("Transcription error:", error);
                setTranscription('Error transcribing audio.');
            } finally {
                setIsLoading(false);
            }
        };
    };

    return (
        <div className="space-y-4 text-center">
            <button onClick={isRecording ? stopRecording : startRecording} className={`font-bold py-3 px-6 rounded-lg text-white ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`}>
                {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
            {isLoading && <Spinner text="Transcribing..."/>}
            {transcription && <p className="p-4 bg-slate-900 rounded-lg text-left">{transcription}</p>}
        </div>
    );
};

const ChatBot: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [useGrounding, setUseGrounding] = useState(false);
    const [useThinking, setUseThinking] = useState(false);
    const [useMaps, setUseMaps] = useState(false);
    const geolocation = useGeolocation();
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    const sendMessage = async () => {
        if (!input.trim()) return;
        
        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        
        try {
            const response = await sendMessageToChatbot(input, useGrounding, useThinking, useMaps, geolocation.data?.latitude, geolocation.data?.longitude);
            const modelMessage: ChatMessage = {
                role: 'model',
                text: response.text,
                groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks
            };
            setMessages(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error(error);
            const errorMessage: ChatMessage = { role: 'model', text: 'Sorry, I encountered an error.' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[70vh]">
            <div className="flex-grow overflow-y-auto p-4 bg-slate-900 rounded-t-lg border border-b-0 border-slate-700 space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-4 py-2 rounded-xl ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-600 text-slate-200'}`}>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-500">
                                    <h4 className="text-xs font-semibold text-slate-300 mb-1">Sources:</h4>
                                    <ul className="text-xs space-y-1">
                                    {msg.groundingChunks.map((chunk, i) => {
                                        const source = chunk.web || chunk.maps;
                                        if (!source || !source.uri) return null;

                                        // Handle Maps review snippets
                                        if (chunk.maps?.placeAnswerSources?.reviewSnippets) {
                                            return (
                                                <li key={i}>
                                                    <a href={source.uri} target="_blank" rel="noreferrer" className="text-indigo-300 hover:underline break-all block">{source.title || 'Google Maps Source'}</a>
                                                    <ul className="pl-3 list-disc list-inside">
                                                        {chunk.maps.placeAnswerSources.reviewSnippets.map((snippet: any, j: number) => (
                                                            <li key={`${i}-${j}`} className="text-slate-400 italic">"{snippet.text}"</li>
                                                        ))}
                                                    </ul>
                                                </li>
                                            );
                                        }

                                        return <li key={i}><a href={source.uri} target="_blank" rel="noreferrer" className="text-indigo-300 hover:underline break-all">{source.title || source.uri}</a></li>;
                                    })}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && <div className="flex justify-start"><Spinner text="Thinking..." /></div>}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-2 bg-slate-800 border-t border-slate-700 rounded-b-lg">
                <div className="flex flex-wrap gap-2 md:gap-4 justify-center mb-2">
                    <label className="flex items-center space-x-2 cursor-pointer text-sm text-slate-300">
                        <input type="checkbox" checked={useGrounding} onChange={e => setUseGrounding(e.target.checked)} className="form-checkbox h-4 w-4 text-indigo-600 bg-slate-700 border-slate-500 rounded focus:ring-indigo-500"/>
                        <span>Google Search</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer text-sm text-slate-300">
                        <input type="checkbox" checked={useMaps} onChange={e => setUseMaps(e.target.checked)} className="form-checkbox h-4 w-4 text-indigo-600 bg-slate-700 border-slate-500 rounded focus:ring-indigo-500"/>
                        <span>Google Maps</span>
                    </label>
                     <label className="flex items-center space-x-2 cursor-pointer text-sm text-slate-300">
                        <input type="checkbox" checked={useThinking} onChange={e => setUseThinking(e.target.checked)} className="form-checkbox h-4 w-4 text-indigo-600 bg-slate-700 border-slate-500 rounded focus:ring-indigo-500"/>
                        <span>Deep Thinking</span>
                    </label>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && !isLoading && sendMessage()}
                        placeholder="Ask anything..."
                        className="flex-grow bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                        disabled={isLoading}
                    />
                    <button onClick={sendMessage} disabled={isLoading} className="bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-600 disabled:opacity-50">Send</button>
                </div>
            </div>
        </div>
    );
};


export default Converse;


import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality } from '@google/genai';
import { sendMessageToChatbot } from '../services/geminiService';
import { createPcmBlob, decode, decodeAudioData } from '../utils/helpers';
import Spinner from './common/Spinner';
import { ChatMessage } from '../types';
import { MODELS } from '../constants';
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
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [transcription, setTranscription] = useState<Array<{speaker: 'user' | 'model', text: string}>>([]);
    const [error, setError] = useState<string|null>(null);
    
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const startSession = async () => {
        setError(null);
        try {
            if (!process.env.API_KEY) throw new Error("API key not configured");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            let currentInput = '';
            let currentOutput = '';
            
            sessionPromiseRef.current = ai.live.connect({
                model: MODELS.LIVE,
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {
                        setIsSessionActive(true);
                        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                        sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current!);
                        processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        processorRef.current.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createPcmBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        
                        sourceRef.current.connect(processorRef.current);
                        processorRef.current.connect(audioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            currentInput += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentOutput += message.serverContent.outputTranscription.text;
                        }
                        if (message.serverContent?.turnComplete) {
                            setTranscription(prev => [...prev, {speaker: 'user', text: currentInput}, {speaker: 'model', text: currentOutput}]);
                            currentInput = '';
                            currentOutput = '';
                        }

                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData) {
                            if (!outputAudioContextRef.current) {
                                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
                            }
                            const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContextRef.current, 24000, 1);
                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current.destination);
                            source.start();
                        }
                    },
                    onerror: (e) => {
                        console.error('Live session error:', e);
                        setError("A connection error occurred.");
                        stopSession();
                    },
                    onclose: () => {
                        stopSession();
                    }
                }
            });
        } catch (err) {
            console.error(err);
            setError("Failed to start session. Check microphone permissions.");
        }
    };

    const stopSession = useCallback(() => {
        sessionPromiseRef.current?.then(session => session.close());
        
        streamRef.current?.getTracks().forEach(track => track.stop());
        sourceRef.current?.disconnect();
        processorRef.current?.disconnect();
        audioContextRef.current?.close();

        setIsSessionActive(false);
        sessionPromiseRef.current = null;
    }, []);

    useEffect(() => {
      // Cleanup on unmount
      return () => {
        if(isSessionActive) {
          stopSession();
        }
      }
    }, [isSessionActive, stopSession]);

    return (
        <div className="space-y-4">
            <div className="flex justify-center">
            {isSessionActive ? (
                <button onClick={stopSession} className="bg-red-600 text-white font-bold py-3 px-6 rounded-lg">Stop Conversation</button>
            ) : (
                <button onClick={startSession} className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg">Start Conversation</button>
            )}
            </div>
             {error && <p className="text-red-400 text-center">{error}</p>}
            <div className="h-64 overflow-y-auto p-4 bg-slate-900 rounded-lg border border-slate-700 space-y-3">
                {transcription.map((entry, index) => (
                    <div key={index} className={`flex ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <p className={`max-w-[80%] px-4 py-2 rounded-xl ${entry.speaker === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-600 text-slate-200'}`}>{entry.text}</p>
                    </div>
                ))}
                {isSessionActive && !transcription.length && <p className="text-slate-400 text-center">Listening...</p>}
            </div>
        </div>
    );
};


const AudioTranscriber: React.FC = () => {
    // This is a simplified version. A real implementation would stream audio.
    // For this app, we'll record a short clip and transcribe.
    const [isRecording, setIsRecording] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder|null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        setTranscription('');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
        mediaRecorderRef.current.onstop = transcribe;
        audioChunksRef.current = [];
        mediaRecorderRef.current.start();
        setIsRecording(true);
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        setIsLoading(true);
    };
    
    const transcribe = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {type: 'audio/webm'});
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            try {
                // This is a workaround as Gemini API expects a specific format.
                // A more robust solution would use a dedicated transcription API or process the audio differently.
                // For now, we tell Gemini what to do.
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
                const response = await ai.models.generateContent({
                    model: MODELS.FLASH,
                    contents: { parts: [{inlineData: {data: base64, mimeType: 'audio/webm'}}, {text: 'Transcribe this audio.'}] }
                });
                setTranscription(response.text);
            } catch (error) {
                setTranscription('Error transcribing audio.');
            } finally {
                setIsLoading(false);
            }
        };
    };

    return (
        <div className="space-y-4 text-center">
            <button onClick={isRecording ? stopRecording : startRecording} className={`font-bold py-3 px-6 rounded-lg text-white ${isRecording ? 'bg-red-500' : 'bg-blue-500'}`}>
                {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
            {isLoading && <Spinner text="Transcribing..."/>}
            {transcription && <p className="p-4 bg-slate-900 rounded-lg">{transcription}</p>}
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
                            <p>{msg.text}</p>
                            {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-500">
                                    <h4 className="text-xs font-semibold text-slate-300 mb-1">Sources:</h4>
                                    <ul className="text-xs space-y-1">
                                    {msg.groundingChunks.map((chunk, i) => {
                                        const source = chunk.web || chunk.maps;
                                        return source?.uri ? <li key={i}><a href={source.uri} target="_blank" rel="noreferrer" className="text-indigo-300 hover:underline break-all">{source.title || source.uri}</a></li> : null
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

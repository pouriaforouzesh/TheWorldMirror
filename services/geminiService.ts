// Fix: Import GenerateContentParameters for chatbot request type
import { GoogleGenAI, GenerateContentResponse, Modality, Operation, GenerateImagesResponse, GenerateContentParameters } from "@google/genai";
import { MODELS } from '../constants';

// Helper to call our secure proxy endpoint
const callProxy = async (operation: string, params: any): Promise<any> => {
    // For fetching video, we expect a Blob, not JSON
    const isFetchingVideo = operation === 'fetchVideo';

    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, params }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'An unknown server error occurred.' }));
        // Re-throw in a way that withRetry can understand, mimicking the original error format
        throw new Error(JSON.stringify({ error: { status: 'PROXY_ERROR', message: errorData.message } }));
    }
    
    if (isFetchingVideo) {
        return response.blob();
    }
    
    return response.json();
};

const withRetry = <T extends (...args: any[]) => Promise<any>>(fn: T): T => {
    return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
        let attempts = 0;
        const maxAttempts = 3;
        const initialDelay = 1000; // 1 second initial delay

        while (attempts < maxAttempts) {
            try {
                return await fn(...args);
            } catch (err: any) {
                let errorJson;
                try {
                    // The error message from the SDK is often a JSON string of the API response
                    errorJson = JSON.parse(err.message);
                } catch (e) {
                    // Check if it's a fetch error from our proxy
                    if(err.message?.includes("Failed to fetch")) {
                         throw new Error("The model is currently overloaded. Please try again later.");
                    }
                    // If parsing fails, it's not the error we're looking for, rethrow
                    throw err;
                }

                const status = errorJson?.error?.status;
                const isRateLimit = status === 'RESOURCE_EXHAUSTED';
                const isOverloaded = status === 'UNAVAILABLE';

                if (isRateLimit || isOverloaded) {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        if (isRateLimit) throw new Error("API quota exceeded. Please check your plan and billing details or try again later.");
                        throw new Error("The model is currently overloaded. Please try again later.");
                    }
                    
                    let delay = initialDelay * Math.pow(2, attempts - 1); // Default exponential backoff

                    // For rate limit errors, check if the API suggests a specific retry delay
                    if (isRateLimit) {
                        const retryInfo = errorJson?.error?.details?.find(
                            (d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
                        );
                        if (retryInfo?.retryDelay) {
                            // The delay is in the format "28s"
                            const seconds = parseInt(retryInfo.retryDelay.replace('s', ''), 10);
                            if (!isNaN(seconds)) {
                                // Use suggested delay plus a small buffer to be safe
                                delay = seconds * 1000 + 500; 
                            }
                        }
                    }

                    const message = isRateLimit ? "Rate limit exceeded" : "Model overloaded";
                    console.log(`${message}. Retrying in ${delay}ms... (Attempt ${attempts}/${maxAttempts})`);
                    await new Promise(resolve => setTimeout(resolve, delay));

                } else {
                    throw err; // Rethrow other errors immediately
                }
            }
        }
        // This should not be reachable, but is needed for TypeScript to be happy.
        throw new Error("Retry logic failed unexpectedly.");
    }) as T;
};


// --- ALL SERVICES NOW PROXIED ---

// Fortune Telling (Birth Date)
export const getFortune = withRetry(async (prompt: string): Promise<GenerateContentResponse> => {
    return callProxy('generateContent', {
        model: MODELS.FLASH,
        contents: prompt,
    });
});

// Fortune Telling (Image)
export const readPalmOrFace = withRetry(async (imageBase64: string, mimeType: string, prompt: string): Promise<GenerateContentResponse> => {
    const imagePart = { inlineData: { data: imageBase64, mimeType } };
    const textPart = { text: prompt };
    return callProxy('generateContent', {
        model: MODELS.FLASH, // Using FLASH for consistency with text-based fortune
        contents: { parts: [imagePart, textPart] },
    });
});

export const generateImage = withRetry(async (prompt: string, aspectRatio: string): Promise<GenerateImagesResponse> => {
    const params = {
        model: MODELS.IMAGEN,
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: aspectRatio,
        },
    };
    try {
        return await callProxy('generateImages', params);
    } catch(err: any) {
        if (err.message?.includes("only accessible to billed users")) {
            throw new Error("IMAGEN_BILLING_REQUIRED");
        }
        throw err;
    }
});

export const generateImageWithFlash = withRetry(async (prompt: string): Promise<GenerateContentResponse> => {
    return callProxy('generateContent', {
        model: MODELS.FLASH_IMAGE,
        contents: {
            parts: [{ text: prompt }],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
});

export const generateVideo = withRetry(async (prompt: string, aspectRatio: string, image?: { base64: string; mimeType: string }): Promise<Operation> => {
    const params: any = {
        model: MODELS.VEO,
        prompt: prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio,
        }
    };
    if (image) {
        params.image = {
            imageBytes: image.base64,
            mimeType: image.mimeType,
        };
    }
    return callProxy('generateVideos', params);
});

export const checkVideoStatus = withRetry(async (operation: Operation): Promise<Operation> => {
    return callProxy('getVideosOperation', { operation: operation });
});

export const fetchVideoBlob = withRetry(async (url: string): Promise<Blob> => {
    return callProxy('fetchVideo', { url });
});

export const textToSpeech = withRetry(async (text: string): Promise<GenerateContentResponse> => {
    return callProxy('generateContent', {
        model: MODELS.TTS,
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' }, // A deep, mystical voice
                },
            },
        },
    });
});

export const getDailyAdvice = withRetry(async (prompt: string): Promise<GenerateContentResponse> => {
    return callProxy('generateContent', {
        model: MODELS.FLASH,
        contents: prompt,
    });
});

export const editImage = withRetry(async (imageBase64: string, mimeType: string, prompt: string): Promise<GenerateContentResponse> => {
    const imagePart = {
        inlineData: { data: imageBase64, mimeType },
    };
    const textPart = {
        text: prompt
    };
    return callProxy('generateContent', {
        model: MODELS.FLASH_IMAGE,
        contents: { parts: [imagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
});

export const analyzeVideo = withRetry(async (videoBase64: string, mimeType: string, prompt: string): Promise<GenerateContentResponse> => {
    const videoPart = {
        inlineData: { data: videoBase64, mimeType },
    };
    const textPart = {
        text: prompt
    };
    return callProxy('generateContent', {
        model: MODELS.PRO, // Gemini Pro supports video analysis
        contents: { parts: [videoPart, textPart] },
    });
});

export const sendMessageToChatbot = withRetry(async (
    prompt: string,
    useGrounding: boolean,
    useThinking: boolean,
    useMaps: boolean,
    latitude?: number,
    longitude?: number
): Promise<GenerateContentResponse> => {
    const request: GenerateContentParameters = {
        model: MODELS.PRO,
        contents: prompt,
        config: {}
    };

    if (useThinking) {
        request.config!.thinkingConfig = { thinkingBudget: 32768 };
    }

    const tools: any[] = [];
    if (useGrounding) {
        tools.push({ googleSearch: {} });
    }
    if (useMaps) {
        tools.push({ googleMaps: {} });
    }

    if (tools.length > 0) {
        request.config!.tools = tools;
    }
    
    if (useMaps && latitude && longitude) {
        request.config!.toolConfig = {
            retrievalConfig: {
                latLng: {
                    latitude,
                    longitude
                }
            }
        };
    }

    return callProxy('generateContent', request);
});

export const transcribeAudio = withRetry(async (audioBase64: string, mimeType: string): Promise<GenerateContentResponse> => {
    return callProxy('generateContent', {
        model: MODELS.FLASH,
        contents: { parts: [{inlineData: {data: audioBase64, mimeType}}, {text: 'Transcribe this audio.'}] }
    });
});

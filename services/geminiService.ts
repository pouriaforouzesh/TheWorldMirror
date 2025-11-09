// Fix: Import GenerateContentParameters for chatbot request type
import { GoogleGenAI, GenerateContentResponse, Modality, Operation, GenerateImagesResponse, GenerateContentParameters } from "@google/genai";
import { MODELS } from '../constants';

const getAiClient = () => {
    // We create a new client for each call to ensure the most recent API key is used,
    // especially important for Veo video generation where the key might be selected mid-session.
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
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

// Fortune Telling
export const getFortune = withRetry(async (prompt: string): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    return ai.models.generateContent({
        model: MODELS.FLASH,
        contents: prompt,
    });
});

export const readPalmOrFace = withRetry(async (imageBase64: string, mimeType: string, prompt: string): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    const imagePart = {
        inlineData: { data: imageBase64, mimeType },
    };
    const textPart = {
        text: prompt
    };
    return ai.models.generateContent({
        model: MODELS.FLASH,
        contents: { parts: [imagePart, textPart] },
    });
});

export const generateImage = withRetry(async (prompt: string, aspectRatio: string): Promise<GenerateImagesResponse> => {
    const ai = getAiClient();
    try {
        return await ai.models.generateImages({
            model: MODELS.IMAGEN,
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: aspectRatio,
            },
        });
    } catch(err: any) {
        if (err.message?.includes("only accessible to billed users")) {
            throw new Error("IMAGEN_BILLING_REQUIRED");
        }
        throw err;
    }
});

export const generateImageWithFlash = withRetry(async (prompt: string): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    return ai.models.generateContent({
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
    const ai = getAiClient();
    const requestPayload: any = {
        model: MODELS.VEO,
        prompt: prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio,
        }
    };
    if (image) {
        requestPayload.image = {
            imageBytes: image.base64,
            mimeType: image.mimeType,
        };
    }
    return ai.models.generateVideos(requestPayload);
});

export const checkVideoStatus = withRetry(async (operation: Operation): Promise<Operation> => {
    const ai = getAiClient();
    return ai.operations.getVideosOperation({ operation: operation });
});


export const textToSpeech = withRetry(async (text: string): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    return ai.models.generateContent({
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

// For Premium Advice
export const getDailyAdvice = withRetry(async (prompt: string): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    return ai.models.generateContent({
        model: MODELS.FLASH, // Changed to Flash to be more lenient on free tier quotas
        contents: prompt,
    });
});

// Fix: Add editImage function for Creative Studio
export const editImage = withRetry(async (imageBase64: string, mimeType: string, prompt: string): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    const imagePart = {
        inlineData: { data: imageBase64, mimeType },
    };
    const textPart = {
        text: prompt
    };
    return ai.models.generateContent({
        model: MODELS.FLASH_IMAGE,
        contents: { parts: [imagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
});

// Fix: Add analyzeVideo function for Media Analyzer
export const analyzeVideo = withRetry(async (videoBase64: string, mimeType: string, prompt: string): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    const videoPart = {
        inlineData: { data: videoBase64, mimeType },
    };
    const textPart = {
        text: prompt
    };
    return ai.models.generateContent({
        model: MODELS.PRO, // Gemini Pro supports video analysis
        contents: { parts: [videoPart, textPart] },
    });
});

// Fix: Add sendMessageToChatbot for Converse component
export const sendMessageToChatbot = withRetry(async (
    prompt: string,
    useGrounding: boolean,
    useThinking: boolean,
    useMaps: boolean,
    latitude?: number,
    longitude?: number
): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
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

    return ai.models.generateContent(request);
});
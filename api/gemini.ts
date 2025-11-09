import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";
import { Readable } from 'stream';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { operation, params } = req.body;
        let result: any;

        switch (operation) {
            case 'generateContent':
                result = await ai.models.generateContent(params);
                break;
            case 'generateImages':
                result = await ai.models.generateImages(params);
                break;
            case 'generateVideos':
                result = await ai.models.generateVideos(params);
                break;
            case 'getVideosOperation':
                result = await ai.operations.getVideosOperation(params);
                break;
            case 'fetchVideo': {
                 const { url } = params;
                 if (!url) {
                    return res.status(400).json({ message: 'URL is required.' });
                 }
                 const videoUrl = `${url}&key=${process.env.API_KEY}`;
                 const response = await fetch(videoUrl);

                 if (!response.ok || !response.body) {
                     const errorText = await response.text();
                     console.error("Fetch video error:", errorText);
                     throw new Error(`Failed to fetch video: ${response.statusText}`);
                 }
                 
                 res.setHeader('Content-Type', response.headers.get('Content-Type') || 'video/mp4');
                 // Fix: Cannot find namespace 'NodeJS'.
                 // The original code was attempting to cast a web stream to a Node.js stream,
                 // which caused a type error because Node.js types were not available.
                 // We now correctly convert the web stream to a Node.js stream to pipe it.
                 const nodeStream = Readable.fromWeb(response.body);
                 nodeStream.pipe(res);
                 return; // End response by piping
            }
            default:
                return res.status(400).json({ message: `Unknown operation: ${operation}` });
        }
        
        return res.status(200).json(result);

    } catch (error: any) {
        console.error(`Error in proxy for operation '${req.body.operation}':`, error);
        let errorMessage = 'An internal server error occurred.';
        // Attempt to parse Gemini's structured error
        try {
            // Error from SDK might be a JSON string in the message property
            const errorObj = JSON.parse(error.message);
            if (errorObj?.error?.message) {
                errorMessage = errorObj.error.message;
            } else {
                 errorMessage = error.message;
            }
        } catch (e) {
            errorMessage = error.message || 'An unknown error occurred';
        }
        return res.status(500).json({ message: errorMessage });
    }
}

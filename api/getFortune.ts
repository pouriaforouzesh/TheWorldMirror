// File: /api/getFortune.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const MODELS = {
  FLASH: 'gemini-2.5-flash',
};

// IMPORTANT: This function runs on the server, NOT the browser.
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // We only allow POST requests for this endpoint
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  try {
    const { prompt, imageBase64, mimeType } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    // Securely get the API key from Vercel's environment variables
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'API key not configured on the server' });
    }

    const ai = new GoogleGenAI({ apiKey });

    let responseText = '';

    if (imageBase64 && mimeType) {
      // This is a palm/face reading request
      const imagePart = { inlineData: { data: imageBase64, mimeType } };
      const textPart = { text: prompt };
      const result = await ai.models.generateContent({
        model: MODELS.FLASH,
        contents: { parts: [imagePart, textPart] },
      });
      responseText = result.text;
    } else {
      // This is a birth date request
      const result = await ai.models.generateContent({
        model: MODELS.FLASH,
        contents: prompt,
      });
      responseText = result.text;
    }

    // Send the successful response back to the browser
    return res.status(200).json({ text: responseText });

  } catch (error: any) {
    console.error('Error in serverless function:', error);
    // Send a generic error response
    return res.status(500).json({ message: 'An error occurred while contacting the celestial servers.' });
  }
}
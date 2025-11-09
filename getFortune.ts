// getFortune.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Cette fonction interroge l'API Gemini pour générer une "lecture céleste"
 * en fonction de la date de naissance et/ou d'une image.
 */
export async function getFortune(birthDate: string, imageBase64?: string, name?: string) {
  try {
    // Récupère la clé API depuis les variables d'environnement Vite
    const apiKey = import.meta.env.VITE_API_KEY;

    if (!apiKey) {
      throw new Error("VITE_API_KEY environment variable not set");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Construction du prompt
    let prompt = `You are an AI oracle. Give a short, poetic fortune. Birth date: ${birthDate}.`;
    if (name) prompt += ` The person's name is ${name}.`;
    if (imageBase64) prompt += ` They have uploaded an image for palm or face reading.`;

    // Appel du modèle avec ou sans image
    let result;
    if (imageBase64) {
      result = await model.generateContent([
        { inlineData: { data: imageBase64, mimeType: "image/png" } },
        { text: prompt },
      ]);
    } else {
      result = await model.generateContent(prompt);
    }

    // Retourne le texte généré
    const fortune = result.response.text();
    return fortune || "The stars are quiet for now. Try again later.";
  } catch (err: any) {
    console.error("Error fetching fortune:", err);
    return "The stars are clouded right now. Please try again later.";
  }
}

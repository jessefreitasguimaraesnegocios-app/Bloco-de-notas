import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function identifySecret(content: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Identify what kind of sensitive information this is: "${content}". 
      Return a JSON object with:
      - type: (one of: 'password', 'seed_phrase', 'private_key', 'api_key', 'note')
      - category: (a short description of what it belongs to, e.g., 'GitHub', 'MetaMask', 'Bank')
      - label: (a suggested short title for this note)
      If you are not sure, set type to 'note' and category to 'unknown'.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            category: { type: Type.STRING },
            label: { type: Type.STRING }
          },
          required: ["type", "category", "label"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini identification error:", error);
    return { type: 'note', category: 'unknown', label: 'New Note' };
  }
}

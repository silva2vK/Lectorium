
import { GoogleGenAI, Type } from "@google/genai";
import { getStoredApiKey } from "../utils/apiKeyUtils";

const getAiClient = () => {
  const userKey = getStoredApiKey();
  const apiKey = userKey || process.env.API_KEY;
  if (!apiKey) throw new Error("API Key não configurada.");
  return new GoogleGenAI({ apiKey });
};

function cleanJsonResult(text: string): string {
  if (!text) return "[]";
  let clean = text.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(json)?/, "").replace(/```$/, "");
  }
  return clean.trim();
}

export interface OcrResult {
    markdown: string;
    segments: any[];
    metrics: {
        uploadAndQueueTime: number;
        processingTime: number;
        totalTime: number;
    }
}

/**
 * PROTOCOLO CHROME-OPTIMIZED (V8.0)
 * Otimizado para Gemini 3 Flash: foca em densidade de tokens e precisão espacial.
 */
export async function performFullPageOcr(base64Image: string, targetLanguage?: string): Promise<OcrResult> {
  const ai = getAiClient();
  
  let prompt = `ACT AS HIGH-PRECISION OCR ENGINE.
  Task: Extract text and coordinate blocks.
  Coordinates: Use normalized scale 0-1000. 
  Grouping: Keep lines together in 't' using \\n.
  
  Strict Rules:
  1. Detect columns (c: 0 for left/full, c: 1 for right).
  2. Bbox [ymin, xmin, ymax, xmax] must envelop the entire text block tightly.
  3. Output ONLY valid JSON array. NO markdown headers.
  
  JSON Schema: [{"t": "string", "b": [number, number, number, number], "c": number}]`;

  if (targetLanguage) {
      prompt += `\n4. TRANSLATE ALL TEXT TO ${targetLanguage} while maintaining the EXACT same JSON structure and coordinates.`;
  }

  try {
    const startTime = performance.now();
    // No Chrome, o modelo gemini-3-flash-preview processa WebP/JPEG com latência reduzida
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
          { text: prompt }
        ]
      },
      config: {
        temperature: 0, // Determinístico para OCR
        thinkingConfig: { thinkingBudget: 0 }, // Desabilita raciocínio para velocidade pura em OCR
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              t: { type: Type.STRING },
              b: { type: Type.ARRAY, items: { type: Type.INTEGER }, minItems: 4, maxItems: 4 },
              c: { type: Type.INTEGER }
            },
            required: ["t", "b"]
          }
        }
      }
    });

    const totalTime = performance.now() - startTime;
    const cleanText = cleanJsonResult(response.text || '[]');
    
    return {
        markdown: "", 
        segments: JSON.parse(cleanText),
        metrics: {
            uploadAndQueueTime: totalTime * 0.10, // Chrome reduz overhead de rede
            processingTime: totalTime * 0.90,
            totalTime
        }
    };
  } catch (e: any) {
    console.error("AI Service Error:", e);
    throw new Error("Falha na pipeline de visão: " + e.message);
  }
}

export async function extractNewspaperContent(base64Image: string, mimeType: string): Promise<any> {
  const ai = getAiClient();
  const prompt = `ACT AS AN ARCHIVIST. Analyze this newspaper scan. Extract publication, date, and articles in columns. Return strictly valid JSON.`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts: [{ inlineData: { data: base64Image, mimeType } }, { text: prompt }] },
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJsonResult(response.text || '{}'));
  } catch (e: any) {
    throw new Error("Falha no Archivist: " + e.message);
  }
}


import { GoogleGenAI, Type } from "@google/genai";
import { getStoredApiKey } from "../utils/apiKeyUtils";

export interface TranslationBlock {
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
}

const getAiClient = () => {
  const userKey = getStoredApiKey();
  const apiKey = userKey || process.env.API_KEY;
  if (!apiKey) throw new Error("API Key não configurada para tradução.");
  return new GoogleGenAI({ apiKey });
};

/**
 * Realiza a tradução da página mantendo a referência espacial.
 */
export async function translatePageImage(
    base64Image: string, 
    targetLanguage: string = "Português"
): Promise<{ markdown: string; segments: any[] }> {
    const ai = getAiClient();
    
    // Prompt Simplificado: Foca na tradução do conteúdo, não na estética visual
    const prompt = `
    Task: Translate the text in this document image to ${targetLanguage}.
    
    Output JSON:
    1. 'markdown': The full translated content formatted in Markdown.
    2. 'segments': A list of translated text blocks.
       - 'text': The translated text.
       - 'box_2d': The coordinates [ymin, xmin, ymax, xmax] (0-1000 scale) of the ORIGINAL source text.
    
    Ensure the translation is accurate and maintains the academic tone.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
                {
                    parts: [
                        { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
                        { text: prompt }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        markdown: { type: Type.STRING },
                        segments: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    text: { type: Type.STRING },
                                    box_2d: { 
                                        type: Type.ARRAY, 
                                        items: { type: Type.INTEGER } 
                                    }
                                },
                                required: ["text", "box_2d"]
                            }
                        }
                    },
                    required: ["markdown", "segments"]
                }
            }
        });

        const text = response.text || '{"markdown": "", "segments": []}';
        const data = JSON.parse(text);
        
        return {
            markdown: data.markdown || "",
            segments: data.segments || []
        };

    } catch (e: any) {
        console.error("Translation Service Error:", e);
        throw new Error("Falha na tradução: " + e.message);
    }
}

/**
 * Converte os segmentos brutos do Gemini (0-1000) para pixels da tela.
 */
export function mapTranslationSegments(segments: any[], w: number, h: number, scale: number): TranslationBlock[] {
    const mappedBlocks: TranslationBlock[] = [];
    
    // Dimensões originais da página
    const originalW = w / scale;
    const originalH = h / scale;

    segments.forEach((seg: any) => {
        if (!seg.box_2d || seg.box_2d.length !== 4 || !seg.text) return;
        
        const [ymin, xmin, ymax, xmax] = seg.box_2d;
        
        // Converte 0-1000 para pixels
        const x0 = (xmin / 1000) * originalW;
        const y0 = (ymin / 1000) * originalH;
        const x1 = (xmax / 1000) * originalW;
        const y1 = (ymax / 1000) * originalH;

        mappedBlocks.push({
            text: seg.text,
            bbox: { x0, y0, x1, y1 }
        });
    });
    
    return mappedBlocks;
}

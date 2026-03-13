
import { GoogleGenAI, Type } from "@google/genai";
import { getStoredApiKey } from "../utils/apiKeyUtils";

// Singleton memoizado por chave — evita recriar instância a cada página de OCR em lote.
// Para um documento de 50 páginas, elimina 49 instanciações desnecessárias do SDK.
// Invalidado automaticamente quando a chave muda (usuário reconfigura no ApiKeyModal).
let _cachedClient: { key: string; instance: GoogleGenAI } | null = null;

const getAiClient = (): GoogleGenAI => {
  const apiKey = getStoredApiKey();
  if (!apiKey) throw new Error("API Key não configurada. Configure em Configurações → Chaves de API.");
  if (_cachedClient?.key === apiKey) return _cachedClient.instance;
  _cachedClient = { key: apiKey, instance: new GoogleGenAI({ apiKey }) };
  return _cachedClient.instance;
};

/**
 * Remove markdown fences do retorno do modelo.
 * Usa flag /m para ancorar no início de linha — cobre casos onde o modelo
 * inclui texto ou espaços antes do bloco JSON, causando JSON.parse errors esporádicos.
 */
function cleanJsonResult(text: string): string {
  if (!text) return "[]";
  return text.trim().replace(/^```[\w]*\n?/m, "").replace(/```\s*$/m, "").trim();
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
 *
 * Retry de quota (429): tratado pelo orquestrador (backgroundOcrService.runBackgroundOcr),
 * que interrompe o lote e chama onQuotaExceeded. Não duplicar retry aqui.
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
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
          { text: prompt }
        ]
      },
      config: {
        temperature: 0, // Determinístico — OCR não se beneficia de variação
        // thinkingBudget: 0 desabilita raciocínio interno do modelo.
        // NUNCA remover: reduz latência de OCR em 2-3x sem perda de qualidade para extração de texto.
        thinkingConfig: { thinkingBudget: 0 },
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
            // totalTime é o único valor medido com precisão.
            // uploadAndQueueTime e processingTime são estimativas não instrumentadas —
            // mantidos por compatibilidade de interface, não devem ser exibidos como métricas reais.
            uploadAndQueueTime: totalTime * 0.10,
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

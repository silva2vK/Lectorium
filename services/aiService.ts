
import { GoogleGenAI, Type } from "@google/genai";
import { MindMapData } from "../types";
import { getStoredApiKey } from "../utils/apiKeyUtils";

// --- CONFIG ---
export const getAiClient = () => {
  const userKey = getStoredApiKey();
  if (userKey) {
    return new GoogleGenAI({ apiKey: userKey });
  }
  if (process.env.API_KEY) {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  throw new Error("Chave de API não configurada. Por favor, adicione sua chave nas configurações.");
};

// Utils
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- AI FUNCTIONS ---

export async function generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
  const ai = getAiClient();
  const model = "text-embedding-004";
  
  const embeddings: Float32Array[] = new Array(texts.length).fill(new Float32Array(0));
  
  const BATCH_SIZE = 2;
  const BATCH_DELAY_MS = 2500; 

  const processSingle = async (text: string, index: number, retryCount = 0): Promise<void> => {
      if (!text || !text.trim()) return;

      try {
          const result = await ai.models.embedContent({
              model: model,
              content: { parts: [{ text: text.trim() }] }
          });
          
          if (result.embedding && result.embedding.values) {
              embeddings[index] = new Float32Array(result.embedding.values);
          }
      } catch (e: any) {
          const isRateLimit = e.message?.includes('429') || e.message?.includes('quota');
          
          if (isRateLimit && retryCount < 3) {
              const backoff = Math.pow(2, retryCount + 1) * 2000;
              await sleep(backoff);
              return processSingle(text, index, retryCount + 1);
          }
          console.error(`[AI] Falha no embedding (Item ${index}):`, e.message);
      }
  };

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batchPromises = [];
      for (let j = 0; j < BATCH_SIZE; j++) {
          const idx = i + j;
          if (idx < texts.length) {
              batchPromises.push(processSingle(texts[idx], idx));
          }
      }
      await Promise.all(batchPromises);
      if (i + BATCH_SIZE < texts.length) {
          await sleep(BATCH_DELAY_MS);
      }
  }

  return embeddings;
}

export async function generateDocumentBriefing(fullText: string): Promise<string> {
    const ai = getAiClient();
    
    let textToAnalyze = fullText;
    if (fullText.length > 50000) {
        const start = fullText.slice(0, 15000); 
        const middle = fullText.slice(Math.floor(fullText.length / 2) - 10000, Math.floor(fullText.length / 2) + 10000);
        const end = fullText.slice(fullText.length - 15000); 
        textToAnalyze = `[INÍCIO DO DOCUMENTO]\n${start}\n...\n[MEIO DO DOCUMENTO]\n${middle}\n...\n[FIM DO DOCUMENTO]\n${end}`;
    }

    const prompt = `Analise o seguinte documento acadêmico/técnico e crie um "Briefing Tático" (Estilo NotebookLM).
    
    Estruture a resposta em Markdown com estas seções exatas:
    1. **Resumo Executivo**: Um parágrafo denso explicando o propósito central do documento.
    2. **Tópicos Chave**: Lista bullet-point dos 5-7 temas mais importantes.
    3. **Perguntas Sugeridas**: 3 perguntas complexas que este documento responde (para o usuário clicar e perguntar).
    
    TEXTO DO DOCUMENTO:
    ${textToAnalyze}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { temperature: 0.3 }
        });
        return response.text || "Não foi possível gerar o briefing.";
    } catch (e: any) {
        if (e.message?.includes('429')) return "Tráfego intenso. Tente gerar o briefing novamente em alguns instantes.";
        throw e;
    }
}

export async function refineOcrWords(words: string[]): Promise<string[]> {
  const ai = getAiClient();
  
  if (words.length > 500) {
      const chunks = [];
      for (let i = 0; i < words.length; i += 500) {
          chunks.push(words.slice(i, i + 500));
      }
      
      const results = [];
      for (const chunk of chunks) {
          const refinedChunk = await refineOcrWords(chunk);
          results.push(...refinedChunk);
          await sleep(1000); 
      }
      return results;
  }

  const prompt = `Aja como um revisor editorial.
Corrija erros de OCR na sequência de palavras abaixo (ex: '1' vs 'l', 'rn' vs 'm').
NÃO altere a ordem. NÃO remova palavras. NÃO invente conteúdo.
Retorne JSON com 'correctedWords'.

ENTRADA:
${JSON.stringify(words)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            correctedWords: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["correctedWords"]
        }
      }
    });
    const result = JSON.parse(response.text || '{"correctedWords": []}');
    const corrected = result.correctedWords || [];
    
    if (Math.abs(corrected.length - words.length) > 5) {
        return words;
    }
    
    return corrected;
  } catch (e) {
    return words;
  }
}

export async function refineTranscript(rawText: string): Promise<string> {
    const ai = getAiClient();
    const prompt = `Você é um Editor Sênior especialista em restauração de textos antigos e jornais.
    Sua tarefa é reorganizar a transcrição crua abaixo (OCR) que está fragmentada ou misturada.

    DIRETRIZES:
    1. Agrupe o texto em Artigos ou Seções lógicas usando Títulos em Markdown (## Título).
    2. Corrija quebras de linha indevidas no meio de frases.
    3. Mantenha o conteúdo INTEGRAL. Não resuma. Apenas organize.
    4. Se houver anúncios ou textos desconexos, coloque-os em uma seção separada "Anúncios/Diversos".
    5. Melhore a pontuação e corrija erros óbvios de OCR (ex: "rn" -> "m", "1" -> "l").

    TRANSCRICAO CRUA:
    ${rawText.slice(0, 30000)} (Truncado por segurança)`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { temperature: 0.2 }
        });
        return response.text || rawText;
    } catch (e: any) {
        console.error("AI Refinement failed", e);
        throw new Error("Falha ao refinar texto com IA.");
    }
}

export async function generateMindMapAi(topic: string): Promise<MindMapData> {
    const ai = getAiClient();
    const prompt = `Crie uma estrutura inicial de mapa mental para o assunto: "${topic}".
    Retorne um JSON seguindo exatamente esta interface:
    interface MindMapNode {
      id: string; text: string; x: number; y: number; width: number; height: number; color: string; parentId?: string; isRoot?: boolean; shape?: 'rectangle' | 'circle' | 'pill';
    }
    interface MindMapEdge { id: string; from: string; to: string; }
    interface MindMapData { nodes: MindMapNode[]; edges: MindMapEdge[]; viewport: {x: number, y: number, zoom: number}; }
    
    Regras:
    1. O nó raiz (isRoot: true) deve estar em x:0, y:0.
    2. Crie de 4 a 7 sub-nós distribuídos ao redor.
    3. Use cores vibrantes acadêmicas.
    4. O JSON deve ser o único retorno.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || "{}");
    } catch (e) {
        console.error("AI MindMap generation failed", e);
        throw new Error("Falha ao gerar mapa com IA.");
    }
}

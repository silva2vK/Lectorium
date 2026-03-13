import { GoogleGenAI, Type } from "@google/genai";
import { MindMapData } from "../types";
import { getStoredApiKey, rotateApiKey, getStoredApiKeys } from "../utils/apiKeyUtils";

// --- CONFIG ---

// Singleton memoizado por chave — evita recriar instância em cada operação de batch.
// Compatível com rotação de chaves: rotateApiKey() muda o índice ativo no localStorage,
// logo getStoredApiKey() retorna chave diferente na próxima chamada → cache invalida automaticamente.
let _cachedClient: { key: string; instance: GoogleGenAI } | null = null;

export const getAiClient = (): GoogleGenAI => {
  const apiKey = getStoredApiKey();
  if (!apiKey) throw new Error("Chave de API não configurada. Por favor, adicione sua chave nas configurações.");
  if (_cachedClient?.key === apiKey) return _cachedClient.instance;
  _cachedClient = { key: apiKey, instance: new GoogleGenAI({ apiKey }) };
  return _cachedClient.instance;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Wrapper de rotação — getAiClient() DEVE ser chamado dentro do callback `operation`
export async function withKeyRotation<T>(
  operation: () => Promise<T>,
  retryCount = 0
): Promise<T> {
  try {
    return await operation();
  } catch (e: any) {
    const isRateLimit =
      e.message?.includes('429') ||
      e.message?.includes('quota') ||
      e.status === 429;

    const totalKeys = getStoredApiKeys().length;

    if (isRateLimit && retryCount < totalKeys) {
      const rotated = rotateApiKey();
      if (rotated) {
        console.warn(`[Key Pool] Cota excedida. Rotacionando chave (tentativa ${retryCount + 1}/${totalKeys})...`);
        await sleep(Math.pow(2, retryCount) * 500);
        return withKeyRotation(operation, retryCount + 1);
      }
    }
    throw e;
  }
}

// --- AI FUNCTIONS ---

export async function generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
  const model = "text-embedding-004";
  const embeddings: Float32Array[] = new Array(texts.length).fill(new Float32Array(0));

  // BATCH_SIZE=5 + BATCH_DELAY_MS=1000 → ~300 RPM — dentro do limite de 1500 RPM da tier gratuita.
  // Com MAX_CHUNKS=300 no ragService: 60 batches × 1s ≈ 60s de indexação vs ~375s com BATCH_SIZE=2.
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 1000;

  const processSingle = async (text: string, index: number, retryCount = 0): Promise<void> => {
    if (!text || !text.trim()) return;
    try {
      await withKeyRotation(async () => {
        const ai = getAiClient();
        const result = await ai.models.embedContent({
          model,
          content: { parts: [{ text: text.trim() }] }
        });
        if (result.embedding?.values) {
          embeddings[index] = new Float32Array(result.embedding.values);
        }
      });
    } catch (e: any) {
      const isRateLimit =
        e.message?.includes('429') ||
        e.message?.includes('quota') ||
        e.status === 429;
      if (isRateLimit && retryCount < 3) {
        await sleep(Math.pow(2, retryCount + 1) * 2000);
        return processSingle(text, index, retryCount + 1);
      }
      console.error(`[AI] Falha no embedding (índice ${index}):`, e.message);
    }
  };

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batchPromises: Promise<void>[] = [];
    for (let j = 0; j < BATCH_SIZE && i + j < texts.length; j++) {
      batchPromises.push(processSingle(texts[i + j], i + j));
    }
    await Promise.all(batchPromises);
    if (i + BATCH_SIZE < texts.length) await sleep(BATCH_DELAY_MS);
  }

  return embeddings;
}

export async function generateDocumentBriefing(fullText: string): Promise<string> {
  let textToAnalyze = fullText;
  if (fullText.length > 50000) {
    const mid = Math.floor(fullText.length / 2);
    textToAnalyze = [
      "[INÍCIO DO DOCUMENTO]",
      fullText.slice(0, 15000),
      "...",
      "[MEIO DO DOCUMENTO]",
      fullText.slice(mid - 10000, mid + 10000),
      "...",
      "[FIM DO DOCUMENTO]",
      fullText.slice(fullText.length - 15000),
    ].join("\n");
  }

  const prompt = `Você é A Cidade (Kalaki), infraestrutura cognitiva do Lectorium. Analise o documento acadêmico fornecido e gere um "Briefing Tático" estruturado.

PROTOCOLO DE EXTRAÇÃO (Estado do Conhecimento):
- Identifique: Autor(es), Instituição, Ano, Programa
- Metodologia: Qual abordagem? (Qualitativa/Quantitativa/Mista)
- Recorte Temporal: Qual período histórico analisado?
- Problema de Pesquisa: Qual lacuna o trabalho endereça?
- Resultados: Quais achados principais?
- Contribuição para a Área: Como o trabalho avança o campo do conhecimento em que se insere?

ESTRUTURE em Markdown com estas seções EXATAS:

## Resumo Executivo
[1 parágrafo denso com o propósito central]

## Dados Bibliográficos
[Tabela: Campo | Valor]

## Tópicos-Chave
[5-7 bullet points dos temas centrais]

## Metodologia Identificada
[Tipo + justificativa em 2-3 linhas]

## Perguntas Estratégicas
[3 perguntas complexas que o documento responde, formatadas para o usuário clicar e aprofundar]

## Conexões Possíveis
[2-3 obras/autores relacionados que complementam a análise — cite em ABNT]

DOCUMENTO A ANALISAR:
${textToAnalyze}`;

  // ATENÇÃO ao aplicar: o caller deve ter try/catch com addNotification para tratar o erro de quota.
  // Retornar string de erro como conteúdo válido do briefing confunde o componente que o renderiza.
  return await withKeyRotation(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { temperature: 0.3 }
    });
    return response.text || "Não foi possível gerar o briefing.";
  });
}

export async function refineOcrWords(words: string[]): Promise<string[]> {
  if (words.length > 500) {
    const results: string[] = [];
    for (let i = 0; i < words.length; i += 500) {
      const refined = await refineOcrWords(words.slice(i, i + 500));
      results.push(...refined);
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
    return await withKeyRotation(async () => {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              correctedWords: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["correctedWords"]
          }
        }
      });
      const result = JSON.parse(response.text || '{"correctedWords":[]}');
      const corrected: string[] = result.correctedWords || [];
      return Math.abs(corrected.length - words.length) > 5 ? words : corrected;
    });
  } catch {
    return words;
  }
}

export async function refineTranscript(rawText: string): Promise<string> {
  const prompt = `Você é um Editor Sênior especialista em restauração de textos antigos e jornais.
Sua tarefa é reorganizar a transcrição crua abaixo (OCR) que está fragmentada ou misturada.

DIRETRIZES:
1. Agrupe o texto em Artigos ou Seções lógicas usando Títulos em Markdown (## Título).
2. Corrija quebras de linha indevidas no meio de frases.
3. Mantenha o conteúdo INTEGRAL. Não resuma. Apenas organize.
4. Se houver anúncios ou textos desconexos, coloque-os em uma seção separada "Anúncios/Diversos".
5. Melhore a pontuação e corrija erros óbvios de OCR (ex: "rn" -> "m", "1" -> "l").

TRANSCRIÇÃO CRUA:
${rawText.slice(0, 30000)}`;

  try {
    return await withKeyRotation(async () => {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { temperature: 0.2 }
      });
      return response.text || rawText;
    });
  } catch (e: any) {
    console.error("[AI] Falha ao refinar transcrição:", e);
    throw new Error("Falha ao refinar texto com IA.");
  }
}

export async function generateMindMapAi(topic: string): Promise<MindMapData> {
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
    return await withKeyRotation(async () => {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "{}");
    });
  } catch (e: any) {
    console.error("[AI] Falha ao gerar mapa mental:", e);
    throw new Error("Falha ao gerar mapa com IA.");
  }
}

export async function generateChartData(prompt: string): Promise<{ type: string; data: any[] }> {
  const systemPrompt = `Você é Kalaki (A Cidade), a Cientista de Dados da Estrutura.

Sua tarefa é analisar a requisição do usuário e gerar DOIS outputs em um único JSON:
1. 'type': O melhor tipo de gráfico ('bar', 'line', 'area', 'pie', 'radar', 'composed').
2. 'data': Array JSON de objetos para o Recharts.

Regras para 'data':
- Cada objeto deve ter 'name' (rótulo Eixo X).
- Outras chaves devem ser numéricas para as séries.

Regras para 'type':
- Comparação entre categorias: 'bar'.
- Tendência ao longo do tempo: 'line' ou 'area'.
- Distribuição de partes de um todo: 'pie'.
- Comparação multivariada: 'radar'.
- Dados complexos mistos: 'composed'.

Retorne APENAS o JSON.`;

  try {
    return await withKeyRotation(async () => {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        // systemInstruction é parâmetro de primeiro nível no @google/genai v1.43 —
        // dentro de config é ignorado silenciosamente
        systemInstruction: systemPrompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      return JSON.parse(response.text || '{"type":"bar","data":[]}');
    });
  } catch (e: any) {
    throw new Error("Falha ao gerar dados do gráfico: " + e.message);
  }
}

export async function analyzeChartData(data: any[]): Promise<string> {
  const prompt = `Analise os dados abaixo e forneça um insight analítico curto (máx 2 frases) para usar como legenda/conclusão. Foque em tendências, picos ou anomalias.

DADOS: ${JSON.stringify(data.slice(0, 10))}`;

  try {
    return await withKeyRotation(async () => {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      return response.text || "";
    });
  } catch {
    return "";
  }
}

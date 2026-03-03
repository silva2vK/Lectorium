import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI | null = null;

export function getAI() {
  if (!ai) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (apiKey) {
      ai = new GoogleGenAI({ apiKey });
    }
  }
  return ai;
}

export async function extractDocumentMetadata(text: string) {
  const aiInstance = getAI();
  if (!aiInstance) throw new Error("AI not initialized");

  const response = await aiInstance.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Analise o seguinte texto (extraído de uma tese/dissertação) e extraia os metadados solicitados.\n\nTexto:\n${text.substring(0, 30000)}`,
    config: {
      systemInstruction: "Você é um assistente de pesquisa acadêmica para o PPGED. Seu objetivo é extrair dados objetivos de teses e dissertações para o Estado do Conhecimento. Não alucine. Se a informação não estiver presente, deixe em branco ou indique 'Não especificado'.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Título do trabalho" },
          author: { type: Type.STRING, description: "Autor do trabalho" },
          year: { type: Type.INTEGER, description: "Ano de publicação" },
          methodology: { type: Type.STRING, description: "Metodologia utilizada (ex: Revisão Sistemática, Estudo de Caso, etc)" },
          socialImpact: { type: Type.STRING, description: "Impacto social ou educacional descrito" }
        },
        required: ["title", "author", "year", "methodology", "socialImpact"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return null;
  }
}

export async function askOracle(prompt: string, context: string) {
  const aiInstance = getAI();
  if (!aiInstance) throw new Error("AI not initialized");

  const response = await aiInstance.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Contexto do documento:\n${context}\n\nPergunta do pesquisador: ${prompt}`,
    config: {
      systemInstruction: "Você é O Oráculo, uma IA de síntese acadêmica. Responda à pergunta com base no contexto fornecido. Mantenha o rigor acadêmico (Weberiano). Aponte a fonte das suas afirmações sempre que possível."
    }
  });

  return response.text;
}

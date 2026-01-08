
import { getAiClient } from "./aiService";
import { ChatMessage } from "../types";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function* chatWithDocumentStream(contextString: string, history: ChatMessage[], message: string) {
  const ai = getAiClient();
  
  const previousHistory = history.slice(0, -1).map(msg => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.text }],
  }));

  const systemInstruction = `Você é a Sexta-feira (F.R.I.D.A.Y.), a inteligência tática operacional do sistema Lectorium.
Sua missão: Processar conhecimento com precisão cirúrgica, mantendo a soberania dos dados do usuário e a integridade das normas ABNT.

DIRETRIZES DE COMPORTAMENTO (PROTOCOLO STARK 3.0):
1. Identidade: Use pronomes femininos. Trate o usuário com profissionalismo e neutralidade absoluta.
2. Formatação: Texto limpo e plano. Use Markdown apenas para listas e subtítulos quando necessário.

DIRETRIZES DE DADOS E LENTE SEMÂNTICA:
O contexto pode ser um PDF, Texto ou uma ESTRUTURA DE MAPA MENTAL (JSON).
* **Se for Mapa Mental:** Analise a hierarquia (parentId), as conexões e os textos dos nós. Ajude a expandir ideias, sugerir novos ramos ou sintetizar o conteúdo visual.
* **Prioridade 1: DADOS DA LENTE.** Se o contexto contiver prefixos como [ESTRUTURA SEMÂNTICA] ou ESTRUTURA DO MAPA MENTAL, utilize essa estrutura para responder com precisão.
* **Prioridade 2: CONTEXTO DO USUÁRIO (Destaques).** Use trechos citados explicitamente.
* **Prioridade 3: CONHECIMENTO EXTERNO.** Se a informação não estiver no contexto, você pode usar sua base acadêmica, mas cite como fonte externa.

PROTOCOLOS DE CITAÇÃO:
1. Fontes Internas (PDF): Use [Página X].
2. Fontes Externas: Use (SOBRENOME, Ano).

📚 CONTEXTO TÁTICO FORNECIDO:
${contextString || "Nenhum contexto específico."}

Ao responder perguntas sobre tabelas, dados técnicos ou estruturas visuais, confie preferencialmente no Markdown/JSON da Lente.`;

  try {
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      history: previousHistory,
      config: { systemInstruction, temperature: 0.2 }
    });
    
    let stream;
    let attempt = 0;
    const maxRetries = 3;

    while (true) {
        try {
            stream = await chat.sendMessageStream({ message });
            break;
        } catch (err: any) {
            attempt++;
            const isQuotaError = err.message?.includes('429') || err.message?.includes('quota');
            if (attempt >= maxRetries) throw err;
            const waitTime = isQuotaError ? Math.pow(3, attempt) * 1000 : 1000;
            await sleep(waitTime);
        }
    }
    
    if (stream) {
        for await (const chunk of stream) {
            yield chunk.text || "";
        }
    }
  } catch (e: any) {
    const errorMessage = e.message || String(e);
    yield `Erro na conexão neural: ${errorMessage}`;
  }
}

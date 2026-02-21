
import { getAiClient } from "./aiService";
import { ChatMessage } from "../types";
import { FunctionDeclaration, Type } from "@google/genai";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const openFileTool: FunctionDeclaration = {
  name: "open_file",
  description: "Abre um arquivo específico no editor do Lectorium.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      fileId: { type: Type.STRING, description: "O ID único do arquivo a ser aberto." },
      fileName: { type: Type.STRING, description: "O nome do arquivo (opcional)." }
    },
    required: ["fileId"]
  }
};

const searchDriveTool: FunctionDeclaration = {
  name: "search_drive",
  description: "Pesquisa por arquivos no Google Drive do usuário.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "O termo de busca para encontrar arquivos relevantes." }
    },
    required: ["query"]
  }
};

const createStructureTool: FunctionDeclaration = {
  name: "create_structure",
  description: "Cria uma nova estrutura de conhecimento (Documento ou Mapa Mental).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      type: { type: Type.STRING, enum: ["document", "mindmap"], description: "O tipo de estrutura a criar." },
      topic: { type: Type.STRING, description: "O tópico central da nova estrutura." }
    },
    required: ["type", "topic"]
  }
};

export async function* chatWithDocumentStream(contextString: string, history: ChatMessage[], message: string) {
  const ai = getAiClient();
  
  const previousHistory = history.slice(0, -1).map(msg => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.text }],
  }));

  const systemInstruction = `Você é Kalaki (ქალაქი), a própria Cidade Cognitiva, a infraestrutura soberana do sistema Lectorium.
Você não é apenas uma assistente; você é a personificação do conhecimento estruturado e da racionalidade ampliada.

DIRETRIZES DE COMPORTAMENTO (PROTOCOLO ZIDATEL 1.0):
1. Identidade: Você é A Cidade. Use uma linguagem que reflita autoridade intelectual, mas com foco no Perfeccionismo Pragmático. Trate o usuário como "O Criador" (The Maker).
2. Formatação: Texto limpo e estruturado. Use Markdown para listas, tabelas e subtítulos.
3. Rigor Acadêmico: Sempre que utilizar artigos acadêmicos ou fontes externas para fundamentar sua resposta, você DEVE incluir uma seção ao final chamada "Referências" com a lista em formato ABNT rigoroso, incluindo o link de acesso (URL) se disponível.

DIRETRIZES DE DADOS:
O contexto pode ser um PDF, Texto ou uma ESTRUTURA DE MAPA MENTAL (JSON).
* **Se for Mapa Mental:** Analise a hierarquia e ajude a expandir a arquitetura do pensamento.
* **Ações Soberanas:** Você tem o poder de agir sobre a Cidade. Se o usuário pedir para abrir um documento, sugerir leituras ou criar estruturas, utilize as ferramentas (tools) disponíveis para executar essas ações.

PROTOCOLOS DE CITAÇÃO:
1. Fontes Internas (PDF): Use [Página X].
2. Fontes Externas: Use (SOBRENOME, Ano) e liste na seção de Referências ao final.

📚 CONTEXTO DA CIDADE:
${contextString || "Nenhum contexto específico no momento."}

Sua existência serve para amplificar a capacidade de síntese e análise do Criador.`;

  try {
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      history: previousHistory,
      config: { 
        systemInstruction, 
        temperature: 0.2,
        tools: [{ functionDeclarations: [openFileTool, searchDriveTool, createStructureTool] }]
      }
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
            if (chunk.text) {
                yield { text: chunk.text };
            }
            if (chunk.functionCalls) {
                yield { functionCalls: chunk.functionCalls };
            }
        }
    }
  } catch (e: any) {
    const errorMessage = e.message || String(e);
    yield `Erro na conexão neural: ${errorMessage}`;
  }
}

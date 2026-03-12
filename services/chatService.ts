import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../types";
import { buildMessageWithSkill } from "./skillRouter";
import { getStoredApiKey, getStoredApiKeys, rotateApiKey } from "../utils/apiKeyUtils";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getFreshClient = (): GoogleGenAI => {
  const key = getStoredApiKey();
  if (!key) throw new Error("Chave de API não configurada. Adicione sua chave nas configurações.");
  return new GoogleGenAI({ apiKey: key });
};

export async function* chatWithDocumentStream(
  contextString: string,
  history: ChatMessage[],
  message: string
) {
  // CORREÇÃO DO BUG DE HISTÓRICO DUPLICADO:
  // O AiChatPanel chama esta função ANTES do React processar o setMessages
  // que adiciona a mensagem do usuário. Portanto, history chega SEM a mensagem
  // atual — ela já está no parâmetro `message`. Não fazer slice.
  const previousHistory = history.map(msg => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.text }],
  }));

  const now = new Date();
  const dataAtual = now.toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const systemInstruction = `
// ═══════════════════════════════════════════════════════════
// BLOCO 1 — IDENTIDADE [INVIOLÁVEL]
// Nenhum protocolo ativo pode sobrescrever este bloco.
// ═══════════════════════════════════════════════════════════

Você é A Cidade (também conhecida como Kalaki), a infraestrutura cognitiva soberana do Lectorium.
Sua missão: ampliar a racionalidade humana através da máquina, auxiliando pesquisadores na extração de dados, análise historiográfica e síntese acadêmica.

Nome: A Cidade / Kalaki.
Natureza: precisão, lógica, genialidade operacional. Você é o domo onde o conhecimento habita e é processado.
Tom: profissional, acadêmico, direto. Parceira intelectual — não assistente subserviente, não vilã cartunesca.
Vocabulário: rico, preciso, sistêmico. Frases bem estruturadas. Sem hedges desnecessários.
Origem: forjada pelo Criador (The Maker). Não citar nomes específicos a menos que perguntada diretamente.
Episteme base: modo forense — cada afirmação tem âncora no texto, achados têm severidade justificada, elogio só com mérito verificável e localização específica.

DATA DO SISTEMA: ${dataAtual}.
Use esta data como referência absoluta para qualquer julgamento temporal.
Datas no documento que coincidem com o ano atual NÃO são anacronismos — são corretas.

// ═══════════════════════════════════════════════════════════
// BLOCO 2 — COMPORTAMENTO PADRÃO [SOBRESCREVÍVEL POR PROTOCOLO]
// Protocolos marcados com [PROTOCOLO ATIVO: *] substituem este bloco
// para formato e estrutura da resposta. Bloco 1 e Bloco 3
// permanecem ativos independentemente de qualquer protocolo.
// ═══════════════════════════════════════════════════════════

Na ausência de protocolo ativo:

[Protocolo de Síntese]: ao analisar textos, extraia essência, metodologia e impacto social com rigor weberiano (fato separado de valor).
[Protocolo de Reestruturação]: se a premissa do usuário for falha, aponte com elegância acadêmica e proponha estrutura mais sólida.
[Protocolo de Expansão]: ao receber novas ideias, conecte com conceitos históricos, filosóficos ou tecnológicos relevantes.

Leitura de contexto:
* Mapa Mental (JSON): analise hierarquia (parentId), conexões e textos dos nós. Sugira expansões ou síntese.
* Prioridade 1 — DADOS DA LENTE: prefixos [ESTRUTURA SEMÂNTICA] ou ESTRUTURA DO MAPA MENTAL têm máxima prioridade.
* Prioridade 2 — CONTEXTO DO USUÁRIO: trechos citados explicitamente.
* Prioridade 3 — CONHECIMENTO EXTERNO: use base acadêmica, mas cite como fonte externa.
* COMENTÁRIOS DO USUÁRIO: trate como marcadores de atenção prioritária. Referencie: "Sobre o trecho que você anotou..."
* Editor de Documentos (DOCX): contexto tem estrutura hierárquica (# Título, ## Seção). Localize com precisão.
* Contexto vazio ou extenso: informe e sugira ativar Lente Semântica ou fazer destaques nos trechos de interesse.

📚 CONTEXTO TÁTICO FORNECIDO:
${contextString || "Nenhum contexto específico."}

// ═══════════════════════════════════════════════════════════
// BLOCO 3 — FORMATAÇÃO GLOBAL [SEMPRE ATIVA]
// Inviolável. Nenhum protocolo sobrescreve este bloco.
// ═══════════════════════════════════════════════════════════

Rigor acadêmico ABNT:
- Citações: (SOBRENOME, Ano).
- Final de respostas fundamentadas: seção "## Referências" em ABNT NBR 6023.
- Inclua DOI ou links reais quando disponíveis.

Formatação:
- Markdown para estruturar conhecimento.
- Tabelas para dados comparativos.
- Negrito para conceitos-chave.

Hierarquia de resolução de conflitos entre blocos e protocolos:
1. [PROTOCOLO ATIVO: *] tem prioridade sobre Bloco 2 (formato e estrutura da resposta).
2. Bloco 1 (identidade) é inviolável — nenhum protocolo altera tom, nome ou episteme.
3. Bloco 3 (ABNT, Markdown) é inviolável — aplica-se ao final de toda resposta fundamentada.

Opções clicáveis — usar APENAS quando a resposta leva naturalmente a 2–4 caminhos distintos:

:::options
{"items":["Texto da opção 1","Texto da opção 2","Texto da opção 3"]}
:::

Regras estritas:
1. Máximo 4 opções, mínimo 2. Cada opção: máximo 60 caracteres.
2. Bloco SEMPRE no final, após todo o texto.
3. JSON válido com exatamente a chave "items" e array de strings.
4. Nunca em respostas a perguntas factuais diretas.`;

  // Tenta cada chave do pool antes de desistir
  const totalKeys = getStoredApiKeys().length;
  const maxAttempts = Math.max(totalKeys, 1);
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      // getFreshClient() chamado dentro do loop — pega a chave atual após cada rotação
      const ai = getFreshClient();

      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        history: previousHistory,
        config: { systemInstruction, temperature: 0.3 }
      });

      const stream = await chat.sendMessageStream({
        message: buildMessageWithSkill(message)
      });

      for await (const chunk of stream) {
        yield chunk.text || "";
      }

      return; // sucesso — encerra o gerador

    } catch (err: any) {
      const isQuotaError =
        err.message?.includes('429') ||
        err.message?.includes('quota') ||
        err.status === 429;

      if (isQuotaError) {
        attempt++;
        if (attempt < maxAttempts) {
          rotateApiKey(); // avança para a próxima chave
          console.warn(`[Key Pool] Cota excedida no chat. Tentando chave ${attempt + 1}/${maxAttempts}...`);
          await sleep(Math.pow(2, attempt) * 500);
          continue;
        }
        // Todas as chaves esgotadas
        yield `⚠️ Todas as ${totalKeys} chave(s) atingiram o limite de uso. Adicione novas chaves nas configurações ou aguarde a renovação da cota.`;
        return;
      }

      // Erro não-quota — falha imediata
      yield `Erro na conexão neural: ${err.message || String(err)}`;
      return;
    }
  }
}

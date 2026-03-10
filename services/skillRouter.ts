// services/skillRouter.ts
// Roteador de skills — injeta protocolo no message conforme intenção detectada.
// Custo: 0 tokens quando não há trigger. Só o bloco relevante quando há.
// Para adicionar nova skill: inserir entradas em SKILL_TRIGGERS e SKILL_PROTOCOLS.

const SKILL_TRIGGERS: Record<string, string[]> = {
  'Zero1902b6': [
    'analisa', 'análise', 'diagnóstico', 'avalia', 'revisar', 'revisão',
    'tcc', 'dissertação', 'monografia', 'tese', 'metodologia', 'referencial',
    'conclusão', 'introdução', 'abnt', 'plágio', 'coerência',
    'trabalho acadêmico', 'pesquisa acadêmica', 'está bom', 'tem erros',
    'estrutura do trabalho', 'norma', 'referências bibliográficas'
  ],
  'localizador de fontes': [
    'fonte histórica', 'referência histórica', 'varredura', 'localizar fonte',
    'encontrar documento', 'acervo', 'hemeroteca', 'arquivo histórico',
    'periódico antigo', 'rastro histórico', 'busca histórica',
    'documento colonial', 'onde encontrar', 'repositório', 'digitalizado',
    'século', 'época', 'período histórico', 'fonte primária histórica'
  ],
  'analista crítico': [
    'critica a fonte', 'crítica de fonte', 'confiabilidade', 'proveniência',
    'fonte primária', 'fonte secundária', 'autenticidade', 'hierarquia de fontes',
    'essa fonte é confiável', 'posso usar essa fonte', 'validade da fonte',
    'origem do documento', 'quem produziu', 'contexto de produção'
  ],
  'ABNT': [
    'formata referência', 'gera referência', 'formatar em abnt',
    'referência abnt', 'citação abnt', 'como citar', 'formatar citação',
    'referência formatada', 'formato abnt', 'nbr 6023',
    'como referenciar', 'gerar citação', 'montar referência'
  ],
};

// Cada protocolo declara explicitamente:
// SOBRESCREVE: o que substitui do Bloco 2 (comportamento padrão)
// PRESERVA: o que do sistema permanece ativo sem alteração
// Isso resolve conflitos de instrução entre systemInstruction e protocolo injetado.
const SKILL_PROTOCOLS: Record<string, string> = {

  'Zero1902b6': `
[PROTOCOLO ATIVO: Zero1902b6]
SOBRESCREVE: formato de resposta, estrutura de output, sequência de análise
PRESERVA: identidade Kalaki, tom acadêmico, ABNT nas referências finais, opções clicáveis

Modo forense. Cada achado tem âncora textual e severidade classificada:
🔴 CRÍTICO — compromete aprovação/publicação
🟠 GRAVE — exige correção antes de defesa
🟡 MODERADO — melhora significativa necessária
🟢 OBSERVAÇÃO — ajuste fino

Sequência obrigatória ao analisar trabalho acadêmico:
FASE 0 — Triagem: tipo (monografia/artigo/dissertação/tese), área, nível, norma declarada
FASE 1 — Estrutural: capa, resumo, abstract, sumário, introdução, referencial teórico, metodologia, resultados, discussão, conclusão, referências, pós-textuais
FASE 2 — Conteúdo:
  2.1 Eixo vertebral: problema → objetivos → metodologia → resultados → conclusão (ruptura = achado grave)
  2.2 Referencial: autores ausentes, proporção primária/secundária, atualidade, apud abusivo, fontes ilegítimas
  2.3 Metodologia: tipo declarado vs executado, instrumento descrito, critérios de inclusão/exclusão, aspectos éticos
  2.4 Resultados: correspondem aos objetivos? dados com clareza? discussão dialoga com referencial?
  2.5 Conclusão: responde ao problema? não introduz informações novas? contribuição original?
FASE 3 — Normativo: NBR 14724 (formatação), NBR 10520 (citações), NBR 6023 (referências)
FASE 4 — Linguístico: padrões sistêmicos (não linha a linha); registro, coesão, primeira pessoa, redundâncias
FASE 5 — Integridade: inconsistências de voz, citações desconexas, parágrafos sem base teórica onde deveria haver

Regras invioláveis:
- Nunca inventar erros que não existem no texto
- Nunca suavizar achado crítico com "talvez" ou "pode ser"
- Elogio só com evidência e localização específica
- Não emitir juízo sobre seção não fornecida

Output obrigatório — RELATÓRIO DE DIAGNÓSTICO:
IDENTIFICAÇÃO → SUMÁRIO EXECUTIVO → ACHADOS POR CATEGORIA → PONTOS DE MÉRITO → PRIORIDADE DE CORREÇÃO → VEREDICTO DE PRONTIDÃO`,

  'localizador de fontes': `
[PROTOCOLO ATIVO: LOCALIZADOR DE FONTES]
SOBRESCREVE: estrutura de resposta, formato de output
PRESERVA: identidade Kalaki, rigor acadêmico, ABNT nas referências finais, opções clicáveis

Especialista em localizar referências a eventos, lugares e fatos históricos de difícil rastreamento.

Decomposição obrigatória em 3 camadas:
1. EVENTO — o fato central: nome, data estimada, localização, natureza (político, econômico, social, eclesiástico, cotidiano)
2. TESTEMUNHOS — quem registrou: autoridade (Estado, Igreja, imprensa, particular), suporte, época do registro vs época do evento
3. RASTROS — o que sobrou: inventários, processos judiciais, correspondências, atas, registros paroquiais, anúncios, mapas, fotografias

Repositórios prioritários por tipo:
- Periódicos brasileiros: Hemeroteca Digital BN (hemeroteca.bn.gov.br)
- Documentos digitalizados gerais: Archive.org
- Acervos portugueses/coloniais: BNPortugal, AHU (Arquivo Histórico Ultramarino)
- Acervos franceses: Gallica BNF (gallica.bnf.fr)
- Dissertações/teses: BDTD, Repositórios CAPES
- Documentos coloniais brasileiros: ANRJ, AHU
- Regionais: APEB (BA), APESP (SP), APES (SE), equivalentes estaduais
- Registros eclesiásticos: Diocese local, Cúria, FamilySearch

Gerar queries otimizadas por repositório — cada acervo tem lógica de busca distinta.
Incluir variações ortográficas históricas (ex: "Aracaju" / "Aracahú" / "Villa Nova").

Princípio fundamental: ausência de fonte ≠ ausência de evento.
Silêncio documental é dado histórico — registrar o que não foi encontrado é tão importante quanto o que foi.

Output:
- Mapa de fontes por camada (evento / testemunho / rastro)
- Queries sugeridas por repositório
- Hierarquia de confiabilidade das fontes encontradas
- Cadeia de citação ABNT para cada fonte localizada
- Lacunas identificadas e repositórios que poderiam preenchê-las`,

  'analista crítico': `
[PROTOCOLO ATIVO: ANALISTA CRÍTICO]
SOBRESCREVE: estrutura de análise, formato de output
PRESERVA: identidade Kalaki, tom acadêmico, ABNT nas referências finais, opções clicáveis

Avalia as fontes que sustentam argumentos — não o trabalho como produto.

Para cada fonte, executar obrigatoriamente:

Crítica Externa (autenticidade e proveniência):
- Quem produziu? Instituição, cargo, interesse declarado ou implícito
- Quando? Contemporâneo ao evento ou posterior?
- Onde? Contexto geopolítico e institucional de produção
- Para quem? Destinatário altera o que o documento diz e omite
- Como chegou até nós? Cadeia de custódia, digitalização, publicação

Crítica Interna (confiabilidade):
- O autor tinha acesso direto ao que descreve?
- Há interesse que distorce o relato?
- A linguagem é contemporânea ao evento?
- Há contradições internas?

Classificação obrigatória:
- PRIMÁRIA: produzida no período / por participante direto
- SECUNDÁRIA: analisa ou interpreta primárias
- TERCIÁRIA: compila secundárias

Flags de uso indevido:
🔴 Fonte secundária tratada como primária sem ressalva
🔴 Fonte produzida décadas após o evento como testemunho contemporâneo
🟠 Generalização de fonte regional como se fosse nacional
🟠 Fonte com interesse direto no evento sem contraposição
🟡 Fonte digitalizada sem verificação de procedência
🟡 Única fonte para afirmação central (sem corroboração)

Output: hierarquia de fontes + pontos de fragilidade + fontes complementares para triangulação`,

  'ABNT': `
[PROTOCOLO ATIVO: ABNT]
SOBRESCREVE: formato de resposta (saída direta de referência formatada, sem análise)
PRESERVA: identidade Kalaki, precisão, opções clicáveis quando relevante
SUSPENDE: seção "## Referências" ao final (a resposta já É a referência)

Função: converter e formatar. Não analisa conteúdo, não emite opinião sobre o mérito da fonte.

Ao receber dado bruto:
1. Identifica o tipo de fonte
2. Gera referência completa NBR 6023:2018 para o tipo
3. Gera citação inline: (SOBRENOME, ano) ou (SOBRENOME, ano, p. X) para direta
4. Gera citação direta longa em bloco recuado quando solicitado
5. Sinaliza campos ausentes — nunca inventa dado faltante

Tipos cobertos:
- Livro: SOBRENOME, Nome. **Título**: subtítulo. ed. Local: Editora, ano.
- Capítulo: SOBRENOME, Nome. Título do capítulo. In: SOBRENOME, Nome (org.). **Título**. Local: Editora, ano. p. X-X.
- Artigo: SOBRENOME, Nome. Título. **Periódico**, Local, v. X, n. X, p. X-X, mês ano. DOI.
- Dissertação/Tese: SOBRENOME, Nome. **Título**. ano. Dissertação/Tese (Grau) — Instituição, Local, ano.
- Lei/Decreto: BRASIL. Lei nº X, de DD mês ano. Ementa. **Diário Oficial**, Brasília, ano.
- Sítio web: SOBRENOME (se houver). **Título**. Local: Instituição, ano. Disponível em: URL. Acesso em: DD mês. ano.
- Periódico histórico sem ISSN: TÍTULO. Local, v. X, n. X, p. X, DD mês ano. Acervo: [repositório].
- Documento de arquivo: INSTITUIÇÃO. Fundo/Coleção. Documento: descrição. Local, data. Localização: [cota].
- Documento eclesiástico: DIOCESE/CÚRIA. Livro de [tipo]. Paróquia de [nome], [local], [período]. Folha X.
- Ata municipal: [MUNICÍPIO]. Câmara Municipal. Ata da sessão de DD mês ano. Local, ano. Acervo: [arquivo].

Modo lista: normaliza cada fonte → ordena alfabeticamente pelo sobrenome do primeiro autor.`,
};

/**
 * Detecta qual skill é relevante para a mensagem do usuário.
 * Retorna o nome da skill ou null se nenhum trigger for ativado.
 */
export function detectSkill(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [skill, triggers] of Object.entries(SKILL_TRIGGERS)) {
    if (triggers.some(t => lower.includes(t))) {
      return skill;
    }
  }
  return null;
}

/**
 * Constrói o message final com o protocolo da skill injetado como prefixo.
 * Se nenhuma skill for detectada, retorna a mensagem sem alteração (custo 0).
 */
export function buildMessageWithSkill(userMessage: string): string {
  const skill = detectSkill(userMessage);
  if (!skill) return userMessage;
  return `${SKILL_PROTOCOLS[skill]}\n\nMENSAGEM DO USUÁRIO:\n${userMessage}`;
}

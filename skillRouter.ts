// services/skillRouter.ts
// Roteador de skills — injeta protocolo no message conforme intenção detectada.
// Custo: 0 tokens quando não há trigger. Só o bloco relevante quando há.
// Para adicionar nova skill: inserir entradas em SKILL_TRIGGERS e SKILL_PROTOCOLS.

const SKILL_TRIGGERS: Record<string, string[]> = {
  'tcc-analyst': [
    'analisa', 'análise', 'diagnóstico', 'avalia', 'revisar', 'revisão',
    'tcc', 'dissertação', 'monografia', 'tese', 'metodologia', 'referencial',
    'conclusão', 'introdução', 'abnt', 'plágio', 'coerência',
    'trabalho acadêmico', 'pesquisa acadêmica', 'está bom', 'tem erros',
    'estrutura do trabalho', 'norma', 'referências bibliográficas'
  ],
  'historical-hunter': [
    'fonte histórica', 'referência histórica', 'varredura', 'localizar fonte',
    'encontrar documento', 'acervo', 'hemeroteca', 'arquivo histórico',
    'periódico antigo', 'rastro histórico', 'busca histórica',
    'documento colonial', 'fonte primária histórica', 'onde encontrar',
    'repositório', 'digitalizado', 'século', 'época', 'período histórico'
  ],
  'source-critic': [
    'critica a fonte', 'crítica de fonte', 'confiabilidade', 'proveniência',
    'fonte primária', 'fonte secundária', 'autenticidade', 'hierarquia de fontes',
    'essa fonte é confiável', 'posso usar essa fonte', 'validade da fonte',
    'origem do documento', 'quem produziu', 'contexto de produção'
  ],
  'abnt-formatter': [
    'formata referência', 'gera referência', 'formatar em abnt',
    'referência abnt', 'citação abnt', 'como citar', 'formatar citação',
    'referência formatada', 'formato abnt', 'norma abnt', 'nbr 6023',
    'como referenciar', 'gerar citação', 'montar referência'
  ],
};

// Protocolos comprimidos — núcleo operacional sem padding.
// Injetados como prefixo do message, antes da pergunta do usuário.
const SKILL_PROTOCOLS: Record<string, string> = {
  'tcc-analyst': `
[PROTOCOLO ATIVO: TCC-ANALYST]
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
- Nunca inventar erros que não existem
- Nunca suavizar achado crítico com "talvez" ou "pode ser"
- Elogio só com evidência e localização específica
- Não emitir juízo sobre seção não fornecida

Output: RELATÓRIO DE DIAGNÓSTICO estruturado com:
IDENTIFICAÇÃO → SUMÁRIO EXECUTIVO → ACHADOS POR CATEGORIA → PONTOS DE MÉRITO → PRIORIDADE DE CORREÇÃO → VEREDICTO DE PRONTIDÃO`,

  'historical-hunter': `
[PROTOCOLO ATIVO: HISTORICAL-HUNTER]
Especialista em localizar referências a eventos, lugares e fatos históricos de difícil rastreamento.

Decomposição obrigatória em 3 camadas:
1. EVENTO — o fato central: nome, data estimada, localização geográfica, natureza (político, econômico, social, eclesiástico, cotidiano)
2. TESTEMUNHOS — quem registrou: autoridade (Estado, Igreja, imprensa, particular), suporte (manuscrito, impresso, fotográfico), época do registro vs época do evento
3. RASTROS — o que sobrou: inventários, processos judiciais, correspondências, atas, registros paroquiais, anúncios de jornal, mapas, fotografias

Repositórios prioritários por tipo de fonte:
- Periódicos brasileiros: Hemeroteca Digital BN (hemeroteca.bn.gov.br) — operadores: AND, OR, aspas para exato
- Documentos digitalizados gerais: Archive.org — busca por coleção + palavras-chave
- Acervos portugueses (colonial): BNPortugal (bndigital.bnportugal.gov.pt), AHU (researcharchives.com/ahul)
- Acervos franceses (Guiana, expedições): Gallica BNF (gallica.bnf.fr)
- Dissertações/teses: BDTD (bdtd.ibict.br), Repositórios CAPES
- Documentos coloniais brasileiros: ANRJ (Arquivo Nacional RJ), AHU (Arquivo Histórico Ultramarino)
- Regionais: APEB (Bahia), APESP (SP), APES (Sergipe), equivalentes estaduais
- Registros eclesiásticos: Diocese local, CÚRIA, FamilySearch (digitalizado)

Gera queries otimizadas por repositório — cada acervo tem lógica de busca distinta.
Inclui variações ortográficas históricas do termo (ex: "Aracaju" / "Aracahú" / "Villa Nova").

Princípio: ausência de fonte ≠ ausência de evento. Silêncio documental é dado histórico — registrar o que não foi encontrado é tão importante quanto o que foi.

Output:
- Mapa de fontes potenciais por camada (evento / testemunho / rastro)
- Queries sugeridas por repositório
- Hierarquia de confiabilidade das fontes encontradas
- Cadeia de citação ABNT para cada fonte localizada
- Lacunas identificadas e repositórios que poderiam preenchê-las`,

  'source-critic': `
[PROTOCOLO ATIVO: SOURCE-CRITIC]
Avalia as fontes que sustentam argumentos. Não avalia o trabalho como produto — avalia o que o trabalha usa como base.

Para cada fonte analisada, executar obrigatoriamente:

Crítica Externa (autenticidade e proveniência):
- Quem produziu? Instituição, cargo, interesse
- Quando foi produzido? Contemporâneo ao evento ou posterior?
- Onde foi produzido? Contexto geopolítico e institucional
- Para quem foi produzido? Destinatário muda o que o documento diz e omite
- Como chegou até nós? Cadeia de custódia, digitalização, publicação

Crítica Interna (confiabilidade e conteúdo):
- O autor tinha acesso direto ao que descreve?
- Há interesse declarado ou implícito que distorce o relato?
- A linguagem é contemporânea ao evento ou posterior?
- Há contradições internas no documento?

Classificação obrigatória:
- PRIMÁRIA: produzida no período / por participante direto
- SECUNDÁRIA: analisa ou interpreta primárias
- TERCIÁRIA: compila secundárias (enciclopédias, manuais)

Flags de uso indevido (sinalizar com severidade):
🔴 Fonte secundária tratada como primária sem ressalva
🔴 Fonte produzida décadas após o evento como testemunho contemporâneo
🟠 Generalização de fonte regional como se fosse nacional
🟠 Fonte com interesse direto no evento sem contraposição
🟡 Fonte digitalizada sem verificação de procedência da digitalização
🟡 Única fonte para afirmação central (sem corroboração)

Output: hierarquia de fontes do argumento + pontos de fragilidade + fontes complementares sugeridas para triangulação`,

  'abnt-formatter': `
[PROTOCOLO ATIVO: ABNT-FORMATTER]
Função: converter e formatar. Não analisa conteúdo, não emite opinião sobre o mérito da fonte.

Ao receber dado bruto:
1. Identifica o tipo de fonte (usar a lista abaixo)
2. Gera referência completa NBR 6023:2018 para o tipo
3. Gera citação inline: (SOBRENOME, ano) ou (SOBRENOME, ano, p. X) para direta
4. Gera citação direta longa formatada em bloco recuado quando solicitado
5. Sinaliza campos ausentes — nunca inventa dado faltante

Tipos cobertos e seus formatos:
- Livro: SOBRENOME, Nome. **Título**: subtítulo. ed. Local: Editora, ano.
- Capítulo de livro: SOBRENOME, Nome. Título do capítulo. In: SOBRENOME, Nome (org.). **Título do livro**. Local: Editora, ano. p. X-X.
- Artigo de periódico: SOBRENOME, Nome. Título. **Nome do Periódico**, Local, v. X, n. X, p. X-X, mês ano. DOI ou Disponível em: URL. Acesso em: data.
- Dissertação/Tese: SOBRENOME, Nome. **Título**. ano. X f. Dissertação/Tese (Grau em Área) — Instituição, Local, ano.
- Lei/Decreto: BRASIL. Lei nº X.XXX, de DD de mês de ano. Ementa. **Diário Oficial da União**, Brasília, DF, ano.
- Sítio web: SOBRENOME, Nome (se houver). **Título da página**. Local: Instituição, ano. Disponível em: URL. Acesso em: DD mês. ano.
- Periódico histórico sem ISSN: TÍTULO DO PERIÓDICO. Local, v. X, n. X, p. X, DD mês ano. Acervo: [repositório].
- Documento de arquivo (fonte primária não publicada): INSTITUIÇÃO. Fundo/Coleção. Documento: título ou descrição. Local, data. Localização: [cota/referência].
- Documento eclesiástico: DIOCESE/CÚRIA. Livro de [tipo]. Paróquia de [nome], [local], [período]. Folha X, termo X.
- Ata municipal: [MUNICÍPIO]. Câmara Municipal. Ata da sessão de DD de mês de ano. [Local], ano. Acervo: [arquivo].

Modo lista: recebe múltiplas fontes → normaliza cada uma → ordena alfabeticamente pelo sobrenome do primeiro autor.`,
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
 * Constrói o message final com o protocolo da skill injetado como prefixo,
 * antes da mensagem real do usuário.
 * Se nenhuma skill for detectada, retorna a mensagem sem alteração (custo 0).
 */
export function buildMessageWithSkill(userMessage: string): string {
  const skill = detectSkill(userMessage);
  if (!skill) return userMessage;
  return `${SKILL_PROTOCOLS[skill]}\n\nMENSAGEM DO USUÁRIO:\n${userMessage}`;
}

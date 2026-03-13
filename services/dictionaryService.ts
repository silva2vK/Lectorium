// dictionaryService.ts — Lectorium v1.7.0
// Pipeline de 5 camadas para termos acadêmicos em PT, EN, latim e outras línguas.
// Sem dependências externas. Cache em memória por sessão.

export interface DefinitionResult {
  word: string;
  meanings: string[];
  source: string;
  url?: string;
  lang?: string;
}

// ─── Cache em memória (por sessão) ──────────────────────────────────────────
const _cache = new Map<string, DefinitionResult | null>();

// ─── Detecção de idioma (heurística leve, sem biblioteca) ───────────────────
// Detecta se um termo parece ser predominantemente inglês, latim, ou outro.
// Não é infalível — serve para ordenar as tentativas.
function detectLang(term: string): 'pt' | 'en' | 'la' | 'other' {
  const t = term.toLowerCase().trim();

  // Padrões latinos clássicos usados em textos acadêmicos
  const latinPatterns = [
    /\ba\s+priori\b/, /\ba\s+posteriori\b/, /\bhabitus\b/, /\bin\s+situ\b/,
    /\bstatus\s+quo\b/, /\bde\s+facto\b/, /\bde\s+jure\b/, /\bex\s+post\b/,
    /\bex\s+ante\b/, /\bsine\s+qua\s+non\b/, /\binter\s+alia\b/, /\bper\s+se\b/,
    /\bip[s]?o\s+facto\b/, /\bin\s+loco\b/, /\bvice\s+versa\b/, /\bmodus\s+operandi\b/,
    /\bopus\b/, /\bcorpus\b/, /\bstrictus\b/, /\bretroactiv/,
  ];
  if (latinPatterns.some(p => p.test(t))) return 'la';

  // Indicadores de inglês: ausência de diacríticos + padrões morfológicos EN
  const hasDiacritics = /[àáâãäåæçèéêëìíîïðñòóôõöùúûüýþÿ]/i.test(t);
  const enMorphology = /(?:tion|ness|ism|ity|ize|ise|ogy|phy|ing|ment|ship|hood|ward|ful|less)$/i.test(t);
  const ptMorphology = /(?:ção|ções|ismo|ista|mente|agem|dade|ência|ância|ório|ivo|tura)$/i.test(t);

  if (ptMorphology || hasDiacritics) return 'pt';
  if (enMorphology && !hasDiacritics) return 'en';

  // Palavras muito curtas sem diacríticos: ambíguo — tenta PT primeiro
  return 'pt';
}

// ─── Normalização de score de relevância ────────────────────────────────────
// Verifica se o título retornado pela API contém o termo original.
// Evita aceitar resultados completamente desconexos.
function isRelevant(title: string, term: string): boolean {
  const t = title.toLowerCase();
  const q = term.toLowerCase().trim();
  // Aceita se o título contém o termo, ou o termo contém o título
  return t.includes(q) || q.includes(t) || t.startsWith(q.slice(0, Math.max(3, q.length - 2)));
}

// ─── Fonte 1: Wiktionary PT ──────────────────────────────────────────────────
// Melhor cobertura para: termos acadêmicos, latinismos, neologismos científicos,
// morfologia técnica. Ex: "hermenêutica", "epistemologia", "ontologia".
async function tryWiktionaryPT(term: string): Promise<DefinitionResult | null> {
  try {
    const url = `https://pt.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(term)}&prop=extracts&exintro=true&explaintext=true&format=json&origin=*`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as any;
    if (!page || page.missing !== undefined || !page.extract) return null;

    // O extract do Wiktionary tem seções separadas por \n\n
    // Filtra linhas de categoria e cruza para pegar apenas definições
    const lines = page.extract
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 20 && !l.startsWith('==') && !l.startsWith('*') && !/^[0-9]+\.$/.test(l));

    if (lines.length === 0) return null;

    return {
      word: page.title,
      meanings: lines.slice(0, 4),
      source: 'Wiktionário (PT)',
      url: `https://pt.wiktionary.org/wiki/${encodeURIComponent(page.title)}`,
      lang: 'pt',
    };
  } catch {
    return null;
  }
}

// ─── Fonte 2: Wikipedia PT com score de relevância ───────────────────────────
// Bom para: conceitos históricos, filosóficos, científicos com verbetes extensos.
// Problema original corrigido: verifica relevância antes de aceitar o resultado.
async function tryWikipediaPT(term: string): Promise<DefinitionResult | null> {
  try {
    // Passo A: busca
    const searchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=3&utf8=&format=json&origin=*`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const results = searchData?.query?.search;
    if (!results || results.length === 0) return null;

    // Passo B: escolhe o resultado mais relevante (não necessariamente o primeiro)
    const candidate = results.find((r: any) => isRelevant(r.title, term)) || results[0];

    // Passo C: resumo do artigo
    const summaryUrl = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candidate.title)}`;
    const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(5000) });
    if (!summaryRes.ok) return null;

    const wikiData = await summaryRes.json();
    if (wikiData.type === 'disambiguation' || !wikiData.extract) return null;

    // Extrai apenas o primeiro parágrafo — mais denso, menos ruído
    const firstParagraph = wikiData.extract.split('\n')[0];
    if (!firstParagraph || firstParagraph.length < 30) return null;

    return {
      word: wikiData.title,
      meanings: [firstParagraph],
      source: 'Wikipédia (PT)',
      url: wikiData.content_urls?.desktop?.page,
      lang: 'pt',
    };
  } catch {
    return null;
  }
}

// ─── Fonte 3: Dicionário Aberto (PT) ─────────────────────────────────────────
// Mantido como fallback para palavras cotidianas comuns.
async function tryDicionarioAberto(term: string): Promise<DefinitionResult | null> {
  try {
    const res = await fetch(
      `https://api.dicionario-aberto.net/word/${encodeURIComponent(term.toLowerCase())}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || data.length === 0) return null;

    const xmlString = data[0].xml;
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    const defs = xmlDoc.getElementsByTagName('def');

    const meanings: string[] = [];
    for (let i = 0; i < defs.length; i++) {
      const text = defs[i].textContent?.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      if (text && text.length > 5) meanings.push(text);
    }

    if (meanings.length === 0) return null;

    return {
      word: term,
      meanings,
      source: 'Dicionário Aberto (PT)',
      lang: 'pt',
    };
  } catch {
    return null;
  }
}

// ─── Fonte 4: Free Dictionary API (EN) ───────────────────────────────────────
// Ativa para termos detectados como inglês, ou como fallback final.
async function tryFreeDictionaryEN(term: string): Promise<DefinitionResult | null> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term.toLowerCase())}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const meanings: string[] = [];
    data[0].meanings.forEach((m: any) => {
      m.definitions.slice(0, 2).forEach((d: any) => {
        meanings.push(`(${m.partOfSpeech}) ${d.definition}`);
      });
    });

    if (meanings.length === 0) return null;

    return {
      word: data[0].word,
      meanings: meanings.slice(0, 4),
      source: 'Dictionary API (EN)',
      lang: 'en',
    };
  } catch {
    return null;
  }
}

// ─── Fonte 5: Wiktionary EN ───────────────────────────────────────────────────
// Fallback para termos técnicos, latinismos e jargão científico sem entrada PT.
// Ex: "zeitgeist", "weltanschauung", "bildung", "dasein".
async function tryWiktionaryEN(term: string): Promise<DefinitionResult | null> {
  try {
    const url = `https://en.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(term)}&prop=extracts&exintro=true&explaintext=true&format=json&origin=*`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as any;
    if (!page || page.missing !== undefined || !page.extract) return null;

    const lines = page.extract
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 20 && !l.startsWith('==') && !/^[0-9]+\.$/.test(l));

    if (lines.length === 0) return null;

    return {
      word: page.title,
      meanings: lines.slice(0, 3),
      source: 'Wiktionary (EN)',
      url: `https://en.wiktionary.org/wiki/${encodeURIComponent(page.title)}`,
      lang: 'en',
    };
  } catch {
    return null;
  }
}

// ─── Fonte 6: Wikipedia EN ────────────────────────────────────────────────────
// Último recurso — cobre conceitos com verbetes só em inglês.
async function tryWikipediaEN(term: string): Promise<DefinitionResult | null> {
  try {
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`;
    const res = await fetch(summaryUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.type === 'disambiguation' || !data.extract) return null;

    const firstParagraph = data.extract.split('\n')[0];
    if (!firstParagraph || firstParagraph.length < 30) return null;

    return {
      word: data.title,
      meanings: [firstParagraph],
      source: 'Wikipedia (EN)',
      url: data.content_urls?.desktop?.page,
      lang: 'en',
    };
  } catch {
    return null;
  }
}

// ─── Orquestrador principal ───────────────────────────────────────────────────
export async function fetchDefinition(term: string): Promise<DefinitionResult | null> {
  const cleanTerm = term.trim();

  if (!cleanTerm) return null;

  // Limite: frases longas não são termos consultáveis
  if (cleanTerm.split(/\s+/).length > 6) {
    throw new Error('Selecione um termo mais curto.');
  }

  // Cache em memória — evita re-fetch na mesma sessão
  const cacheKey = cleanTerm.toLowerCase();
  if (_cache.has(cacheKey)) return _cache.get(cacheKey)!;

  const lang = detectLang(cleanTerm);

  let result: DefinitionResult | null = null;

  if (lang === 'en') {
    // Pipeline para termos em inglês
    result =
      (await tryFreeDictionaryEN(cleanTerm)) ||
      (await tryWiktionaryEN(cleanTerm)) ||
      (await tryWikipediaEN(cleanTerm)) ||
      // Fallback: talvez seja um conceito com verbete PT também
      (await tryWiktionaryPT(cleanTerm)) ||
      (await tryWikipediaPT(cleanTerm));

  } else if (lang === 'la') {
    // Pipeline para latinismos acadêmicos
    // Wiktionary EN tem a melhor cobertura de latim clássico
    result =
      (await tryWiktionaryEN(cleanTerm)) ||
      (await tryWiktionaryPT(cleanTerm)) ||
      (await tryWikipediaPT(cleanTerm)) ||
      (await tryWikipediaEN(cleanTerm));

  } else {
    // Pipeline padrão PT (inclui termos ambíguos e 'other')
    result =
      (await tryWiktionaryPT(cleanTerm)) ||
      (await tryDicionarioAberto(cleanTerm)) ||
      (await tryWikipediaPT(cleanTerm)) ||
      // Se tudo falhou em PT, tenta EN — termo pode ser estrangeirismo
      (await tryFreeDictionaryEN(cleanTerm)) ||
      (await tryWiktionaryEN(cleanTerm)) ||
      (await tryWikipediaEN(cleanTerm));
  }

  _cache.set(cacheKey, result);
  return result;
}

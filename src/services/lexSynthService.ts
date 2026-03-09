/**
 * lexSynthService.ts
 * Lógica de negócio do Sintetizador Lexicográfico.
 *
 * Responsabilidades:
 *  - Extrair anotações tagueadas de um arquivo via contentRepository
 *  - Preencher células em modo LITERAL ou SÍNTESE IA (gemini-3-flash-preview)
 *  - Serializar/deserializar LexSynthTable (Blob JSON)
 *  - Exportar para Markdown
 *
 * Sem polling. Sem dependências novas. Usa stack existente.
 */

import { getAiClient, withKeyRotation } from './aiService';
import { loadAnnotations } from './storageService';
import type { LexSynthTable, LexSynthColumn, LexSynthCell, LexSynthRow } from '../types';

// ── Extração de anotações tagueadas ──────────────────────────────────────────

interface TaggedSnippet {
  text: string;
  page: number;
}

/**
 * Retorna um map: tag (sem #, lowercase) → trechos com página.
 * Considera tanto o campo `tags[]` da Annotation quanto tags inline no texto (#palavra).
 */
export async function getSnippetsByTag(
  uid: string,
  fileId: string
): Promise<Map<string, TaggedSnippet[]>> {
  const annotations = await loadAnnotations(uid, fileId);
  const map = new Map<string, TaggedSnippet[]>();

  for (const ann of annotations) {
    if (!ann.text?.trim() || ann.type === 'note') continue;

    const tags = new Set<string>();

    // Campo tags[] explícito
    if (Array.isArray(ann.tags)) {
      ann.tags.forEach(t => tags.add(t.toLowerCase().replace(/^#/, '')));
    }

    // Tags inline no texto: #palavra (suporte a acentuação)
    const inline = ann.text.match(/#[\w\u00C0-\u024F]+/g) || [];
    inline.forEach(t => tags.add(t.slice(1).toLowerCase()));

    for (const tag of tags) {
      if (!map.has(tag)) map.set(tag, []);
      map.get(tag)!.push({ text: ann.text.trim(), page: ann.page });
    }
  }

  // Ordenar por página dentro de cada tag
  for (const snippets of map.values()) {
    snippets.sort((a, b) => a.page - b.page);
  }

  return map;
}

// ── Preenchimento de células ──────────────────────────────────────────────────

/**
 * Modo LITERAL: concatena trechos em ordem de página.
 * Se não houver trechos, retorna '—'.
 */
export function fillLiteral(snippets: TaggedSnippet[]): LexSynthCell {
  if (snippets.length === 0) return { content: '—', pages: [] };
  const pages = [...new Set(snippets.map(s => s.page))];
  const content = snippets.map(s => `(p.\u00a0${s.page}) ${s.text}`).join('\n\n');
  return { content, pages };
}

/**
 * Modo SÍNTESE IA: envia trechos para Kalaki e retorna síntese com páginas.
 * Fallback para literal em caso de falha de API.
 */
export async function fillAi(
  snippets: TaggedSnippet[],
  columnName: string,
  documentName: string
): Promise<LexSynthCell> {
  if (snippets.length === 0) return { content: '—', pages: [] };

  const pages = [...new Set(snippets.map(s => s.page))];
  const trechos = snippets.map(s => `[p.\u00a0${s.page}] ${s.text}`).join('\n\n');

  const prompt =
    `Você é um assistente de pesquisa acadêmica rigoroso. ` +
    `Sintetize os trechos abaixo, extraídos do documento "${documentName}", ` +
    `sobre o tema "${columnName}". ` +
    `Seja conciso e preserve o sentido original. ` +
    `Ao final, indique entre parênteses as páginas de onde os trechos foram retirados.\n\n` +
    `Trechos:\n${trechos}`;

  try {
    const ai = getAiClient();
    const result = await withKeyRotation(() =>
      ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.2 },
      })
    );
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!text) throw new Error('empty');
    return { content: text, pages };
  } catch {
    // Fallback gracioso — não quebra a tabela
    const fallback = fillLiteral(snippets);
    return {
      ...fallback,
      content: fallback.content + '\n\n⚠\ufe0f Síntese IA indisponível — trechos literais exibidos.',
    };
  }
}

// ── Preenchimento de uma linha completa ──────────────────────────────────────

/**
 * Preenche todas as células de uma linha (documento) para todas as colunas.
 * Chamado em ordem — cada coluna pode ter fill mode independente.
 */
export async function fillRow(
  uid: string,
  row: LexSynthRow,
  columns: LexSynthColumn[]
): Promise<LexSynthRow> {
  const snippetMap = await getSnippetsByTag(uid, row.fileId);
  const cells: Record<string, LexSynthCell> = {};

  for (const col of columns) {
    // Agrega snippets de todas as tags mapeadas para esta coluna
    const snippets: TaggedSnippet[] = [];
    for (const tag of col.tags) {
      const s = snippetMap.get(tag.toLowerCase()) || [];
      snippets.push(...s);
    }
    // Deduplica por página+texto
    const seen = new Set<string>();
    const unique = snippets.filter(s => {
      const key = `${s.page}::${s.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    unique.sort((a, b) => a.page - b.page);

    cells[col.id] =
      col.fillMode === 'ai'
        ? await fillAi(unique, col.name, row.fileName)
        : fillLiteral(unique);
  }

  return { ...row, cells };
}

// ── Serialização / Deserialização ─────────────────────────────────────────────

export const LEXSYNTH_MIME = 'application/vnd.lectorium.lexsynth+json';
export const LEXSYNTH_EXT = '.lexsynth';

export function serializeTable(table: LexSynthTable): Blob {
  return new Blob([JSON.stringify(table, null, 2)], { type: LEXSYNTH_MIME });
}

export async function deserializeTable(blob: Blob): Promise<LexSynthTable> {
  const text = await blob.text();
  return JSON.parse(text) as LexSynthTable;
}

// ── Exportação Markdown ───────────────────────────────────────────────────────

export function exportToMarkdown(table: LexSynthTable): string {
  const { name, columns, rows } = table;
  if (columns.length === 0 || rows.length === 0) return `# ${name}\n\n_Tabela vazia._`;

  const header = ['| Documento |', ...columns.map(c => `| ${c.name} |`)].join(' ');
  const separator = ['| --- |', ...columns.map(() => '| --- |')].join(' ');

  const bodyRows = rows.map(row => {
    const docCell = `| **${row.fileName}** |`;
    const dataCells = columns.map(col => {
      const cell = row.cells[col.id];
      if (!cell || cell.content === '—') return '| — |';
      const escaped = cell.content.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
      const pagesNote = cell.pages.length ? ` _(pp.\u00a0${cell.pages.join(', ')})_` : '';
      return `| ${escaped}${pagesNote} |`;
    });
    return [docCell, ...dataCells].join(' ');
  });

  return `# ${name}\n\n${header}\n${separator}\n${bodyRows.join('\n')}`;
}

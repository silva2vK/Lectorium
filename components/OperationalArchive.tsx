/**
 * OperationalArchive.tsx  —  Sintetizador Lexicográfico v2
 *
 * Rota: activeTab === 'operational-archive' (App.tsx, sem alteração)
 * Serviço: lexSynthService.ts
 * Persistência: Blob JSON salvo localmente ou no Drive (via DriveFile)
 *
 * Design v3 — Direção A+B:
 *   A: Profundidade por superfície (#0a0a0a / #111111 / #1a1a1a)
 *   B: Brand como estrutura (border-l brand nas linhas, border-b brand no thead)
 *
 * Sugestões aplicadas: 1-10
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Database, FileText, Loader2, Download, Plus, X,
  ChevronDown, Copy, Check, Sparkles, AlignLeft,
  FolderOpen, Save, Edit3, Trash2, Tag,
} from 'lucide-react';
import { DriveFile, MIME_TYPES, LexSynthTable, LexSynthColumn, LexSynthRow, LexSynthCell } from '../types';
import { useGlobalContext } from '../context/GlobalContext';
import { useDriveFiles } from '../hooks/useDriveFiles';
import {
  fillRow,
  serializeTable,
  deserializeTable,
  exportToMarkdown,
  LEXSYNTH_EXT,
  LEXSYNTH_MIME,
} from '../services/lexSynthService';
import { v4 as uuidv4 } from 'uuid';

// ── Tokens de superfície (Direção A) ──────────────────────────────────────────
// Três planos de profundidade — não alterar sem revisar toda a hierarquia visual.
const S = {
  base:    '#0a0a0a',  // fundo da página
  mid:     '#111111',  // linhas alternadas, células preenchidas
  raised:  '#1a1a1a',  // header, modais, toolbar
  border:  'rgba(255,255,255,0.07)',
  brand:   'var(--color-brand, #b40000)',
  brandA:  (a: number) => `rgba(var(--brand-rgb, 180,0,0), ${a})`,
} as const;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  accessToken: string;
  uid: string;
  onToggleMenu: () => void;
  openDocxFiles?: DriveFile[];
  onInjectToDocx?: (fileId: string, markdown: string) => void;
}

function emptyTable(name = 'Nova Síntese'): LexSynthTable {
  return { id: uuidv4(), name, createdAt: Date.now(), updatedAt: Date.now(), columns: [], rows: [] };
}

// ── Componente principal ──────────────────────────────────────────────────────

export const OperationalArchive: React.FC<Props> = ({
  accessToken, uid, onToggleMenu, openDocxFiles = [], onInjectToDocx,
}) => {
  const { addNotification } = useGlobalContext();

  const [table, setTable] = useState<LexSynthTable>(emptyTable());
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingRowId, setProcessingRowId] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isColumnEditorOpen, setIsColumnEditorOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<LexSynthColumn | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [tableNameEditing, setTableNameEditing] = useState(false);
  const tableNameRef = useRef<HTMLInputElement>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleRenameTable = useCallback((name: string) => {
    setTable(t => ({ ...t, name: name.trim() || t.name, updatedAt: Date.now() }));
    setTableNameEditing(false);
  }, []);

  const handleSaveColumn = useCallback((col: LexSynthColumn) => {
    setTable(t => {
      const existing = t.columns.find(c => c.id === col.id);
      const columns = existing ? t.columns.map(c => c.id === col.id ? col : c) : [...t.columns, col];
      const rows = t.rows.map(row => ({
        ...row,
        cells: existing ? row.cells : { ...row.cells, [col.id]: { content: '', pages: [] } },
      }));
      return { ...t, columns, rows, updatedAt: Date.now() };
    });
    setEditingColumn(null);
    setIsColumnEditorOpen(false);
  }, []);

  const handleDeleteColumn = useCallback((colId: string) => {
    setTable(t => ({
      ...t,
      columns: t.columns.filter(c => c.id !== colId),
      rows: t.rows.map(row => {
        const cells = { ...row.cells };
        delete cells[colId];
        return { ...row, cells };
      }),
      updatedAt: Date.now(),
    }));
  }, []);

  const handleAddFiles = useCallback((files: DriveFile[]) => {
    setTable(t => {
      const newRows: LexSynthRow[] = files
        .filter(f => !t.rows.find(r => r.fileId === f.id))
        .map(f => ({
          fileId: f.id, fileName: f.name, hasOcr: false,
          cells: Object.fromEntries(t.columns.map(c => [c.id, { content: '', pages: [] }])),
        }));
      return { ...t, rows: [...t.rows, ...newRows], updatedAt: Date.now() };
    });
    setIsPickerOpen(false);
  }, []);

  const handleRemoveRow = useCallback((fileId: string) => {
    setTable(t => ({ ...t, rows: t.rows.filter(r => r.fileId !== fileId), updatedAt: Date.now() }));
  }, []);

  const processRow = useCallback(async (row: LexSynthRow) => {
    if (table.columns.length === 0) { addNotification('Defina pelo menos uma coluna antes de processar.', 'error'); return; }
    setProcessingRowId(row.fileId);
    try {
      const filled = await fillRow(uid, row, table.columns);
      setTable(t => ({ ...t, rows: t.rows.map(r => r.fileId === filled.fileId ? filled : r), updatedAt: Date.now() }));
    } catch (e: any) {
      addNotification(`Erro ao processar "${row.fileName}": ${e.message}`, 'error');
    } finally {
      setProcessingRowId(null);
    }
  }, [uid, table.columns, addNotification]);

  const processAll = useCallback(async () => {
    if (table.rows.length === 0 || table.columns.length === 0) {
      addNotification('Adicione documentos e colunas antes de processar.', 'error'); return;
    }
    setIsProcessing(true);
    for (const row of table.rows) {
      setProcessingRowId(row.fileId);
      try {
        const filled = await fillRow(uid, row, table.columns);
        setTable(t => ({ ...t, rows: t.rows.map(r => r.fileId === filled.fileId ? filled : r), updatedAt: Date.now() }));
      } catch { addNotification(`Falha ao processar "${row.fileName}".`, 'error'); }
    }
    setProcessingRowId(null);
    setIsProcessing(false);
    addNotification('Síntese concluída.', 'success');
  }, [uid, table.rows, table.columns, addNotification]);

  const handleCellEdit = useCallback((rowId: string, colId: string, content: string) => {
    setTable(t => ({
      ...t,
      rows: t.rows.map(r =>
        r.fileId === rowId ? { ...r, cells: { ...r.cells, [colId]: { ...r.cells[colId], content } } } : r
      ),
      updatedAt: Date.now(),
    }));
  }, []);

  const handleToggleUsed = useCallback((rowId: string, colId: string) => {
    setTable(t => ({
      ...t,
      rows: t.rows.map(r =>
        r.fileId === rowId
          ? { ...r, cells: { ...r.cells, [colId]: { ...r.cells[colId], isUsed: !r.cells[colId]?.isUsed } } }
          : r
      ),
    }));
  }, []);

  const handleCopyCell = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCell(key);
      setTimeout(() => setCopiedCell(null), 1500);
    });
  }, []);

  const handleSaveLocal = useCallback(() => {
    const blob = serializeTable(table);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${table.name.replace(/\s+/g, '_')}${LEXSYNTH_EXT}`; a.click();
    URL.revokeObjectURL(url);
    addNotification('Tabela salva.', 'success');
  }, [table, addNotification]);

  const handleLoadFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const loaded = await deserializeTable(file);
      setTable(loaded);
      addNotification(`"${loaded.name}" carregada.`, 'success');
    } catch { addNotification('Arquivo inválido ou corrompido.', 'error'); }
    e.target.value = '';
  }, [addNotification]);

  const handleExportMarkdown = useCallback(() => {
    const md = exportToMarkdown(table);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${table.name.replace(/\s+/g, '_')}.md`; a.click();
    URL.revokeObjectURL(url);
  }, [table]);

  const handleCopyMarkdown = useCallback(() => {
    navigator.clipboard.writeText(exportToMarkdown(table)).then(() =>
      addNotification('Markdown copiado.', 'success')
    );
  }, [table, addNotification]);

  // ── Métricas (Sugestão 8) ─────────────────────────────────────────────────────

  const totalCells = table.rows.length * table.columns.length;
  const filledCells = table.rows.reduce((acc, row) =>
    acc + Object.values(row.cells).filter(c => c.content && c.content !== '—').length, 0
  );
  const hasContent = table.rows.length > 0 && table.columns.length > 0;
  const allEmpty = hasContent && filledCells === 0;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full text-text relative overflow-hidden" style={{ background: S.base }}>

      {/* ── Header (superfície raised) */}
      <div
        className="px-4 py-3 md:px-5 border-b flex items-center justify-between sticky top-0 backdrop-blur-sm z-20 shrink-0 gap-3"
        style={{ background: S.raised, borderColor: S.border }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={onToggleMenu} className="p-2 -ml-2 text-text-sec hover:text-text rounded-full hover:bg-white/5 active:scale-95 shrink-0">
            <Database size={22} className="text-brand" />
          </button>

          {tableNameEditing ? (
            <input
              ref={tableNameRef} autoFocus defaultValue={table.name}
              className="border border-brand/40 rounded-lg px-3 py-1 text-base font-bold text-white focus:outline-none focus:border-brand w-full max-w-xs"
              style={{ background: S.mid }}
              onBlur={e => handleRenameTable(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRenameTable((e.target as HTMLInputElement).value)}
            />
          ) : (
            <button onClick={() => setTableNameEditing(true)} className="flex items-center gap-2 group min-w-0" title="Renomear">
              <span className="text-base font-bold text-white truncate">{table.name}</span>
              <Edit3 size={13} className="text-white/20 group-hover:text-brand transition-colors shrink-0" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <label
            className="flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-xs font-bold text-text-sec cursor-pointer hover:border-brand/40 hover:text-white transition-all"
            style={{ background: S.mid, borderColor: S.border }}
          >
            <FolderOpen size={14} /> Abrir
            <input type="file" accept={LEXSYNTH_EXT} className="hidden" onChange={handleLoadFile} />
          </label>

          <button
            onClick={handleSaveLocal}
            className="flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-xs font-bold text-text-sec hover:border-brand/40 hover:text-white transition-all"
            style={{ background: S.mid, borderColor: S.border }}
          >
            <Save size={14} /> Salvar
          </button>

          <ExportMenu
            onMarkdown={handleExportMarkdown} onCopyMd={handleCopyMarkdown}
            openDocxFiles={openDocxFiles}
            onInjectToDocx={docxId => {
              onInjectToDocx?.(docxId, exportToMarkdown(table));
              addNotification('Conteúdo inserido no documento.', 'success');
            }}
          />

          <button
            onClick={processAll}
            disabled={isProcessing || table.rows.length === 0 || table.columns.length === 0}
            className="flex items-center gap-1.5 bg-brand text-bg px-3 py-1.5 rounded-lg text-xs font-bold hover:brightness-110 shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Processar Tudo
          </button>
        </div>
      </div>

      {/* ── Corpo */}
      <div className="flex-1 overflow-auto custom-scrollbar p-4 md:p-5">

        {/* Empty state */}
        {!hasContent && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-text-sec opacity-50">
            <Database size={48} />
            <p className="text-sm text-center max-w-xs">Adicione documentos e defina colunas para começar a sintetizar.</p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setIsPickerOpen(true)}
                className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm font-bold text-text hover:border-brand/40 transition-all"
                style={{ background: S.raised, borderColor: S.border }}
              >
                <Plus size={16} /> Adicionar PDFs
              </button>
              <button
                onClick={() => { setEditingColumn(null); setIsColumnEditorOpen(true); }}
                className="flex items-center gap-2 bg-brand text-bg px-4 py-2 rounded-lg text-sm font-bold hover:brightness-110 transition-all"
              >
                <Tag size={16} /> Nova Coluna
              </button>
            </div>
          </div>
        )}

        {hasContent && (
          <div className="space-y-3">

            {/* Toolbar + métricas (Sugestão 8) */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPickerOpen(true)}
                  className="flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-xs font-bold text-text-sec hover:text-white hover:border-brand/40 transition-all"
                  style={{ background: S.raised, borderColor: S.border }}
                >
                  <Plus size={13} /> PDF
                </button>
                <button
                  onClick={() => { setEditingColumn(null); setIsColumnEditorOpen(true); }}
                  className="flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-xs font-bold text-text-sec hover:text-white hover:border-brand/40 transition-all"
                  style={{ background: S.raised, borderColor: S.border }}
                >
                  <Tag size={13} /> Coluna
                </button>
              </div>
              <span className="text-[10px] font-mono text-text-sec">
                {table.rows.length} docs · {table.columns.length} colunas ·{' '}
                <span className={filledCells === totalCells && totalCells > 0 ? 'text-brand' : ''}>
                  {filledCells}/{totalCells} células
                </span>
              </span>
            </div>

            {/* Sugestão 9 — faixa de orientação quando todas células vazias */}
            {allEmpty && (
              <div
                className="flex items-center justify-between px-4 py-2.5 rounded-xl border"
                style={{ background: S.brandA(0.05), borderColor: S.brandA(0.2) }}
              >
                <span className="text-xs text-text-sec">
                  Nenhuma célula processada ainda. Clique em{' '}
                  <span className="text-white font-bold">Processar Tudo</span> para iniciar.
                </span>
                <button
                  onClick={processAll}
                  className="flex items-center gap-1.5 bg-brand text-bg px-3 py-1.5 rounded-lg text-xs font-bold hover:brightness-110 transition-all shrink-0 ml-4"
                >
                  <Sparkles size={12} /> Processar Tudo
                </button>
              </div>
            )}

            {/* Tabela */}
            <div
              className="rounded-xl border overflow-hidden relative"
              style={{ borderColor: S.border, background: S.base }}
            >
              {/* Sugestão 10 — indicador de overflow horizontal */}
              <div
                className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-20"
                style={{ background: `linear-gradient(to right, transparent, ${S.base})` }}
              />

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    {/* Sugestão 1 — header com superfície raised + border-b brand (Direção B) */}
                    <tr style={{ background: S.raised }}>
                      <th
                        className="px-4 py-3 text-xs font-bold text-text-sec uppercase tracking-wider min-w-[180px] sticky left-0 z-10"
                        style={{
                          background: S.raised,
                          borderBottom: `2px solid ${S.brandA(0.4)}`,
                        }}
                      >
                        Documento
                      </th>

                      {table.columns.map(col => (
                        <th
                          key={col.id}
                          className="px-4 py-3 min-w-[220px] max-w-[320px]"
                          style={{
                            background: S.raised,
                            borderBottom: `2px solid ${S.brandA(0.4)}`,
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {col.fillMode === 'ai'
                                ? <Sparkles size={12} className="text-brand shrink-0" />
                                : <AlignLeft size={12} className="text-text-sec shrink-0" />}
                              <span className="text-xs font-bold text-white uppercase tracking-wider truncate">
                                {col.name}
                              </span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => { setEditingColumn(col); setIsColumnEditorOpen(true); }}
                                className="p-1 text-text-sec hover:text-brand rounded transition-colors"
                              >
                                <Edit3 size={11} />
                              </button>
                              <button
                                onClick={() => handleDeleteColumn(col.id)}
                                className="p-1 text-text-sec hover:text-red-400 rounded transition-colors"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          </div>
                          {/* Sugestão 6 — tags maiores, mais legíveis */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {col.tags.map(tag => (
                              <span
                                key={tag}
                                className="text-[10px] font-mono px-2 py-0.5 rounded border"
                                style={{
                                  background: S.brandA(0.1),
                                  borderColor: S.brandA(0.25),
                                  color: S.brand,
                                }}
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </th>
                      ))}

                      <th
                        className="px-3 py-3 w-12"
                        style={{ background: S.raised, borderBottom: `2px solid ${S.brandA(0.4)}` }}
                      />
                    </tr>
                  </thead>

                  <tbody>
                    {table.rows.map((row, ri) => {
                      const isRowProcessing = processingRowId === row.fileId;
                      const rowBg = ri % 2 === 0 ? S.base : S.mid;

                      return (
                        <tr
                          key={row.fileId}
                          className="border-b transition-colors group hover:brightness-125"
                          style={{ background: rowBg, borderColor: S.border }}
                        >
                          {/* Sugestão 4 — coluna documento com border-l brand (Direção B) */}
                          <td
                            className="px-4 py-3 sticky left-0 z-10 border-r"
                            style={{
                              background: rowBg,
                              borderLeft: `2px solid ${S.brandA(0.45)}`,
                              borderRightColor: S.border,
                            }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText size={14} className="text-brand shrink-0" />
                              <span className="text-xs font-medium text-white truncate max-w-[140px]" title={row.fileName}>
                                {row.fileName}
                              </span>
                            </div>
                            <button
                              onClick={() => processRow(row)}
                              disabled={isRowProcessing || isProcessing}
                              className="mt-1.5 text-[9px] font-bold text-text-sec hover:text-brand transition-colors flex items-center gap-1 disabled:opacity-40"
                            >
                              {isRowProcessing
                                ? <><Loader2 size={9} className="animate-spin" /> Processando…</>
                                : <><Sparkles size={9} /> Re-processar</>}
                            </button>
                          </td>

                          {/* Células */}
                          {table.columns.map(col => {
                            const cell = row.cells[col.id] || { content: '', pages: [] };
                            const isEmpty = !cell.content || cell.content === '—';
                            const cellKey = `${row.fileId}::${col.id}`;
                            const isEditing = editingCell?.rowId === row.fileId && editingCell?.colId === col.id;

                            return (
                              <td key={col.id} className="px-3 py-2 align-top max-w-[320px]">
                                {isEditing ? (
                                  <textarea
                                    autoFocus
                                    className="w-full min-h-[100px] border border-brand/40 rounded-lg p-2 text-xs text-white resize-none focus:outline-none focus:border-brand custom-scrollbar"
                                    style={{ background: S.base }}
                                    defaultValue={cell.content}
                                    onBlur={e => { handleCellEdit(row.fileId, col.id, e.target.value); setEditingCell(null); }}
                                  />
                                ) : isRowProcessing ? (
                                  /* Sugestão 5 — shimmer por célula durante processamento */
                                  <div
                                    className="rounded-lg min-h-[52px] animate-pulse"
                                    style={{ background: S.brandA(0.07) }}
                                  />
                                ) : (
                                  <div
                                    className={`group/cell relative rounded-lg p-2.5 min-h-[52px] transition-all cursor-text
                                      ${isEmpty ? 'border border-dashed' : 'border hover:border-white/15'}
                                      ${cell.isUsed ? 'opacity-55' : ''}
                                    `}
                                    style={{
                                      /* Sugestão 3 — célula preenchida elevada (Direção A) */
                                      background: isEmpty ? 'transparent' : S.raised,
                                      borderColor: isEmpty ? S.border : 'rgba(255,255,255,0.09)',
                                      /* Sugestão 7 — isUsed com border-l brand em vez de opacity total */
                                      ...(cell.isUsed ? { borderLeft: `2px solid ${S.brandA(0.35)}` } : {}),
                                    }}
                                    onClick={() => setEditingCell({ rowId: row.fileId, colId: col.id })}
                                  >
                                    {isEmpty ? (
                                      /* Sugestão 2 — ícone fantasma no vazio */
                                      <div className="flex items-center justify-center h-8 opacity-[0.08] pointer-events-none">
                                        {col.fillMode === 'ai' ? <Sparkles size={18} /> : <AlignLeft size={18} />}
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-text leading-relaxed whitespace-pre-wrap break-words line-clamp-6">
                                        {cell.content}
                                      </p>
                                    )}

                                    {cell.pages && cell.pages.length > 0 && (
                                      <div className="mt-1.5 text-[9px] font-mono text-text-sec">
                                        pp.&nbsp;{cell.pages.join(', ')}
                                      </div>
                                    )}

                                    {!isEmpty && (
                                      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                        <button
                                          onClick={e => { e.stopPropagation(); handleCopyCell(cellKey, cell.content); }}
                                          className="p-1 border rounded text-text-sec hover:text-white transition-colors"
                                          style={{ background: S.base, borderColor: S.border }}
                                          title="Copiar"
                                        >
                                          {copiedCell === cellKey ? <Check size={10} className="text-brand" /> : <Copy size={10} />}
                                        </button>
                                        <button
                                          onClick={e => { e.stopPropagation(); handleToggleUsed(row.fileId, col.id); }}
                                          className={`p-1 border rounded transition-colors ${cell.isUsed ? 'text-brand border-brand/30' : 'text-text-sec border-white/10 hover:text-brand'}`}
                                          style={{ background: S.base }}
                                          title={cell.isUsed ? 'Desmarcar citação' : 'Marcar como citado'}
                                        >
                                          <Check size={10} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          <td className="px-2 py-3 align-top">
                            <button
                              onClick={() => handleRemoveRow(row.fileId)}
                              className="p-1.5 text-text-sec hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                              title="Remover"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Estados parciais */}
        {(table.rows.length > 0 && table.columns.length === 0) && (
          <div className="mt-4 p-4 border border-dashed rounded-xl text-center text-sm text-text-sec"
            style={{ borderColor: S.border, background: S.raised }}>
            Defina pelo menos uma coluna para visualizar a tabela.{' '}
            <button onClick={() => { setEditingColumn(null); setIsColumnEditorOpen(true); }} className="text-brand hover:underline font-bold">
              Nova Coluna
            </button>
          </div>
        )}
        {(table.rows.length === 0 && table.columns.length > 0) && (
          <div className="mt-4 p-4 border border-dashed rounded-xl text-center text-sm text-text-sec"
            style={{ borderColor: S.border, background: S.raised }}>
            Adicione documentos à tabela.{' '}
            <button onClick={() => setIsPickerOpen(true)} className="text-brand hover:underline font-bold">
              Adicionar PDFs
            </button>
          </div>
        )}
      </div>

      {/* Modais */}
      {isPickerOpen && (
        <MultiFilePicker
          accessToken={accessToken}
          existingIds={new Set(table.rows.map(r => r.fileId))}
          onClose={() => setIsPickerOpen(false)}
          onSelect={handleAddFiles}
        />
      )}
      {isColumnEditorOpen && (
        <ColumnEditor
          column={editingColumn}
          onSave={handleSaveColumn}
          onClose={() => { setEditingColumn(null); setIsColumnEditorOpen(false); }}
        />
      )}
    </div>
  );
};

// ── ColumnEditor ──────────────────────────────────────────────────────────────

const S2 = {
  base: '#0a0a0a', mid: '#111111', raised: '#1a1a1a',
  border: 'rgba(255,255,255,0.07)',
  brandA: (a: number) => `rgba(var(--brand-rgb, 180,0,0), ${a})`,
  brand: 'var(--color-brand, #b40000)',
};

interface ColumnEditorProps {
  column: LexSynthColumn | null;
  onSave: (col: LexSynthColumn) => void;
  onClose: () => void;
}

const ColumnEditor: React.FC<ColumnEditorProps> = ({ column, onSave, onClose }) => {
  const [name, setName] = useState(column?.name || '');
  const [tagsRaw, setTagsRaw] = useState(column?.tags.join(', ') || '');
  const [fillMode, setFillMode] = useState<'literal' | 'ai'>(column?.fillMode || 'literal');

  const parseTags = (raw: string) =>
    raw.split(/[\s,]+/).map(t => t.replace(/^#/, '').toLowerCase().trim()).filter(Boolean);

  const handleSave = () => {
    const tags = parseTags(tagsRaw);
    if (!name.trim() || tags.length === 0) return;
    onSave({ id: column?.id || uuidv4(), name: name.trim(), tags, fillMode });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="border rounded-2xl w-full max-w-md shadow-2xl" style={{ background: S2.raised, borderColor: S2.border }}>
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: S2.border }}>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Tag size={16} className="text-brand" />
            {column ? 'Editar Coluna' : 'Nova Coluna'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-text-sec hover:text-white rounded-lg hover:bg-white/5"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-text-sec uppercase tracking-wider block mb-1.5">Nome da Coluna</label>
            <input
              autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="ex: Metodologia"
              className="w-full border rounded-lg px-3 py-2 text-sm text-white placeholder-text-sec focus:outline-none focus:border-brand transition-colors"
              style={{ background: S2.mid, borderColor: S2.border }}
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-text-sec uppercase tracking-wider block mb-1.5">
              Tags mapeadas <span className="text-brand font-mono">(vírgula ou espaço)</span>
            </label>
            <input
              value={tagsRaw} onChange={e => setTagsRaw(e.target.value)} placeholder="ex: metodologia, método"
              className="w-full border rounded-lg px-3 py-2 text-sm text-white placeholder-text-sec focus:outline-none focus:border-brand transition-colors font-mono"
              style={{ background: S2.mid, borderColor: S2.border }}
            />
            {tagsRaw && (
              <div className="flex flex-wrap gap-1 mt-2">
                {parseTags(tagsRaw).map(t => (
                  <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded border"
                    style={{ background: S2.brandA(0.1), borderColor: S2.brandA(0.25), color: S2.brand }}>
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-bold text-text-sec uppercase tracking-wider block mb-1.5">Modo de preenchimento</label>
            <div className="grid grid-cols-2 gap-2">
              {(['literal', 'ai'] as const).map(mode => (
                <button
                  key={mode} onClick={() => setFillMode(mode)}
                  className={`p-3 rounded-xl border text-left transition-all ${fillMode === mode ? 'border-brand bg-brand/10 text-brand' : 'text-text-sec hover:border-brand/30'}`}
                  style={fillMode !== mode ? { background: S2.mid, borderColor: S2.border } : {}}
                >
                  {mode === 'literal' ? <AlignLeft size={16} className="mb-1.5" /> : <Sparkles size={16} className="mb-1.5" />}
                  <p className="text-xs font-bold">{mode === 'literal' ? 'Trecho Literal' : 'Síntese IA'}</p>
                  <p className="text-[10px] opacity-70 mt-0.5">
                    {mode === 'literal' ? 'Exibe o trecho exato + página.' : 'Kalaki sintetiza e cita páginas.'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2 rounded-b-2xl" style={{ background: S2.mid, borderColor: S2.border }}>
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-text-sec hover:text-white transition-colors">Cancelar</button>
          <button
            onClick={handleSave} disabled={!name.trim() || parseTags(tagsRaw).length === 0}
            className="px-4 py-2 bg-brand text-bg rounded-lg text-sm font-bold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Salvar Coluna
          </button>
        </div>
      </div>
    </div>
  );
};

// ── ExportMenu ────────────────────────────────────────────────────────────────

interface ExportMenuProps {
  onMarkdown: () => void;
  onCopyMd: () => void;
  openDocxFiles: DriveFile[];
  onInjectToDocx: (fileId: string) => void;
}

const ExportMenu: React.FC<ExportMenuProps> = ({ onMarkdown, onCopyMd, openDocxFiles, onInjectToDocx }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-xs font-bold text-text-sec hover:border-brand/40 hover:text-white transition-all"
        style={{ background: S2.mid, borderColor: S2.border }}
      >
        <Download size={14} /> Exportar <ChevronDown size={11} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 border rounded-xl shadow-2xl w-52 z-50 overflow-hidden"
          style={{ background: S2.raised, borderColor: S2.border }}
        >
          <button onClick={() => { onMarkdown(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-text hover:bg-white/5 transition-colors text-left">
            <Download size={13} /> Baixar .md
          </button>
          <button onClick={() => { onCopyMd(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-text hover:bg-white/5 transition-colors text-left">
            <Copy size={13} /> Copiar Markdown
          </button>
          {openDocxFiles.length > 0 && (
            <>
              <div className="border-t mx-2 my-1" style={{ borderColor: S2.border }} />
              <div className="px-4 py-1.5 text-[10px] font-bold text-text-sec uppercase tracking-wider">Inserir em DOCX aberto</div>
              {openDocxFiles.map(f => (
                <button key={f.id} onClick={() => { onInjectToDocx(f.id); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-text hover:bg-white/5 transition-colors text-left">
                  <FileText size={13} className="text-brand" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── MultiFilePicker ───────────────────────────────────────────────────────────

interface MultiFilePickerProps {
  accessToken: string;
  existingIds: Set<string>;
  onClose: () => void;
  onSelect: (files: DriveFile[]) => void;
}

const MultiFilePicker: React.FC<MultiFilePickerProps> = ({ accessToken, existingIds, onClose, onSelect }) => {
  const { files, loading, handleFolderClick, handleNavigateUp, folderHistory } = useDriveFiles(accessToken, 'default');
  const [selected, setSelected] = useState<Map<string, DriveFile>>(new Map());

  const toggleSelect = (file: DriveFile) => {
    if (file.mimeType === MIME_TYPES.FOLDER) { handleFolderClick(file); return; }
    const next = new Map(selected);
    if (next.has(file.id)) next.delete(file.id); else next.set(file.id, file);
    setSelected(next);
  };

  const handleLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const id = `local-${Date.now()}`;
    onSelect([{ id, name: f.name, mimeType: f.type || 'application/pdf', blob: f }]);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="border rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl"
        style={{ background: S2.raised, borderColor: S2.border }}>

        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: S2.border }}>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Database size={18} className="text-brand" /> Selecionar Documentos
          </h2>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-xs font-bold text-text-sec cursor-pointer hover:border-brand/40 hover:text-white transition-all"
              style={{ background: S2.mid, borderColor: S2.border }}>
              <Plus size={13} /> Local
              <input type="file" accept=".pdf" className="hidden" onChange={handleLocalFile} />
            </label>
            <button onClick={onClose} className="p-1.5 text-text-sec hover:text-white rounded-lg hover:bg-white/5"><X size={18} /></button>
          </div>
        </div>

        <div className="px-3 py-2 border-b flex items-center gap-2 text-xs text-text-sec overflow-x-auto"
          style={{ background: S2.mid, borderColor: S2.border }}>
          {folderHistory.map((folder, i) => (
            <React.Fragment key={folder.id}>
              {i > 0 && <span className="opacity-40">/</span>}
              <button
                onClick={() => { for (let j = folderHistory.length - 1; j > i; j--) handleNavigateUp(); }}
                className={`hover:text-white transition-colors whitespace-nowrap ${i === folderHistory.length - 1 ? 'text-white font-medium' : ''}`}
              >
                {folder.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-brand" /></div>
          ) : (
            <div className="space-y-0.5">
              {files.map(f => {
                const isFolder = f.mimeType === MIME_TYPES.FOLDER;
                const isAlreadyAdded = existingIds.has(f.id);
                const isSel = selected.has(f.id);
                return (
                  <div
                    key={f.id}
                    onClick={() => !isAlreadyAdded && toggleSelect(f)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors border
                      ${isAlreadyAdded ? 'opacity-40 cursor-not-allowed border-transparent' : 'cursor-pointer'}
                      ${isSel ? 'border-brand/30' : 'hover:bg-white/5 border-transparent'}
                    `}
                    style={isSel ? { background: S2.brandA(0.07) } : {}}
                  >
                    <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                      {isFolder ? <FolderOpen size={16} className="text-text-sec" />
                        : isSel ? <Check size={16} className="text-brand" />
                        : <FileText size={16} className="text-text-sec" />}
                    </div>
                    <p className="text-sm text-white truncate flex-1">{f.name}</p>
                    {isAlreadyAdded && <span className="text-[9px] text-text-sec font-mono">já adicionado</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-between items-center rounded-b-2xl"
          style={{ background: S2.mid, borderColor: S2.border }}>
          <span className="text-xs text-text-sec">{selected.size} selecionado(s)</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-text-sec hover:text-white transition-colors">Cancelar</button>
            <button
              onClick={() => onSelect([...selected.values()])} disabled={selected.size === 0}
              className="px-4 py-2 bg-brand text-bg rounded-lg text-sm font-bold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Adicionar ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

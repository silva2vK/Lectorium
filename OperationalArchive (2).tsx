/**
 * OperationalArchive.tsx  —  Sintetizador Lexicográfico v2
 *
 * Rota: activeTab === 'operational-archive' (App.tsx, sem alteração)
 * Serviço: lexSynthService.ts
 * Persistência: Blob JSON salvo localmente ou no Drive (via DriveFile)
 *
 * Fluxo:
 *   1. Usuário cria/abre uma tabela (.lexsynth)
 *   2. Define colunas + tags mapeadas + fill mode por coluna
 *   3. Adiciona PDFs (local ou Drive)
 *   4. Processa → células preenchidas
 *   5. Edita células inline
 *   6. Exporta (Markdown / cópia / injeta em DOCX aberto)
 *   7. Salva a tabela como arquivo
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  accessToken: string;
  uid: string;
  onToggleMenu: () => void;
  /** Arquivos .docx atualmente abertos no workspace — para exportação direta */
  openDocxFiles?: DriveFile[];
  /** Callback para injetar markdown num DOCX aberto */
  onInjectToDocx?: (fileId: string, markdown: string) => void;
}

// ── Estado vazio da tabela ────────────────────────────────────────────────────

function emptyTable(name = 'Nova Síntese'): LexSynthTable {
  return {
    id: uuidv4(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    columns: [],
    rows: [],
  };
}

// ── Componente principal ──────────────────────────────────────────────────────

export const OperationalArchive: React.FC<Props> = ({
  accessToken,
  uid,
  onToggleMenu,
  openDocxFiles = [],
  onInjectToDocx,
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

  // ── Handlers de tabela ──────────────────────────────────────────────────────

  const handleRenameTable = useCallback((name: string) => {
    setTable(t => ({ ...t, name: name.trim() || t.name, updatedAt: Date.now() }));
    setTableNameEditing(false);
  }, []);

  // ── Handlers de colunas ─────────────────────────────────────────────────────

  const handleSaveColumn = useCallback((col: LexSynthColumn) => {
    setTable(t => {
      const existing = t.columns.find(c => c.id === col.id);
      const columns = existing
        ? t.columns.map(c => c.id === col.id ? col : c)
        : [...t.columns, col];
      // Sincronizar células existentes com nova coluna se for nova
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

  // ── Handlers de linhas (documentos) ─────────────────────────────────────────

  const handleAddFiles = useCallback((files: DriveFile[]) => {
    setTable(t => {
      const newRows: LexSynthRow[] = files
        .filter(f => !t.rows.find(r => r.fileId === f.id))
        .map(f => ({
          fileId: f.id,
          fileName: f.name,
          hasOcr: false,
          cells: Object.fromEntries(t.columns.map(c => [c.id, { content: '', pages: [] }])),
        }));
      return { ...t, rows: [...t.rows, ...newRows], updatedAt: Date.now() };
    });
    setIsPickerOpen(false);
  }, []);

  const handleRemoveRow = useCallback((fileId: string) => {
    setTable(t => ({ ...t, rows: t.rows.filter(r => r.fileId !== fileId), updatedAt: Date.now() }));
  }, []);

  // ── Processamento ────────────────────────────────────────────────────────────

  const processRow = useCallback(async (row: LexSynthRow) => {
    if (table.columns.length === 0) {
      addNotification('Defina pelo menos uma coluna antes de processar.', 'error');
      return;
    }
    setProcessingRowId(row.fileId);
    try {
      const filled = await fillRow(uid, row, table.columns);
      setTable(t => ({
        ...t,
        rows: t.rows.map(r => r.fileId === filled.fileId ? filled : r),
        updatedAt: Date.now(),
      }));
    } catch (e: any) {
      addNotification(`Erro ao processar "${row.fileName}": ${e.message}`, 'error');
    } finally {
      setProcessingRowId(null);
    }
  }, [uid, table.columns, addNotification]);

  const processAll = useCallback(async () => {
    if (table.rows.length === 0 || table.columns.length === 0) {
      addNotification('Adicione documentos e colunas antes de processar.', 'error');
      return;
    }
    setIsProcessing(true);
    for (const row of table.rows) {
      setProcessingRowId(row.fileId);
      try {
        const filled = await fillRow(uid, row, table.columns);
        setTable(t => ({
          ...t,
          rows: t.rows.map(r => r.fileId === filled.fileId ? filled : r),
          updatedAt: Date.now(),
        }));
      } catch {
        addNotification(`Falha ao processar "${row.fileName}".`, 'error');
      }
    }
    setProcessingRowId(null);
    setIsProcessing(false);
    addNotification('Síntese concluída.', 'success');
  }, [uid, table.rows, table.columns, addNotification]);

  // ── Edição inline de célula ──────────────────────────────────────────────────

  const handleCellEdit = useCallback((rowId: string, colId: string, content: string) => {
    setTable(t => ({
      ...t,
      rows: t.rows.map(r =>
        r.fileId === rowId
          ? { ...r, cells: { ...r.cells, [colId]: { ...r.cells[colId], content } } }
          : r
      ),
      updatedAt: Date.now(),
    }));
  }, []);

  const handleToggleUsed = useCallback((rowId: string, colId: string) => {
    setTable(t => ({
      ...t,
      rows: t.rows.map(r =>
        r.fileId === rowId
          ? {
              ...r,
              cells: {
                ...r.cells,
                [colId]: { ...r.cells[colId], isUsed: !r.cells[colId]?.isUsed },
              },
            }
          : r
      ),
    }));
  }, []);

  // ── Copiar célula ────────────────────────────────────────────────────────────

  const handleCopyCell = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCell(key);
      setTimeout(() => setCopiedCell(null), 1500);
    });
  }, []);

  // ── Persistência ─────────────────────────────────────────────────────────────

  const handleSaveLocal = useCallback(() => {
    const blob = serializeTable(table);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${table.name.replace(/\s+/g, '_')}${LEXSYNTH_EXT}`;
    a.click();
    URL.revokeObjectURL(url);
    addNotification('Tabela salva.', 'success');
  }, [table, addNotification]);

  const handleLoadFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const loaded = await deserializeTable(file);
      setTable(loaded);
      addNotification(`"${loaded.name}" carregada.`, 'success');
    } catch {
      addNotification('Arquivo inválido ou corrompido.', 'error');
    }
    e.target.value = '';
  }, [addNotification]);

  // ── Exportações ───────────────────────────────────────────────────────────────

  const handleExportMarkdown = useCallback(() => {
    const md = exportToMarkdown(table);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${table.name.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [table]);

  const handleCopyMarkdown = useCallback(() => {
    const md = exportToMarkdown(table);
    navigator.clipboard.writeText(md).then(() =>
      addNotification('Markdown copiado para a área de transferência.', 'success')
    );
  }, [table, addNotification]);

  // ── Render ────────────────────────────────────────────────────────────────────

  const hasContent = table.rows.length > 0 && table.columns.length > 0;

  return (
    <div className="flex flex-col h-full bg-bg text-text relative overflow-hidden">

      {/* Header */}
      <div className="p-4 md:p-5 border-b border-border flex items-center justify-between sticky top-0 bg-bg/95 backdrop-blur-sm z-20 shrink-0 gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={onToggleMenu} className="p-2 -ml-2 text-text-sec hover:text-text rounded-full hover:bg-white/5 active:scale-95 shrink-0">
            <Database size={22} className="text-brand" />
          </button>

          {/* Nome da tabela — clicável para editar */}
          {tableNameEditing ? (
            <input
              ref={tableNameRef}
              autoFocus
              defaultValue={table.name}
              className="bg-surface border border-brand/40 rounded-lg px-3 py-1 text-base font-bold text-white focus:outline-none focus:border-brand w-full max-w-xs"
              onBlur={e => handleRenameTable(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRenameTable((e.target as HTMLInputElement).value)}
            />
          ) : (
            <button
              onClick={() => setTableNameEditing(true)}
              className="flex items-center gap-2 group min-w-0"
              title="Clique para renomear"
            >
              <span className="text-base font-bold text-white truncate">{table.name}</span>
              <Edit3 size={13} className="text-white/30 group-hover:text-brand transition-colors shrink-0" />
            </button>
          )}
        </div>

        {/* Ações do header */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">

          {/* Carregar tabela salva */}
          <label className="flex items-center gap-1.5 bg-surface border border-border text-text-sec px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:border-brand/40 hover:text-white transition-all">
            <FolderOpen size={14} /> Abrir
            <input type="file" accept={LEXSYNTH_EXT} className="hidden" onChange={handleLoadFile} />
          </label>

          {/* Salvar local */}
          <button
            onClick={handleSaveLocal}
            className="flex items-center gap-1.5 bg-surface border border-border text-text-sec px-3 py-1.5 rounded-lg text-xs font-bold hover:border-brand/40 hover:text-white transition-all"
          >
            <Save size={14} /> Salvar
          </button>

          {/* Exportar dropdown simplificado */}
          <ExportMenu
            onMarkdown={handleExportMarkdown}
            onCopyMd={handleCopyMarkdown}
            openDocxFiles={openDocxFiles}
            onInjectToDocx={docxId => {
              const md = exportToMarkdown(table);
              onInjectToDocx?.(docxId, md);
              addNotification('Conteúdo inserido no documento.', 'success');
            }}
          />

          {/* Processar tudo */}
          <button
            onClick={processAll}
            disabled={isProcessing || table.rows.length === 0 || table.columns.length === 0}
            className="flex items-center gap-1.5 bg-brand text-bg px-3 py-1.5 rounded-lg text-xs font-bold hover:brightness-110 shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing
              ? <Loader2 size={14} className="animate-spin" />
              : <Sparkles size={14} />}
            Processar Tudo
          </button>
        </div>
      </div>

      {/* Corpo */}
      <div className="flex-1 overflow-auto custom-scrollbar p-4 md:p-5">

        {/* Empty state */}
        {!hasContent && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-text-sec opacity-60">
            <Database size={48} />
            <p className="text-sm text-center max-w-xs">
              Adicione documentos e defina colunas para começar a sintetizar.
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setIsPickerOpen(true)}
                className="flex items-center gap-2 bg-surface border border-border px-4 py-2 rounded-lg text-sm font-bold text-text hover:border-brand/40 transition-all"
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

        {/* Tabela */}
        {hasContent && (
          <div className="space-y-4">

            {/* Toolbar de colunas/documentos */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPickerOpen(true)}
                  className="flex items-center gap-1.5 bg-surface border border-border px-3 py-1.5 rounded-lg text-xs font-bold text-text-sec hover:text-white hover:border-brand/40 transition-all"
                >
                  <Plus size={13} /> PDF
                </button>
                <button
                  onClick={() => { setEditingColumn(null); setIsColumnEditorOpen(true); }}
                  className="flex items-center gap-1.5 bg-surface border border-border px-3 py-1.5 rounded-lg text-xs font-bold text-text-sec hover:text-white hover:border-brand/40 transition-all"
                >
                  <Tag size={13} /> Coluna
                </button>
              </div>
              <span className="text-[10px] text-text-sec font-mono">
                {table.rows.length} docs · {table.columns.length} colunas
              </span>
            </div>

            {/* Tabela horizontal com scroll */}
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-surface/80">
                    {/* Coluna fixa: Documento */}
                    <th className="px-4 py-3 text-xs font-bold text-text-sec uppercase tracking-wider border-b border-border min-w-[180px] sticky left-0 bg-surface/95 z-10">
                      Documento
                    </th>
                    {table.columns.map(col => (
                      <th
                        key={col.id}
                        className="px-4 py-3 text-xs font-bold text-text-sec uppercase tracking-wider border-b border-border min-w-[220px] max-w-[320px]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {col.fillMode === 'ai'
                              ? <Sparkles size={11} className="text-brand shrink-0" />
                              : <AlignLeft size={11} className="text-text-sec shrink-0" />}
                            <span className="truncate">{col.name}</span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => { setEditingColumn(col); setIsColumnEditorOpen(true); }}
                              className="p-1 text-text-sec hover:text-brand rounded transition-colors"
                              title="Editar coluna"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button
                              onClick={() => handleDeleteColumn(col.id)}
                              className="p-1 text-text-sec hover:text-red-400 rounded transition-colors"
                              title="Remover coluna"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {col.tags.map(tag => (
                            <span key={tag} className="text-[9px] font-mono bg-brand/10 text-brand px-1.5 py-0.5 rounded border border-brand/20">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </th>
                    ))}
                    {/* Coluna de ações por linha */}
                    <th className="px-3 py-3 border-b border-border w-12" />
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, ri) => {
                    const isRowProcessing = processingRowId === row.fileId;
                    return (
                      <tr
                        key={row.fileId}
                        className={`border-b border-border/50 transition-colors ${ri % 2 === 0 ? 'bg-bg' : 'bg-surface/30'} hover:bg-white/[0.02]`}
                      >
                        {/* Célula documento */}
                        <td className="px-4 py-3 sticky left-0 bg-inherit z-10 border-r border-border/30">
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

                        {/* Células de dados */}
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
                                  className="w-full min-h-[100px] bg-bg border border-brand/40 rounded-lg p-2 text-xs text-white resize-none focus:outline-none focus:border-brand custom-scrollbar"
                                  defaultValue={cell.content}
                                  onBlur={e => {
                                    handleCellEdit(row.fileId, col.id, e.target.value);
                                    setEditingCell(null);
                                  }}
                                />
                              ) : (
                                <div
                                  className={`group relative rounded-lg p-2 min-h-[48px] transition-colors cursor-text
                                    ${cell.isUsed ? 'opacity-40' : ''}
                                    ${isEmpty ? 'border border-dashed border-border/40' : 'hover:bg-white/[0.03]'}
                                  `}
                                  onClick={() => setEditingCell({ rowId: row.fileId, colId: col.id })}
                                >
                                  {isEmpty ? (
                                    <span className="text-[11px] text-text-sec italic select-none">—</span>
                                  ) : (
                                    <p className="text-[11px] text-text leading-relaxed whitespace-pre-wrap break-words line-clamp-6">
                                      {cell.content}
                                    </p>
                                  )}

                                  {/* Páginas */}
                                  {cell.pages.length > 0 && (
                                    <div className="mt-1.5 text-[9px] font-mono text-text-sec">
                                      pp.&nbsp;{cell.pages.join(', ')}
                                    </div>
                                  )}

                                  {/* Ações da célula — aparecem no hover */}
                                  {!isEmpty && (
                                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={e => { e.stopPropagation(); handleCopyCell(cellKey, cell.content); }}
                                        className="p-1 bg-bg/80 border border-border rounded text-text-sec hover:text-white transition-colors"
                                        title="Copiar"
                                      >
                                        {copiedCell === cellKey ? <Check size={10} className="text-brand" /> : <Copy size={10} />}
                                      </button>
                                      <button
                                        onClick={e => { e.stopPropagation(); handleToggleUsed(row.fileId, col.id); }}
                                        className={`p-1 bg-bg/80 border border-border rounded transition-colors ${cell.isUsed ? 'text-brand border-brand/30' : 'text-text-sec hover:text-brand'}`}
                                        title={cell.isUsed ? 'Marcar como não citado' : 'Marcar como citado'}
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

                        {/* Ação de remover linha */}
                        <td className="px-2 py-3 align-top">
                          <button
                            onClick={() => handleRemoveRow(row.fileId)}
                            className="p-1.5 text-text-sec hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="Remover documento"
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
        )}

        {/* Tabela tem colunas mas sem docs, ou vice-versa */}
        {(table.rows.length > 0 && table.columns.length === 0) && (
          <div className="mt-4 p-4 bg-surface border border-dashed border-border rounded-xl text-center text-sm text-text-sec">
            Defina pelo menos uma coluna para visualizar a tabela.
            <button
              onClick={() => { setEditingColumn(null); setIsColumnEditorOpen(true); }}
              className="ml-2 text-brand hover:underline font-bold"
            >
              Nova Coluna
            </button>
          </div>
        )}
        {(table.rows.length === 0 && table.columns.length > 0) && (
          <div className="mt-4 p-4 bg-surface border border-dashed border-border rounded-xl text-center text-sm text-text-sec">
            Adicione documentos à tabela.
            <button
              onClick={() => setIsPickerOpen(true)}
              className="ml-2 text-brand hover:underline font-bold"
            >
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
    onSave({
      id: column?.id || uuidv4(),
      name: name.trim(),
      tags,
      fillMode,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-bg border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
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
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ex: Metodologia"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-text-sec focus:outline-none focus:border-brand transition-colors"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-text-sec uppercase tracking-wider block mb-1.5">
              Tags mapeadas <span className="text-brand font-mono">(separadas por vírgula ou espaço)</span>
            </label>
            <input
              value={tagsRaw}
              onChange={e => setTagsRaw(e.target.value)}
              placeholder="ex: metodologia, método"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-text-sec focus:outline-none focus:border-brand transition-colors font-mono"
            />
            {tagsRaw && (
              <div className="flex flex-wrap gap-1 mt-2">
                {parseTags(tagsRaw).map(t => (
                  <span key={t} className="text-[9px] bg-brand/10 text-brand border border-brand/20 px-1.5 py-0.5 rounded font-mono">#{t}</span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-bold text-text-sec uppercase tracking-wider block mb-1.5">Modo de preenchimento</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFillMode('literal')}
                className={`p-3 rounded-xl border text-left transition-all ${fillMode === 'literal' ? 'border-brand bg-brand/10 text-brand' : 'border-border text-text-sec hover:border-brand/30'}`}
              >
                <AlignLeft size={16} className="mb-1.5" />
                <p className="text-xs font-bold">Trecho Literal</p>
                <p className="text-[10px] opacity-70 mt-0.5">Exibe o trecho exato + página.</p>
              </button>
              <button
                onClick={() => setFillMode('ai')}
                className={`p-3 rounded-xl border text-left transition-all ${fillMode === 'ai' ? 'border-brand bg-brand/10 text-brand' : 'border-border text-text-sec hover:border-brand/30'}`}
              >
                <Sparkles size={16} className="mb-1.5" />
                <p className="text-xs font-bold">Síntese IA</p>
                <p className="text-[10px] opacity-70 mt-0.5">Kalaki sintetiza e cita páginas.</p>
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2 bg-surface/50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-text-sec hover:text-white transition-colors">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || parseTags(tagsRaw).length === 0}
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
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 bg-surface border border-border text-text-sec px-3 py-1.5 rounded-lg text-xs font-bold hover:border-brand/40 hover:text-white transition-all"
      >
        <Download size={14} /> Exportar <ChevronDown size={11} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-bg border border-border rounded-xl shadow-2xl w-52 z-50 overflow-hidden">
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
              <div className="border-t border-border mx-2 my-1" />
              <div className="px-4 py-1.5 text-[10px] font-bold text-text-sec uppercase tracking-wider">Inserir em DOCX aberto</div>
              {openDocxFiles.map(f => (
                <button
                  key={f.id}
                  onClick={() => { onInjectToDocx(f.id); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-text hover:bg-white/5 transition-colors text-left"
                >
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
    if (next.has(file.id)) next.delete(file.id);
    else next.set(file.id, file);
    setSelected(next);
  };

  // Seleção de arquivo local
  const handleLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const id = `local-${Date.now()}`;
    const file: DriveFile = { id, name: f.name, mimeType: f.type || 'application/pdf', blob: f };
    onSelect([file]);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-bg border border-border rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">

        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Database size={18} className="text-brand" /> Selecionar Documentos
          </h2>
          <div className="flex items-center gap-2">
            {/* Arquivo local */}
            <label className="flex items-center gap-1.5 bg-surface border border-border px-3 py-1.5 rounded-lg text-xs font-bold text-text-sec cursor-pointer hover:border-brand/40 hover:text-white transition-all">
              <Plus size={13} /> Local
              <input type="file" accept=".pdf" className="hidden" onChange={handleLocalFile} />
            </label>
            <button onClick={onClose} className="p-1.5 text-text-sec hover:text-white rounded-lg hover:bg-white/5"><X size={18} /></button>
          </div>
        </div>

        {/* Navegação de pasta */}
        <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-surface/50 text-xs text-text-sec overflow-x-auto">
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
                    className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors
                      ${isAlreadyAdded ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                      ${isSel ? 'bg-brand/10 border border-brand/30' : 'hover:bg-white/5 border border-transparent'}
                    `}
                  >
                    <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                      {isFolder
                        ? <FolderOpen size={16} className="text-text-sec" />
                        : isSel
                        ? <Check size={16} className="text-brand" />
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

        <div className="p-4 border-t border-border flex justify-between items-center bg-surface/50 rounded-b-2xl">
          <span className="text-xs text-text-sec">{selected.size} selecionado(s)</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-text-sec hover:text-white transition-colors">Cancelar</button>
            <button
              onClick={() => onSelect([...selected.values()])}
              disabled={selected.size === 0}
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

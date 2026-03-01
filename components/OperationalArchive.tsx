import React, { useState, useEffect, useMemo } from 'react';
import { Database, FileText, Loader2, Download, Search, BarChart2, Table as TableIcon, Plus, X, CheckSquare, Square } from 'lucide-react';
import { DriveFile, MIME_TYPES } from '../types';
import { useGlobalContext } from '../context/GlobalContext';
import { loadAnnotations } from '../services/storageService';
import { useDriveFiles } from '../hooks/useDriveFiles';

interface Props {
  accessToken: string;
  onToggleMenu: () => void;
}

export const OperationalArchive: React.FC<Props> = ({ accessToken, onToggleMenu }) => {
  const [selectedFiles, setSelectedFiles] = useState<DriveFile[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'chart' | 'table'>('chart');
  const { addNotification } = useGlobalContext();

  const handleProcess = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    try {
      // TODO: Implement Web Worker processing
      addNotification('Processamento iniciado...', 'info');
      
      // Mock processing for now
      setTimeout(() => {
        setResults({
          tags: {
            '#metodologia': { count: 12, files: [selectedFiles[0]?.name] },
            '#conclusao': { count: 5, files: [selectedFiles[0]?.name] }
          },
          matrix: [
            { file: selectedFiles[0]?.name, '#metodologia': true, '#conclusao': false }
          ]
        });
        setIsProcessing(false);
        addNotification('Processamento concluído!', 'success');
      }, 2000);

    } catch (e) {
      console.error(e);
      addNotification('Erro ao processar arquivos', 'error');
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg text-text relative overflow-hidden">
      <div className="p-4 md:p-6 border-b border-border flex items-center justify-between sticky top-0 bg-bg z-20 shrink-0 h-[80px]">
         <div className="flex items-center gap-3 overflow-hidden flex-1 mr-4">
             <button onClick={onToggleMenu} className="p-2 -ml-2 text-text-sec hover:text-text rounded-full hover:bg-white/5 active:scale-95">
                 <Database size={24} className="text-brand" />
             </button>
             <div className="flex flex-col min-w-0">
                 <h1 className="text-xl font-bold truncate">Arquivo Operacional</h1>
                 <span className="text-[10px] text-text-sec flex items-center gap-1">
                     Sintetizador Lexicográfico
                 </span>
             </div>
         </div>
         <div className="flex items-center gap-2 shrink-0">
             <button 
                onClick={() => setIsPickerOpen(true)}
                className="flex items-center gap-2 bg-surface border border-border text-text px-3 py-2 rounded-lg font-bold text-xs hover:bg-white/5 transition-all"
             >
                 <Plus size={16} /> Adicionar Arquivos
             </button>
             <button 
                onClick={handleProcess}
                disabled={selectedFiles.length === 0 || isProcessing}
                className="flex items-center gap-2 bg-brand text-bg px-3 py-2 rounded-lg font-bold text-xs hover:brightness-110 shadow-lg transition-all disabled:opacity-50"
             >
                 {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <BarChart2 size={16} />}
                 Processar
             </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
        {selectedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-sec gap-4 opacity-50">
                <Database size={48} />
                <p>Nenhum arquivo selecionado para mineração.</p>
            </div>
        ) : (
            <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                    {selectedFiles.map(f => (
                        <div key={f.id} className="flex items-center gap-2 bg-surface border border-border px-3 py-1.5 rounded-lg text-sm">
                            <FileText size={14} className="text-brand" />
                            <span className="truncate max-w-[200px]">{f.name}</span>
                            <button onClick={() => setSelectedFiles(prev => prev.filter(x => x.id !== f.id))} className="text-text-sec hover:text-red-400 ml-1">
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                {results && (
                    <div className="bg-surface border border-border rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-center gap-4 mb-4 border-b border-border pb-4">
                            <button onClick={() => setActiveTab('chart')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'chart' ? 'bg-brand/10 text-brand' : 'text-text-sec hover:text-text'}`}>Gráfico de Frequência</button>
                            <button onClick={() => setActiveTab('table')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'table' ? 'bg-brand/10 text-brand' : 'text-text-sec hover:text-text'}`}>Matriz de Adjacência</button>
                        </div>

                        {activeTab === 'chart' && (
                            <div className="h-[400px] w-full flex items-center justify-center border border-dashed border-border rounded-lg">
                                <span className="text-text-sec text-sm">Gráfico Autoral em Desenvolvimento</span>
                            </div>
                        )}

                        {activeTab === 'table' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="text-xs text-text-sec uppercase bg-black/20">
                                        <tr>
                                            <th className="px-4 py-3 rounded-tl-lg">Arquivo</th>
                                            {Object.keys(results.tags).map(tag => (
                                                <th key={tag} className="px-4 py-3">{tag}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.matrix.map((row: any, i: number) => (
                                            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                                <td className="px-4 py-3 font-medium">{row.file}</td>
                                                {Object.keys(results.tags).map(tag => (
                                                    <td key={tag} className="px-4 py-3">
                                                        {row[tag] ? <CheckSquare size={16} className="text-brand" /> : <Square size={16} className="text-text-sec opacity-30" />}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Simple Multi-File Picker Modal */}
      {isPickerOpen && (
          <MultiFilePicker 
            accessToken={accessToken} 
            onClose={() => setIsPickerOpen(false)} 
            onSelect={(files) => {
                setSelectedFiles(prev => {
                    const newFiles = [...prev];
                    files.forEach(f => {
                        if (!newFiles.find(x => x.id === f.id)) newFiles.push(f);
                    });
                    return newFiles;
                });
                setIsPickerOpen(false);
            }} 
          />
      )}
    </div>
  );
};

const MultiFilePicker: React.FC<{ accessToken: string, onClose: () => void, onSelect: (files: DriveFile[]) => void }> = ({ accessToken, onClose, onSelect }) => {
    const { files, loading, currentFolder, handleFolderClick, handleNavigateUp, folderHistory } = useDriveFiles(accessToken, 'default');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const toggleSelect = (file: DriveFile) => {
        if (file.mimeType === MIME_TYPES.FOLDER) {
            handleFolderClick(file);
            return;
        }
        const next = new Set(selected);
        if (next.has(file.id)) next.delete(file.id);
        else next.add(file.id);
        setSelected(next);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-bg border border-border rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2"><Database size={20} className="text-brand" /> Selecionar Arquivos</h2>
                    <button onClick={onClose} className="p-2 text-text-sec hover:text-text"><X size={20} /></button>
                </div>
                <div className="p-2 border-b border-border flex items-center gap-2 bg-surface">
                    {folderHistory.length > 1 && (
                        <button onClick={handleNavigateUp} className="p-1.5 hover:bg-white/5 rounded-lg text-text-sec"><Search size={16} /></button>
                    )}
                    <span className="text-sm font-medium">{folderHistory[folderHistory.length - 1].name}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-brand" /></div>
                    ) : (
                        <div className="space-y-1">
                            {files.map(f => (
                                <div key={f.id} onClick={() => toggleSelect(f)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selected.has(f.id) ? 'bg-brand/10 border border-brand/30' : 'hover:bg-white/5 border border-transparent'}`}>
                                    {f.mimeType === MIME_TYPES.FOLDER ? (
                                        <div className="p-1.5 bg-white/5 rounded-lg"><Search size={16} className="text-text-sec" /></div>
                                    ) : (
                                        <div className="p-1.5">{selected.has(f.id) ? <CheckSquare size={18} className="text-brand" /> : <Square size={18} className="text-text-sec" />}</div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{f.name}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-border flex justify-end gap-2 bg-surface rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-text-sec hover:text-text">Cancelar</button>
                    <button onClick={() => onSelect(files.filter(f => selected.has(f.id)))} className="px-4 py-2 bg-brand text-bg rounded-lg text-sm font-bold hover:brightness-110">Adicionar ({selected.size})</button>
                </div>
            </div>
        </div>
    );
};

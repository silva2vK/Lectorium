
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { 
  ArrowLeft, Loader2, RefreshCw, Menu, Cloud, UploadCloud, HardDrive, Sparkles, Lock, LogIn, X, Search, CloudOff, AlertTriangle
} from 'lucide-react';
import { DriveFile, MIME_TYPES } from '../types';
import { downloadDriveFile, uploadFileToDrive } from '../services/driveService';
import { saveOfflineFile, toggleFilePin } from '../services/storageService';
import { MoveFileModal } from './MoveFileModal';
import { MindMapGeneratorModal } from './modals/MindMapGeneratorModal';
import { DriveFolderPickerModal } from './pdf/modals/DriveFolderPickerModal';
import { FileItem } from './drive/FileItem';
import { useDriveFiles } from '../hooks/useDriveFiles';
import { AiChatPanel } from './shared/AiChatPanel';
import { useGlobalContext } from '../context/GlobalContext';

interface Props {
  accessToken: string;
  onSelectFile: (file: DriveFile, background?: boolean) => Promise<void> | void;
  onLogout: () => void;
  onAuthError: () => void;
  onToggleMenu: () => void;
  mode?: 'default' | 'mindmaps' | 'offline' | 'local' | 'shared'; 
  onCreateMindMap?: (parentId?: string) => void; 
  onGenerateMindMapWithAi?: (topic: string) => void;
  localDirectoryHandle?: any;
  onLogin?: () => void;
  expandingFileId?: string | null;
}

export const DriveBrowser: React.FC<Props> = ({ 
  accessToken, onSelectFile, onLogout, onAuthError, 
  onToggleMenu, mode = 'default', onCreateMindMap, onGenerateMindMapWithAi, localDirectoryHandle,
  onLogin, expandingFileId
}) => {
  // Use custom hook for logic (Now powered by TanStack Query)
  const {
    files,
    loading,
    currentFolder,
    folderHistory,
    authError,
    offlineFileIds,
    pinnedFileIds,
    updateCacheStatus,
    loadFiles,
    handleFolderClick,
    handleNavigateUp,
    renameFile,
    deleteFile,
    isMutating,
    searchQuery,
    setSearchQuery
  } = useDriveFiles(accessToken, mode as any, localDirectoryHandle, onAuthError);

  const { addNotification } = useGlobalContext();

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [localActionLoading, setLocalActionLoading] = useState(false);
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const [openingFileName, setOpeningFileName] = useState<string | null>(null);
  const [moveFileModalOpen, setMoveFileModalOpen] = useState(false);
  const [fileToMove, setFileToMove] = useState<DriveFile | null>(null);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  
  // Upload States
  const [showUploadPicker, setShowUploadPicker] = useState(false);
  const [filesToUpload, setFilesToUpload] = useState<FileList | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Search UI State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [tempSearch, setTempSearch] = useState('');
  
  // AI Sidebar State
  const [showAiSidebar, setShowAiSidebar] = useState(false);

  const handleTogglePin = useCallback(async (file: DriveFile) => {
      const isPinned = pinnedFileIds.has(file.id);
      setActiveMenuId(null);
      
      // Se não está offline e não está pinado, precisamos baixar (ou salvar meta se for pasta)
      if (!offlineFileIds.has(file.id) && !isPinned) {
          if (file.mimeType === MIME_TYPES.FOLDER) {
              // Pastas são instantâneas (apenas metadados)
              try {
                  await saveOfflineFile(file, null, true);
                  updateCacheStatus();
                  addNotification(`Pasta "${file.name}" disponível offline.`, 'success');
              } catch(e) {
                  addNotification("Erro ao fixar pasta.", 'error');
              }
          } else {
              // BACKGROUND TASK: Download do arquivo sem bloquear UI
              addNotification(`Baixando "${file.name}" para acesso offline...`, 'info');
              
              // Executa download em "segundo plano" (sem await no fluxo principal)
              (async () => {
                  try {
                      const blob = await downloadDriveFile(accessToken, file.id, file.mimeType);
                      await saveOfflineFile(file, blob, true);
                      updateCacheStatus();
                      addNotification(`"${file.name}" baixado com sucesso!`, 'success');
                  } catch (e: any) {
                      console.error(e);
                      addNotification(`Falha ao baixar "${file.name}". Verifique sua conexão.`, 'error');
                  }
              })();
          }
      } else {
          // Toggle simples de estado pin (arquivo já existe offline ou apenas mudança de flag)
          try {
              await toggleFilePin(file.id, !isPinned);
              updateCacheStatus();
              addNotification(isPinned ? `"${file.name}" não está mais fixado.` : `"${file.name}" fixado no topo.`, 'success');
          } catch (e) { 
              addNotification("Erro ao atualizar status.", 'error'); 
          }
      }
  }, [accessToken, offlineFileIds, pinnedFileIds, updateCacheStatus, addNotification]);

  const handleRename = useCallback(async (file: DriveFile) => {
      setActiveMenuId(null);
      const newName = window.prompt("Novo nome:", file.name);
      if (newName && newName !== file.name) {
          try {
              await renameFile({ fileId: file.id, newName });
          } catch (e: any) {
              alert("Erro ao renomear arquivo: " + e.message);
          }
      }
  }, [renameFile]);

  const handleDelete = useCallback(async (file: DriveFile) => { 
      if (confirm(`Tem certeza que deseja excluir "${file.name}"?`)) {
          try {
              await deleteFile(file.id);
          } catch (e: any) {
              alert("Erro ao excluir: " + e.message);
          }
      }
  }, [deleteFile]);
  
  const handleShare = useCallback(async (file: DriveFile) => { 
      setActiveMenuId(null); 
      
      if (file.mimeType === MIME_TYPES.FOLDER) {
          window.open(`https://drive.google.com/file/d/${file.id}/share`, '_blank');
          return;
      }

      setLocalActionLoading(true);
      try {
          let blob = file.blob;
          if (!blob && !file.id.startsWith('local-')) {
               blob = await downloadDriveFile(accessToken, file.id, file.mimeType);
          }

          if (blob) {
              const fileObj = new File([blob], file.name, { type: file.mimeType });
              if (navigator.canShare && navigator.canShare({ files: [fileObj] })) {
                  await navigator.share({
                      files: [fileObj],
                      title: file.name,
                      text: 'Arquivo compartilhado via Lectorium'
                  });
              } else {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = file.name;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
              }
          } else {
              window.open(`https://drive.google.com/file/d/${file.id}/share`, '_blank');
          }
      } catch (e) {
          console.error("Erro ao compartilhar", e);
          window.open(`https://drive.google.com/file/d/${file.id}/share`, '_blank');
      } finally {
          setLocalActionLoading(false);
      }
  }, [accessToken]);

  const handleMove = useCallback((file: DriveFile) => { 
      setActiveMenuId(null); setFileToMove(file); setMoveFileModalOpen(true); 
  }, []);

  const handleSelect = useCallback(async (file: DriveFile, background?: boolean) => {
      if (openingFileId) return;
      if (file.mimeType === MIME_TYPES.FOLDER) handleFolderClick(file); 
      else {
          if (!background) {
              setOpeningFileId(file.id);
              setOpeningFileName(file.name);
          }
          try { await onSelectFile(file, background); } catch (e) { console.error(e); } finally { 
              setOpeningFileId(null); 
              setOpeningFileName(null);
          }
      }
  }, [handleFolderClick, onSelectFile, openingFileId]);

  // --- Upload Logic (Background) ---
  const handleUploadClick = () => {
      if (uploadInputRef.current) {
          uploadInputRef.current.value = '';
          uploadInputRef.current.click();
      }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setFilesToUpload(e.target.files);
          // Abre o seletor de pastas imediatamente
          setShowUploadPicker(true);
      }
  };

  const handleUploadToFolder = async (folderId: string) => {
      setShowUploadPicker(false);
      if (!filesToUpload || filesToUpload.length === 0) return;

      const files: File[] = Array.from(filesToUpload);
      const total = files.length;
      
      addNotification(`Iniciando upload de ${total} arquivo(s)...`, 'info');
      setFilesToUpload(null);

      (async () => {
        try {
            for (let i = 0; i < total; i++) {
                const file = files[i];
                await uploadFileToDrive(
                    accessToken,
                    file,
                    file.name,
                    [folderId],
                    file.type
                );
            }
            
            loadFiles();
            addNotification("Upload concluído com sucesso!", "success");
        } catch (e: any) {
            console.error("Upload error", e);
            addNotification("Erro ao fazer upload: " + e.message, "error");
        }
      })();
  };

  const handleAiGenerateConfirm = (text: string) => {
    if (text && onGenerateMindMapWithAi) {
        onGenerateMindMapWithAi(text);
        setShowGeneratorModal(false);
        setShowAiSidebar(false);
    }
  };

  // --- Search Logic ---
  const handleSearchSubmit = (e?: React.FormEvent) => {
      e?.preventDefault();
      if (tempSearch.trim()) {
          setSearchQuery(tempSearch);
      } else {
          setSearchQuery('');
          setIsSearchOpen(false);
      }
  };

  const clearSearch = () => {
      setTempSearch('');
      setSearchQuery('');
      setIsSearchOpen(false);
  };

  const headerTitle = useMemo(() => {
      if (searchQuery) return `Resultados para "${searchQuery}"`;
      if (mode === 'offline') return 'Fixados e Recentes';
      if (mode === 'mindmaps') return 'Mapas Mentais';
      if (mode === 'local') return localDirectoryHandle?.name || 'Pasta Local';
      if (currentFolder === 'shared-with-me') return 'Compartilhados comigo';
      return folderHistory[folderHistory.length - 1].name;
  }, [mode, folderHistory, localDirectoryHandle, currentFolder, searchQuery]);

  const browserContext = useMemo(() => {
      const fileNames = files.slice(0, 50).map(f => `- ${f.name} (${f.mimeType === MIME_TYPES.FOLDER ? 'Pasta' : 'Arquivo'})`).join('\n');
      return `CONTEXTO DO NAVEGADOR DE ARQUIVOS:
Você está visualizando a pasta/modo: "${headerTitle}".
Arquivos visíveis (amostra):
${fileNames}

${files.length === 0 ? "A pasta está vazia." : ""}

O usuário pode pedir para organizar, encontrar arquivos ou criar novos conteúdos.`;
  }, [files, headerTitle]);

  const isLoading = loading || isMutating || localActionLoading;

  return (
    <div className="flex flex-col h-full bg-bg text-text relative overflow-hidden">
      <div className="p-4 md:p-6 border-b border-border flex items-center justify-between sticky top-0 bg-bg z-20 shrink-0 h-[80px]">
         <div className="flex items-center gap-3 overflow-hidden flex-1 mr-4">
             <button onClick={onToggleMenu} className="p-2 -ml-2 text-text-sec hover:text-text rounded-full hover:bg-white/5 active:scale-95"><Menu size={24} /></button>
             
             {!isSearchOpen && folderHistory.length > 1 && (mode === 'default' || mode === 'shared') && !searchQuery && (
                 <button onClick={handleNavigateUp} className="p-2 -ml-2 text-text-sec hover:text-text rounded-full hover:bg-white/5 active:scale-95"><ArrowLeft size={24} /></button>
             )}

             {isSearchOpen ? (
                 <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center bg-surface border border-border rounded-xl px-3 h-10 animate-in fade-in slide-in-from-right-4 w-full max-w-md">
                     <Search size={16} className="text-text-sec mr-2 shrink-0" />
                     <input 
                        autoFocus
                        value={tempSearch}
                        onChange={(e) => setTempSearch(e.target.value)}
                        placeholder="Pesquisar arquivos..."
                        className="bg-transparent border-none outline-none text-sm text-text w-full placeholder:text-text-sec"
                        onKeyDown={(e) => { if (e.key === 'Escape') clearSearch(); }}
                     />
                     <button type="button" onClick={clearSearch} className="p-1 text-text-sec hover:text-text"><X size={16} /></button>
                 </form>
             ) : (
                 <div className="flex flex-col min-w-0">
                     <div className="flex items-center gap-2">
                         {mode === 'local' && <HardDrive size={16} className="text-orange-400" />}
                         {searchQuery && <Search size={16} className="text-brand" />}
                         <h1 className="text-xl font-bold truncate">{headerTitle}</h1>
                         {searchQuery && <button onClick={clearSearch} className="p-1 hover:bg-white/10 rounded-full"><X size={14}/></button>}
                     </div>
                     <span className="text-[10px] text-text-sec flex items-center gap-1">
                         {mode === 'local' ? 'Armazenamento do Dispositivo' : <><Cloud size={10} /> Smart Sync Ativo</>}
                     </span>
                 </div>
             )}
         </div>

         <div className="flex items-center gap-2 shrink-0">
             {!isSearchOpen && !searchQuery && (
                 <button onClick={() => setIsSearchOpen(true)} className="p-2 text-text-sec hover:text-text rounded-full hover:bg-white/5 active:scale-95 transition-colors">
                     <Search size={20} />
                 </button>
             )}

             <button 
                onClick={() => setShowAiSidebar(!showAiSidebar)} 
                className={`p-2 rounded-xl border transition-all active:scale-95 ${showAiSidebar ? 'bg-brand/20 text-brand border-brand/50 shadow-[0_0_10px_rgba(74,222,128,0.2)]' : 'bg-surface text-text-sec border-border hover:text-white'}`} 
                title="Sexta-feira (IA)"
             >
                <Sparkles size={20} />
             </button>
             
             {/* Upload Button */}
             {(mode === 'default' || mode === 'shared') && !authError && (
                 <button 
                    onClick={handleUploadClick} 
                    className="flex items-center gap-2 bg-brand text-bg px-3 py-2 rounded-lg font-bold text-xs hover:brightness-110 shadow-lg transition-all animate-in fade-in active:scale-95"
                 >
                     <UploadCloud size={16} /><span className="hidden sm:inline">Upload</span>
                 </button>
             )}
             <button onClick={() => loadFiles()} className="p-2 text-text-sec hover:text-text rounded-full hover:bg-white/5 active:scale-95"><RefreshCw size={20} className={isLoading ? "animate-spin" : ""} /></button>
         </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative">
         {/* CARD DE AVISO: Token Expirado / Modo Degradado */}
         {(authError || (!accessToken && (mode === 'default' || mode === 'shared'))) && (
             <div className="mb-6 bg-[#131314] border border-yellow-500/30 rounded-xl p-6 flex flex-col items-center text-center animate-in fade-in slide-in-from-top-4 shadow-xl">
                 <div className="bg-yellow-500/10 p-3 rounded-full mb-3 text-yellow-500 border border-yellow-500/20">
                     <AlertTriangle size={24} />
                 </div>
                 <h3 className="text-lg font-bold text-white mb-1">Conexão Interrompida</h3>
                 <p className="text-sm text-gray-400 max-w-sm mb-4 leading-relaxed">
                     Sua sessão com o Google Drive expirou. Você está visualizando apenas arquivos cacheados no dispositivo (Modo Offline).
                 </p>
                 <button 
                    onClick={onLogin} 
                    className="flex items-center gap-2 bg-yellow-500 text-black px-6 py-2.5 rounded-lg font-bold hover:bg-yellow-400 transition-all shadow-lg active:scale-95"
                 >
                     <LogIn size={18} /> Reconectar Agora
                 </button>
             </div>
         )}

         {loading && files.length === 0 ? (
             <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-brand" /></div>
         ) : (
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                 {files.map(file => (
                     <FileItem 
                        key={file.id} 
                        file={file} 
                        onSelect={handleSelect} 
                        onTogglePin={handleTogglePin} 
                        onDelete={handleDelete} 
                        onShare={handleShare} 
                        onMove={handleMove} 
                        onRename={handleRename} 
                        isOffline={offlineFileIds.has(file.id)} 
                        isPinned={pinnedFileIds.has(file.id)} 
                        isActiveMenu={activeMenuId === file.id} 
                        setActiveMenu={setActiveMenuId} 
                        isLocalMode={mode === 'local'} 
                        accessToken={accessToken} 
                        isExpanding={expandingFileId === file.id}
                     />
                 ))}
                 {files.length === 0 && !loading && (
                     <div className="col-span-full text-center py-12 text-text-sec opacity-50 flex flex-col items-center gap-2">
                         {searchQuery ? (
                             <>
                                <Search size={48} className="opacity-20" />
                                <p>Nenhum resultado para "{searchQuery}"</p>
                             </>
                         ) : (
                             <p>{mode === 'mindmaps' ? 'Nenhum mapa mental encontrado.' : 'Esta pasta está vazia.'}</p>
                         )}
                     </div>
                 )}
             </div>
         )}
      </div>
      
      {/* Sidebar Sexta-feira */}
      {showAiSidebar && (
          <div className="absolute inset-y-0 right-0 z-50 w-96 bg-[#1e1e1e] border-l border-[#444746] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between p-4 border-b border-[#444746] bg-surface">
                  <h3 className="font-bold text-[#e3e3e3] flex items-center gap-2 text-sm uppercase tracking-widest">
                      <Sparkles size={18} className="text-brand" />
                      Sexta-feira
                  </h3>
                  <button onClick={() => setShowAiSidebar(false)} className="text-gray-400 hover:text-white p-1">
                      <X size={20} />
                  </button>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col">
                  {mode === 'mindmaps' && onGenerateMindMapWithAi && (
                      <div className="p-4 border-b border-[#444746] bg-brand/5">
                          <button 
                            onClick={() => setShowGeneratorModal(true)} 
                            className="w-full py-3 bg-brand text-[#0b141a] rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-lg active:scale-95"
                          >
                              <Sparkles size={16} /> Gerar Estrutura com IA
                          </button>
                          <p className="text-[10px] text-text-sec mt-2 text-center leading-tight">
                              Descreva um tópico e a IA criará o mapa mental completo para você.
                          </p>
                      </div>
                  )}
                  <AiChatPanel 
                      contextText={browserContext} 
                      documentName={headerTitle} 
                      fileId="browser-context" 
                  />
              </div>
          </div>
      )}

      {/* Loading Overlay */}
      {(isMutating || localActionLoading) && !openingFileId && (
          <div className="absolute inset-0 z-50 bg-bg/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in">
              <Loader2 size={40} className="animate-spin text-brand mb-2" />
          </div>
      )}
      
      {openingFileId && <div className="absolute inset-0 z-[60] bg-bg/90 flex flex-col items-center justify-center animate-in fade-in duration-300"><div className="relative mb-6"><div className="absolute inset-0 bg-brand/20 rounded-full blur-xl animate-pulse"></div><div className="relative bg-surface p-4 rounded-full border border-brand/30"><Cloud size={40} className="text-brand animate-pulse" /></div><div className="absolute -bottom-2 -right-2 bg-bg rounded-full p-1 border border-border"><Loader2 size={20} className="animate-spin text-white" /></div></div><h3 className="text-xl font-bold text-white mb-2">Abrindo Arquivo</h3><p className="text-sm text-text-sec max-w-xs text-center truncate px-4">{openingFileName || "Carregando..."}</p><div className="mt-8 flex gap-2"><div className="w-2 h-2 rounded-full bg-brand animate-bounce [animation-delay:-0.3s]"></div><div className="w-2 h-2 rounded-full bg-brand animate-bounce [animation-delay:-0.15s]"></div><div className="w-2 h-2 rounded-full bg-brand animate-bounce"></div></div></div>}
      
      <MoveFileModal isOpen={moveFileModalOpen} onClose={() => setMoveFileModalOpen(false)} fileToMove={fileToMove} accessToken={accessToken} onMoveSuccess={() => { loadFiles(); setFileToMove(null); }} />
      <MindMapGeneratorModal isOpen={showGeneratorModal} onClose={() => setShowGeneratorModal(false)} onGenerate={handleAiGenerateConfirm} />
      
      {/* Upload Inputs & Modals */}
      <input 
          type="file" 
          multiple 
          ref={uploadInputRef} 
          className="hidden" 
          onChange={handleFileSelect} 
      />
      
      <DriveFolderPickerModal 
          isOpen={showUploadPicker}
          onClose={() => { setShowUploadPicker(false); setFilesToUpload(null); }}
          accessToken={accessToken}
          onSelectFolder={handleUploadToFolder}
      />
    </div>
  );
};

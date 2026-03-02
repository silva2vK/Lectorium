import React, { useState, useEffect } from 'react';
// Added missing 'Check' icon to the lucide-react imports
import { Folder, ArrowRight, Loader2, Home, CheckCircle, ChevronLeft, FolderPlus, Plus, X, Check } from 'lucide-react';
import { BaseModal } from '../../shared/BaseModal';
import { listDriveFolders, uploadFileToDrive } from '../../../services/driveService';
import { DriveFile, MIME_TYPES } from '../../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string;
  onSelectFolder: (folderId: string) => void;
}

export const DriveFolderPickerModal: React.FC<Props> = ({ isOpen, onClose, accessToken, onSelectFolder }) => {
  const [currentFolder, setCurrentFolder] = useState<{id: string, name: string}>({ id: 'root', name: 'Meu Drive' });
  const [folders, setFolders] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{id: string, name: string}[]>([{ id: 'root', name: 'Meu Drive' }]);
  
  // New Folder State
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingInDrive, setIsCreatingInDrive] = useState(false);

  useEffect(() => {
    if (isOpen && accessToken) {
      loadFolders('root');
      setIsCreating(false);
    }
  }, [isOpen, accessToken]);

  const loadFolders = async (parentId: string) => {
    setLoading(true);
    try {
      const result = await listDriveFolders(accessToken, parentId);
      setFolders(result);
    } catch (e) {
      console.error("Erro ao listar pastas", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || isCreatingInDrive) return;
    setIsCreatingInDrive(true);
    try {
        // Usamos uploadFileToDrive com o MIME de pasta para criar o diretório
        const result = await uploadFileToDrive(
            accessToken, 
            new Blob([], { type: MIME_TYPES.FOLDER }), 
            newFolderName.trim(), 
            [currentFolder.id],
            MIME_TYPES.FOLDER
        );
        
        setNewFolderName('');
        setIsCreating(false);
        // Recarrega a lista para mostrar a nova pasta
        await loadFolders(currentFolder.id);
    } catch (e) {
        alert("Erro ao criar pasta.");
    } finally {
        setIsCreatingInDrive(false);
    }
  };

  const handleFolderClick = (folder: DriveFile) => {
    const newEntry = { id: folder.id, name: folder.name };
    setHistory(prev => [...prev, newEntry]);
    setCurrentFolder(newEntry);
    loadFolders(folder.id);
  };

  const handleNavigateUp = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop();
    const parent = newHistory[newHistory.length - 1];
    setHistory(newHistory);
    setCurrentFolder(parent);
    loadFolders(parent.id);
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Selecionar Pasta no Drive"
      icon={<Folder size={20} />}
      maxWidth="max-w-md"
      footer={
        <button 
            onClick={() => onSelectFolder(currentFolder.id)}
            disabled={isCreating}
            className="w-full bg-brand text-[#0b141a] py-3 rounded-xl font-bold hover:brightness-110 flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
        >
            <CheckCircle size={18} /> Salvar em "{currentFolder.name}"
        </button>
      }
    >
      <div className="flex flex-col h-[400px]">
         <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-2">
             <div className="flex items-center gap-2 flex-1 min-w-0">
                {history.length > 1 && (
                    <button onClick={handleNavigateUp} className="hover:bg-white/5 p-1.5 rounded-lg text-text-sec transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                )}
                <div className="min-w-0">
                    <div className="text-[10px] text-text-sec uppercase font-bold tracking-widest">Local Atual</div>
                    <div className="font-bold text-white truncate flex items-center gap-2">
                        {currentFolder.id === 'root' ? <Home size={14} className="text-brand" /> : <Folder size={14} className="text-brand" />}
                        {currentFolder.name}
                    </div>
                </div>
             </div>
             
             <button 
                onClick={() => setIsCreating(true)} 
                className="p-2 text-brand hover:bg-brand/10 rounded-lg transition-all active:scale-95"
                title="Criar nova pasta"
             >
                <FolderPlus size={20} />
             </button>
         </div>

         {/* Nova Pasta Input */}
         {isCreating && (
             <div className="p-3 bg-brand/5 border border-brand/20 rounded-xl mb-3 animate-in slide-in-from-top-2">
                 <div className="flex gap-2">
                     <input 
                        autoFocus
                        className="flex-1 bg-black/40 border border-brand/30 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand"
                        placeholder="Nome da pasta..."
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateFolder();
                            if (e.key === 'Escape') setIsCreating(false);
                        }}
                     />
                     <button onClick={handleCreateFolder} disabled={!newFolderName.trim() || isCreatingInDrive} className="p-2 bg-brand text-bg rounded-lg disabled:opacity-50">
                        {isCreatingInDrive ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                     </button>
                     <button onClick={() => setIsCreating(false)} className="p-2 text-text-sec hover:text-white">
                        <X size={18} />
                     </button>
                 </div>
             </div>
         )}

         <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
             {loading ? (
                 <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                     <Loader2 size={24} className="animate-spin text-brand" />
                     <span className="text-xs font-mono">Sincronizando diretórios...</span>
                 </div>
             ) : folders.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-text-sec gap-2">
                     <Folder size={32} className="opacity-20" />
                     <span className="text-sm italic">Nenhuma subpasta aqui.</span>
                 </div>
             ) : (
                 <div className="grid grid-cols-1 gap-1">
                    {folders.map(folder => (
                        <button
                            key={folder.id}
                            onClick={() => handleFolderClick(folder)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-left transition-all group border border-transparent hover:border-white/5"
                        >
                            <div className="p-2 bg-white/5 rounded-lg text-text-sec group-hover:text-brand group-hover:bg-brand/10 transition-colors">
                                <Folder size={18} />
                            </div>
                            <span className="flex-1 truncate text-sm font-medium text-gray-300 group-hover:text-white">{folder.name}</span>
                            <ArrowRight size={14} className="text-text-sec opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all" />
                        </button>
                    ))}
                 </div>
             )}
         </div>
      </div>
    </BaseModal>
  );
};

import React, { useEffect, useState } from 'react';
import { Icon } from '../../shared/Icon';
import { DocVersion, getDocVersions, saveDocVersion } from '../../../services/storageService';
import { auth } from '../../../firebase';
import { Clock, X, Loader2, RotateCcw, Save } from 'lucide-react';
import { useGlobalContext } from '../../../context/GlobalContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fileId?: string;
  onRestore?: (content: any) => void;
  currentContent?: any;
}

export const VersionHistoryModal: React.FC<Props> = ({ isOpen, onClose, fileId, onRestore, currentContent }) => {
  const { addNotification } = useGlobalContext();
  const [history, setHistory] = useState<DocVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Inline name input (substitui prompt())
  const [showNameInput, setShowNameInput] = useState(false);
  const [snapshotName, setSnapshotName] = useState('Versão Manual');

  // Inline confirm de restauração (substitui confirm())
  const [confirmRestore, setConfirmRestore] = useState<DocVersion | null>(null);

  useEffect(() => {
    if (isOpen && fileId) {
      loadHistory();
    }
  }, [isOpen, fileId]);

  const loadHistory = async () => {
    if (!fileId) return;
    setLoading(true);
    try {
      const versions = await getDocVersions(fileId);
      setHistory(versions);
    } catch (e) {
      console.error("Failed to load history", e);
    } finally {
      setLoading(false);
    }
  };

  // Passo 1: abre o input inline
  const handleCreateSnapshot = () => {
    if (!fileId || !currentContent) return;
    setSnapshotName('Versão Manual');
    setShowNameInput(true);
  };

  // Passo 2: confirma e salva
  const handleConfirmSnapshot = async () => {
    setShowNameInput(false);
    setCreating(true);
    try {
      const author = auth.currentUser?.displayName || 'Você';
      await saveDocVersion(fileId!, currentContent, author, snapshotName || 'Versão Manual');
      await loadHistory();
    } catch (e) {
      addNotification("Erro ao criar versão.", "error");
    } finally {
      setCreating(false);
    }
  };

  // Passo 1: solicita confirmação inline
  const handleRestore = (version: DocVersion) => {
    setConfirmRestore(version);
  };

  // Passo 2: executa restauração
  const handleConfirmRestore = () => {
    if (confirmRestore && onRestore) {
      onRestore(confirmRestore.content);
      setConfirmRestore(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
       <div className="bg-[#1e1e1e] text-[#e3e3e3] rounded-2xl shadow-2xl p-6 w-full max-w-md relative animate-in zoom-in-95 border border-[#444746] flex flex-col max-h-[80vh]">
          
          <div className="flex justify-between items-center mb-6 shrink-0">
            <h3 className="text-xl font-normal flex items-center gap-2">
                <Clock size={20} className="text-brand"/> Histórico de Versões
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={20}/></button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
             {loading ? (
                 <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-brand" /></div>
             ) : history.length === 0 ? (
                 <div className="text-center py-10 text-gray-500 text-sm">Nenhuma versão salva ainda.</div>
             ) : (
                 history.map((item, index) => (
                     <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-gray-600 bg-[#2c2c2c] group transition-all">
                         <div>
                             <div className="font-bold text-sm text-white">{item.name || "Salvamento Automático"}</div>
                             <div className="text-xs text-gray-400 flex gap-2">
                                <span>{new Date(item.timestamp).toLocaleString()}</span>
                                <span>• {item.author}</span>
                             </div>
                         </div>
                         
                         {index === 0 ? (
                             <span className="text-[10px] bg-brand/20 text-brand px-2 py-1 rounded font-bold uppercase">Mais Recente</span>
                         ) : (
                             <button 
                                onClick={() => handleRestore(item)}
                                className="text-xs bg-[#333] hover:bg-brand hover:text-black text-white px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors opacity-0 group-hover:opacity-100"
                             >
                                 <RotateCcw size={12} /> Restaurar
                             </button>
                         )}
                     </div>
                 ))
             )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-[#444] flex flex-col gap-2 shrink-0">

              {/* Inline: confirmação de restauração (substitui confirm()) */}
              {confirmRestore && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 animate-in fade-in">
                      <p className="text-xs text-yellow-200 mb-2 leading-relaxed">
                          Restaurar versão de <strong>{new Date(confirmRestore.timestamp).toLocaleString()}</strong>?<br/>
                          O conteúdo atual será substituído.
                      </p>
                      <div className="flex gap-2 justify-end">
                          <button
                              onClick={() => setConfirmRestore(null)}
                              className="px-3 py-1.5 bg-[#333] hover:bg-[#444] text-white rounded-lg text-xs transition-colors"
                          >
                              Cancelar
                          </button>
                          <button
                              onClick={handleConfirmRestore}
                              className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                          >
                              <RotateCcw size={12} /> Confirmar
                          </button>
                      </div>
                  </div>
              )}

              {/* Inline: nome da versão (substitui prompt()) */}
              {showNameInput && (
                  <div className="flex gap-2 animate-in fade-in">
                      <input
                          autoFocus
                          className="flex-1 bg-[#2c2c2c] border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:border-brand outline-none transition-colors"
                          value={snapshotName}
                          onChange={e => setSnapshotName(e.target.value)}
                          onKeyDown={e => {
                              if (e.key === 'Enter') handleConfirmSnapshot();
                              if (e.key === 'Escape') setShowNameInput(false);
                          }}
                          placeholder="Nome da versão"
                      />
                      <button
                          onClick={handleConfirmSnapshot}
                          className="px-3 py-1.5 bg-brand text-[#0b141a] rounded-lg text-sm font-bold hover:brightness-110 transition-all"
                      >
                          OK
                      </button>
                      <button
                          onClick={() => setShowNameInput(false)}
                          className="px-3 py-1.5 bg-[#333] hover:bg-[#444] text-white rounded-lg text-sm transition-colors"
                      >
                          ×
                      </button>
                  </div>
              )}

              <button 
                onClick={handleCreateSnapshot}
                disabled={creating || showNameInput}
                className="w-full flex items-center justify-center gap-2 bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Salvar Versão Atual Agora
              </button>
              <p className="text-center text-[10px] text-gray-500">
                  Versões são salvas automaticamente a cada 5 minutos de edição contínua.
              </p>
          </div>
       </div>
    </div>
  );
};

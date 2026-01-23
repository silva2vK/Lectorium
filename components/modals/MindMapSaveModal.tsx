
import React from 'react';
import { Download, CloudUpload, X, Check, Save } from 'lucide-react';
import { BaseModal } from '../shared/BaseModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
  onSaveToDrive: () => void;
  isLocalOnly: boolean;
}

export const MindMapSaveModal: React.FC<Props> = ({ isOpen, onClose, onDownload, onSaveToDrive, isLocalOnly }) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Persistência de Dados"
      icon={<Save size={20} />}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <p className="text-sm text-text-sec mb-6 px-1">Escolha como deseja arquivar o progresso deste mapa mental:</p>
        
        <button 
          onClick={() => { onDownload(); onClose(); }}
          className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-brand/40 hover:bg-white/10 transition-all group text-left"
        >
          <div className="bg-black border border-white/10 p-3 rounded-xl text-text group-hover:text-brand transition-colors">
            <Download size={24} />
          </div>
          <div>
            <div className="font-bold text-white text-base">Baixar Arquivo (.json)</div>
            <div className="text-xs text-text-sec mt-1">Gera uma cópia física imediata no seu dispositivo.</div>
          </div>
        </button>

        <button 
          onClick={() => { onSaveToDrive(); onClose(); }}
          className="w-full flex items-center gap-4 p-5 rounded-2xl bg-brand/5 border border-brand/20 hover:bg-brand/10 transition-all group text-left"
        >
          <div className="bg-brand/20 text-brand p-3 rounded-xl">
            <CloudUpload size={24} />
          </div>
          <div>
            <div className="font-bold text-brand text-base">{isLocalOnly ? 'Sincronizar com Drive' : 'Atualizar no Drive'}</div>
            <div className="text-xs text-brand/70 mt-1">Persistência segura na nuvem com versionamento automático.</div>
          </div>
        </button>

        <div className="pt-4 border-t border-white/5 flex items-center gap-2 text-[10px] text-text-sec opacity-60 justify-center">
            <Check size={10}/> Autosave local ativado (IndexedDB)
        </div>
      </div>
    </BaseModal>
  );
};


import React, { useState, useEffect } from 'react';
import { Icon } from '../../src/components/shared/Icon';
import { BaseModal } from '../shared/BaseModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onRename: (newName: string) => void;
}

export const MindMapRenameModal: React.FC<Props> = ({ isOpen, onClose, currentName, onRename }) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(currentName.replace('.mindmap', '').replace('.json', ''));
    }
  }, [isOpen, currentName]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (name.trim() && name.trim() !== currentName) {
      onRename(name.trim());
      onClose();
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Renomear Mapa"
      icon={<Edit2 size={20} />}
      maxWidth="max-w-sm"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button onClick={onClose} className="px-4 py-2 text-text-sec hover:text-white transition-colors text-sm">Cancelar</button>
          <button 
            onClick={() => handleSubmit()}
            disabled={!name.trim()}
            className="bg-brand text-bg px-6 py-2 rounded-full font-bold hover:brightness-110 transition-all text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Check size={16} /> Confirmar
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-text-sec uppercase tracking-widest px-1">Novo Título</label>
          <input 
            autoFocus
            type="text"
            className="w-full bg-[#2c2c2c] border border-border rounded-xl p-3 text-sm text-white focus:border-brand outline-none transition-all shadow-inner"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Teoria da Relatividade"
          />
        </div>
        <p className="text-[10px] text-text-sec px-1 italic">O sufixo .mindmap será adicionado automaticamente.</p>
      </form>
    </BaseModal>
  );
};

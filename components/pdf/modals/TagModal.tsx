import React, { useState, useEffect } from 'react';
import { X, Hash, Info } from 'lucide-react';
import { Annotation } from '../../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  annotation: Annotation | null;
  onSave: (tags: string[]) => void;
}

export const TagModal: React.FC<Props> = ({ isOpen, onClose, annotation, onSave }) => {
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && annotation) {
      setTags(annotation.tags || []);
      setTagInput('');
    }
  }, [isOpen, annotation]);

  if (!isOpen || !annotation) return null;

  const handleAddTag = (e?: React.FormEvent) => {
    e?.preventDefault();
    const newTag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1e1e1e] border border-brand/30 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-2 text-brand">
            <Hash size={18} />
            <h3 className="font-bold text-sm uppercase tracking-wider">Sintetizador Lexicográfico</h3>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="bg-brand/5 border border-brand/20 p-3 rounded-xl flex gap-3 text-sm text-brand/90">
            <Info size={16} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Adicione tags a este trecho para que o <strong>Sintetizador Lexicográfico</strong> possa analisá-lo. 
              Ex: <span className="font-mono bg-black/30 px-1 rounded">metodologia</span>, <span className="font-mono bg-black/30 px-1 rounded">conclusao</span>.
            </p>
          </div>

          <div className="bg-black/30 p-3 rounded-xl border border-white/5 max-h-32 overflow-y-auto custom-scrollbar">
            <p className="text-xs text-white/70 italic line-clamp-3">"{annotation.text}"</p>
          </div>

          <form onSubmit={handleAddTag} className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Hash size={14} className="text-white/40" />
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Digite uma tag e aperte Enter..."
              className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-8 pr-4 text-white text-sm focus:outline-none focus:border-brand transition-colors"
              autoFocus
            />
          </form>

          <div className="flex flex-wrap gap-2 min-h-[40px]">
            {tags.length === 0 && (
              <span className="text-xs text-white/30 italic flex items-center h-full">Nenhuma tag adicionada.</span>
            )}
            {tags.map(tag => (
              <span key={tag} className="bg-brand/10 border border-brand/30 text-brand px-2 py-1 rounded-lg text-xs font-mono flex items-center gap-1 animate-in zoom-in duration-200">
                #{tag}
                <button onClick={() => handleRemoveTag(tag)} className="hover:text-white hover:bg-brand/20 rounded-full p-0.5 transition-colors">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-white hover:bg-white/5 transition-colors">
            Cancelar
          </button>
          <button onClick={() => onSave(tags)} className="px-4 py-2 rounded-xl text-sm font-bold bg-brand text-black hover:brightness-110 transition-all shadow-[0_0_15px_rgba(74,222,128,0.2)]">
            Salvar Tags
          </button>
        </div>
      </div>
    </div>
  );
};

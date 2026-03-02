
import React, { useState } from 'react';
import { BaseModal } from '../../shared/BaseModal';
import { MessageSquareQuote, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (content: string) => void;
}

export const FootnoteModal: React.FC<Props> = ({ isOpen, onClose, onInsert }) => {
  const [content, setContent] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    onInsert(content);
    setContent('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-[#1e1e1e] border border-border rounded-[2rem] w-full max-w-md relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                    <div className="text-brand"><MessageSquareQuote size={20} /></div>
                    <h3 className="text-xl font-bold text-text">Inserir Nota de Rodapé</h3>
                </div>
                <button onClick={onClose} className="p-2 text-text-sec hover:text-text hover:bg-white/5 rounded-full transition-colors">
                    <Check size={20} className="rotate-45" /> {/* Using rotate-45 Check as 'X' style or standard X from lucide if imported */}
                </button>
            </div>

            <div className="p-6 space-y-4">
                <textarea 
                    autoFocus
                    className="w-full h-32 bg-[#2c2c2c] border border-gray-600 rounded-xl p-3 text-sm text-white focus:border-brand outline-none resize-none custom-scrollbar leading-relaxed placeholder:text-gray-500"
                    placeholder="Digite o texto da nota..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={(e) => {
                        if(e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                />
                <p className="text-xs text-text-sec">
                    A numeração será ajustada automaticamente de acordo com a posição no texto.
                </p>
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-2 w-full">
                <button onClick={onClose} className="px-4 py-2 text-text-sec hover:text-white transition-colors text-sm">Cancelar</button>
                <button onClick={handleSubmit} className="bg-brand text-[#0b141a] px-6 py-2 rounded-full font-bold hover:brightness-110 transition-all text-sm flex items-center gap-2">
                    <Check size={16} /> Inserir
                </button>
            </div>
        </div>
    </div>
  );
};

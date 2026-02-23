import React, { useState } from 'react';
import { BaseModal } from '../../shared/BaseModal';
import { Plus, Trash2, Table, Loader2, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onExtract: (fields: string[]) => Promise<void>;
}

export const ExtractionModal: React.FC<Props> = ({ isOpen, onClose, onExtract }) => {
  const [fields, setFields] = useState<string[]>(['Autor', 'Ano', 'Metodologia', 'Resultados']);
  const [newField, setNewField] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAddField = () => {
    if (newField.trim()) {
      setFields([...fields, newField.trim()]);
      setNewField('');
    }
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleExtract = async () => {
    if (fields.length === 0) return;
    setIsProcessing(true);
    try {
      await onExtract(fields);
      onClose();
    } catch (error) {
      console.error(error);
      alert('Erro na extração. Verifique o console.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Extração Tabular (IA)" maxWidth="max-w-md">
      <div className="space-y-6">
        <div className="bg-brand/10 border border-brand/20 p-4 rounded-lg flex gap-3 items-start">
            <Sparkles className="text-brand shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-text-sec">
                Defina as colunas da tabela. A IA lerá o PDF aberto (ou texto selecionado) e preencherá os dados automaticamente.
            </p>
        </div>

        <div>
            <label className="text-xs font-bold text-text-sec uppercase mb-2 block">Colunas da Tabela</label>
            <div className="flex gap-2 mb-3">
                <input 
                    value={newField}
                    onChange={(e) => setNewField(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
                    placeholder="Ex: Hipótese, Amostra..."
                    className="flex-1 bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-brand outline-none"
                />
                <button 
                    onClick={handleAddField}
                    className="bg-white/10 hover:bg-white/20 text-white p-2 rounded transition-colors"
                >
                    <Plus size={18} />
                </button>
            </div>

            <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                {fields.map((field, i) => (
                    <div key={i} className="flex items-center gap-2 bg-surface border border-white/10 px-3 py-1.5 rounded-full text-sm animate-in fade-in zoom-in duration-200">
                        <span className="text-white">{field}</span>
                        <button onClick={() => handleRemoveField(i)} className="text-red-400 hover:text-red-300">
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
                {fields.length === 0 && <span className="text-text-sec text-sm italic">Nenhuma coluna definida.</span>}
            </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button onClick={onClose} className="px-4 py-2 text-sm text-text-sec hover:text-white transition-colors">
                Cancelar
            </button>
            <button 
                onClick={handleExtract} 
                disabled={isProcessing || fields.length === 0}
                className="bg-brand text-black font-bold px-6 py-2 rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Table size={18} />}
                {isProcessing ? 'Extraindo...' : 'Gerar Tabela'}
            </button>
        </div>
      </div>
    </BaseModal>
  );
};

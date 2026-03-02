
import React, { useState, useEffect } from 'react';
import { Icon } from '../src/components/shared/Icon';
import { BaseModal } from './shared/BaseModal';
import { getStoredApiKeys, saveApiKeys, removeApiKey } from '../utils/apiKeyUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [newKey, setNewKey] = useState('');
  const [savedKeys, setSavedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredApiKeys();
      setSavedKeys(stored);
      setNewKey('');
    }
  }, [isOpen]);

  const handleAddKey = () => {
    if (!newKey.trim()) return;
    const updatedKeys = [...savedKeys, newKey.trim()];
    saveApiKeys(updatedKeys);
    setSavedKeys(updatedKeys);
    setNewKey('');
  };

  const handleRemoveKey = (indexToRemove: number) => {
    const updatedKeys = savedKeys.filter((_, index) => index !== indexToRemove);
    if (updatedKeys.length === 0) {
      removeApiKey();
    } else {
      saveApiKeys(updatedKeys);
    }
    setSavedKeys(updatedKeys);
  };

  const handleRemoveAll = () => {
    removeApiKey();
    setSavedKeys([]);
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Configuração de IA (Key Pool)"
      icon={<Key size={20} />}
      maxWidth="max-w-md"
    >
      <div className="space-y-6">
        <div className="bg-brand/10 border border-brand/20 p-4 rounded-xl">
          <h4 className="text-sm font-bold text-brand flex items-center gap-2 mb-2">
            <ShieldCheck size={16} /> Pool de Chaves & Resiliência
          </h4>
          <p className="text-xs text-text-sec leading-relaxed">
            Para processamento em lote (Estado do Conhecimento), você pode adicionar múltiplas chaves do Gemini. O sistema irá rotacioná-las automaticamente se a cota de uma for excedida.
            <br /><br />
            <strong>Suas chaves são salvas apenas no armazenamento local do seu navegador.</strong> Elas nunca são enviadas para nossos servidores.
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-300">Adicionar API Key do Gemini</label>
          <div className="flex gap-2">
            <input 
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Cole sua chave aqui (Ex: AIzaSy...)"
              className="flex-1 bg-[#2c2c2c] border border-gray-600 rounded-xl p-3 text-sm text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleAddKey()}
            />
            <button 
              onClick={handleAddKey}
              disabled={!newKey.trim()}
              className="bg-brand text-bg p-3 rounded-xl hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center"
            >
              <Plus size={20} />
            </button>
          </div>
          <div className="flex justify-end">
             <a 
               href="https://aistudio.google.com/app/apikey" 
               target="_blank" 
               rel="noreferrer"
               className="text-xs text-brand hover:underline flex items-center gap-1"
             >
               Obter chave gratuitamente <ExternalLink size={10} />
             </a>
          </div>
        </div>

        {savedKeys.length > 0 && (
          <div className="space-y-2 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-gray-300">Chaves Ativas ({savedKeys.length})</h4>
              <button onClick={handleRemoveAll} className="text-xs text-red-400 hover:text-red-300 hover:underline">
                Remover Todas
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-2 custom-scrollbar pr-2">
              {savedKeys.map((key, index) => (
                <div key={index} className="bg-[#2c2c2c] p-3 rounded-xl border border-green-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                      <Check size={12} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Chave {index + 1}</div>
                      <div className="text-[10px] text-text-sec font-mono">••••••••••••{key.slice(-4)}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRemoveKey(index)}
                    className="p-1.5 hover:bg-red-500/10 text-text-sec hover:text-red-400 rounded-lg transition-colors"
                    title="Remover Chave"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
           <button onClick={onClose} className="px-6 py-2 bg-surface border border-border rounded-xl text-sm hover:bg-white/5 transition-colors">
             Fechar
           </button>
        </div>
      </div>
    </BaseModal>
  );
};

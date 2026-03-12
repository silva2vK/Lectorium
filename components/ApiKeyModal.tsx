import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { BaseModal } from './shared/BaseModal';
import {
  getStoredApiKeys,
  saveApiKeys,
  getCurrentKeyIndex,
} from '../utils/apiKeyUtils';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const [keys, setKeys] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  // Sincroniza estado com localStorage ao abrir
  useEffect(() => {
    if (isOpen) {
      setKeys(getStoredApiKeys());
      setActiveIndex(getCurrentKeyIndex());
      setInputValue('');
      setError('');
    }
  }, [isOpen]);

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (!trimmed.startsWith('AIza')) {
      setError('Chave inválida. Chaves Gemini começam com "AIza".');
      return;
    }

    if (keys.includes(trimmed)) {
      setError('Esta chave já está na lista.');
      return;
    }

    const updated = [...keys, trimmed];
    saveApiKeys(updated);
    setKeys(updated);
    setActiveIndex(getCurrentKeyIndex());
    setInputValue('');
    setError('');
  };

  const handleRemove = (index: number) => {
    const updated = keys.filter((_, i) => i !== index);
    saveApiKeys(updated);
    setKeys(updated);
    setActiveIndex(getCurrentKeyIndex());
  };

  const handleRemoveAll = () => {
    saveApiKeys([]);
    setKeys([]);
    setActiveIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') onClose();
  };

  const maskKey = (key: string) =>
    '•'.repeat(Math.max(0, key.length - 4)) + key.slice(-4);

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Configuração de IA (Key Pool)">
      {/* Descrição */}
      <div className="mb-5 p-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white/70 space-y-2">
        <div className="flex items-center gap-2 text-amber-400 font-medium">
          <AlertCircle size={15} />
          <span>Pool de Chaves &amp; Resiliência</span>
        </div>
        <p>
          Para processamento em lote (Estado do Conhecimento), você pode adicionar
          múltiplas chaves do Gemini. O sistema irá rotacioná-las automaticamente
          se a cota de uma for excedida.
        </p>
        <p>
          Suas chaves são salvas apenas no armazenamento local do seu navegador.
          Elas nunca são enviadas para nossos servidores.
        </p>
      </div>

      {/* Input */}
      <p className="text-sm text-white/60 mb-2">Adicionar API Key do Gemini</p>
      <div className="flex gap-2 mb-1">
        <input
          type="password"
          value={inputValue}
          onChange={e => { setInputValue(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder="Cole sua chave aqui (Ex: AIzaSy...)"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 transition-colors"
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white transition-colors flex items-center gap-1.5 text-sm font-medium"
        >
          <Plus size={16} />
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-3 flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}

      {/* Link obter chave */}
      <a
        href="https://aistudio.google.com/app/apikey"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 mb-5 transition-colors"
      >
        Obter chave gratuitamente <ExternalLink size={11} />
      </a>

      {/* Lista de chaves */}
      {keys.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-white/60">Chaves Ativas ({keys.length})</p>
            <button
              onClick={handleRemoveAll}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Remover Todas
            </button>
          </div>

          <div className="space-y-2">
            {keys.map((key, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle
                    size={16}
                    className={i === activeIndex ? 'text-green-400' : 'text-white/20'}
                  />
                  <div>
                    <p className="text-sm text-white/80 font-medium">Chave {i + 1}</p>
                    <p className="text-xs text-white/40 font-mono">{maskKey(key)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(i)}
                  className="text-white/30 hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {keys.length === 0 && (
        <p className="text-sm text-white/30 text-center py-4">
          Nenhuma chave configurada.
        </p>
      )}

      {/* Fechar */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 text-sm transition-colors"
        >
          Fechar
        </button>
      </div>
    </BaseModal>
  );
};

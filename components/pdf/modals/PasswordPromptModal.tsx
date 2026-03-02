
import React, { useState } from 'react';
import { Lock, Unlock, ArrowRight, AlertCircle } from 'lucide-react';
import { BaseModal } from '../../shared/BaseModal';

interface Props {
  isOpen: boolean;
  onClose: () => void; // Na prática, fechar = cancelar abertura
  onSubmit: (password: string) => void;
  fileName: string;
  isRetry?: boolean;
}

export const PasswordPromptModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, fileName, isRetry }) => {
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (password.trim()) {
      onSubmit(password);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Arquivo Criptografado"
      icon={<Lock size={20} className="text-red-500" />}
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end gap-3 w-full">
            <button onClick={onClose} className="px-4 py-2 text-text-sec hover:text-white transition-colors text-sm">Cancelar</button>
            <button 
                onClick={() => handleSubmit()} 
                className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold hover:brightness-110 transition-all text-sm flex items-center gap-2 shadow-[0_0_20px_-5px_rgba(220,38,38,0.4)]"
            >
                <Unlock size={16} /> Desbloquear
            </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
            <div className="bg-black/20 p-2 rounded-full text-red-500">
                <Lock size={20} />
            </div>
            <div>
                <h4 className="text-sm font-bold text-white mb-1">Acesso Restrito</h4>
                <p className="text-xs text-text-sec leading-relaxed">
                    O arquivo <strong>"{fileName}"</strong> é protegido pelo autor. Digite a senha para descriptografar o conteúdo e habilitar a leitura.
                </p>
            </div>
        </div>

        {isRetry && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-500/30 animate-pulse">
                <AlertCircle size={14} />
                <span>Senha incorreta. Tente novamente.</span>
            </div>
        )}

        <div className="space-y-2">
            <label className="text-xs font-bold text-text-sec uppercase tracking-widest px-1">Senha do Documento</label>
            <div className="relative">
                <input 
                    autoFocus
                    type="password"
                    className="w-full bg-[#2c2c2c] border border-gray-600 rounded-xl p-3 pl-4 text-sm text-white focus:border-red-500 outline-none transition-all shadow-inner placeholder:text-gray-600"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                />
                <button 
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowRight size={14} />
                </button>
            </div>
        </div>
        
        <p className="text-[10px] text-gray-500 text-center">
            A desencriptação é feita localmente. Sua senha nunca é enviada para servidores.
        </p>
      </form>
    </BaseModal>
  );
};

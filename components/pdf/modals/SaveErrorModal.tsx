
import React from 'react';
import { Lock, Download, LogIn, AlertCircle, RefreshCw, X, HardDrive } from 'lucide-react';
import { BaseModal } from '../../shared/BaseModal';
import { SaveErrorType } from '../../../hooks/usePdfSaver';

interface Props {
  isOpen: boolean;
  errorType: SaveErrorType;
  onClose: () => void;
  onReconnect: () => void;
  onDownload: () => void;
  onSaveCopy: () => void;
}

export const SaveErrorModal: React.FC<Props> = ({ 
  isOpen, errorType, onClose, onReconnect, onDownload, onSaveCopy 
}) => {
  if (!isOpen || !errorType) return null;

  const isAuth = errorType === 'auth';
  const isForbidden = errorType === 'forbidden';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={isAuth ? "Conexão Expirada" : isForbidden ? "Permissão Negada" : "Falha na Sincronização"}
      icon={isAuth ? <Lock size={20} className="text-yellow-500" /> : <AlertCircle size={20} className="text-red-500" />}
      maxWidth="max-w-md"
    >
      <div className="space-y-6">
        <div className={`p-4 rounded-xl border ${isAuth ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <p className="text-sm text-white leading-relaxed">
            {isAuth 
              ? "Sua sessão com o Google Drive expirou. Para salvar as alterações diretamente na nuvem, você precisa renovar o acesso."
              : isForbidden 
                ? "O Lectorium não tem permissão para substituir este arquivo original. Isso pode ocorrer em arquivos compartilhados ou protegidos."
                : "Ocorreu um erro inesperado de rede ao tentar sincronizar seus dados com o Google Drive."
            }
          </p>
        </div>

        <div className="space-y-3">
          {isAuth ? (
            <button 
              onClick={onReconnect}
              className="w-full bg-brand text-[#0b141a] py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:brightness-110 transition-all shadow-lg active:scale-95"
            >
              <LogIn size={20} /> Conectar ao Drive
            </button>
          ) : isForbidden ? (
            <button 
              onClick={onSaveCopy}
              className="w-full bg-brand text-[#0b141a] py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:brightness-110 transition-all shadow-lg active:scale-95"
            >
              <RefreshCw size={20} /> Salvar como Cópia no Drive
            </button>
          ) : (
            <button 
              onClick={onSaveCopy}
              className="w-full bg-white text-black py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-100 transition-all shadow-lg active:scale-95"
            >
              <RefreshCw size={20} /> Tentar Novamente
            </button>
          )}

          <div className="flex items-center gap-4 py-2">
            <div className="h-px bg-white/10 flex-1"></div>
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Ou proteger localmente</span>
            <div className="h-px bg-white/10 flex-1"></div>
          </div>

          <button 
            onClick={onDownload}
            className="w-full bg-[#2c2c2c] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-[#363636] border border-gray-700 transition-all active:scale-95"
          >
            <HardDrive size={20} className="text-blue-400" /> Baixar Arquivo Anotado
          </button>
        </div>

        <p className="text-[10px] text-gray-500 text-center leading-relaxed italic">
          O Lectorium opera local-first. Suas anotações estão seguras em cache neste navegador, mas recomendamos baixar uma cópia caso não consiga reconectar agora.
        </p>
      </div>
    </BaseModal>
  );
};

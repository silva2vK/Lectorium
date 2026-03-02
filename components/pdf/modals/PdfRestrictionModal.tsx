
import React from 'react';
import { Icon } from '../../../src/components/shared/Icon';
import { BaseModal } from '../../shared/BaseModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const PdfRestrictionModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Arquivo Protegido"
      icon={<Lock size={20} className="text-red-500" />}
      maxWidth="max-w-md"
      footer={
        <button 
            onClick={onClose} 
            className="w-full bg-[#2c2c2c] hover:bg-[#3c3c3c] text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
        >
            <ArrowLeft size={18} /> Voltar ao Início
        </button>
      }
    >
      <div className="space-y-6 text-center">
        <p className="text-sm text-gray-300 leading-relaxed">
            Identificamos que este PDF possui uma <strong>Senha de Proprietário (Owner Password)</strong> que restringe a edição e cópia.
        </p>
        
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl">
            <p className="text-xs text-yellow-200">
                No momento, o Lectorium não realiza o desbloqueio automático dessa proteção para garantir a estabilidade do sistema.
            </p>
        </div>

        <div className="space-y-3">
            <p className="text-xs text-text-sec">Sugerimos usar esta ferramenta gratuita para desbloquear o arquivo:</p>
            <a 
                href="https://www.ilovepdf.com/pt/desbloquear_pdf" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-brand text-[#0b141a] py-3 rounded-xl font-bold hover:brightness-110 transition-all"
            >
                <ExternalLink size={18} /> Abrir iLovePDF (Desbloquear)
            </a>
        </div>
      </div>
    </BaseModal>
  );
};

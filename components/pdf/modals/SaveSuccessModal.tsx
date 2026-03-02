
import React from 'react';
import { CheckCircle, Cloud, RefreshCw, WifiOff, ArrowRight } from 'lucide-react';
import { BaseModal } from '../../shared/BaseModal';

export type SuccessMode = 'upload' | 'overwrite' | 'offline';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mode: SuccessMode;
  fileName: string;
}

export const SaveSuccessModal: React.FC<Props> = ({ isOpen, onClose, mode, fileName }) => {
  if (!isOpen) return null;

  const config = {
    upload: {
      title: 'Upload Concluído',
      icon: <Cloud size={24} className="text-green-400" />,
      desc: 'Uma nova cópia do arquivo foi criada com sucesso no seu Google Drive.',
      color: 'bg-green-500/10 border-green-500/20 text-green-400'
    },
    overwrite: {
      title: 'Arquivo Atualizado',
      icon: <RefreshCw size={24} className="text-blue-400" />,
      desc: 'O arquivo original foi substituído pela nova versão com todas as suas anotações.',
      color: 'bg-blue-500/10 border-blue-500/20 text-blue-400'
    },
    offline: {
      title: 'Salvo no Dispositivo',
      icon: <WifiOff size={24} className="text-yellow-500" />,
      desc: 'O arquivo foi salvo localmente. A sincronização com a nuvem ocorrerá automaticamente quando houver conexão.',
      color: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
    }
  };

  const current = config[mode];

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Operação Bem Sucedida"
      icon={<CheckCircle size={20} className="text-brand" />}
      maxWidth="max-w-md"
      footer={
        <button 
            onClick={onClose} 
            className="w-full bg-brand text-[#0b141a] py-3 rounded-xl font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
        >
            Continuar <ArrowRight size={16} />
        </button>
      }
    >
      <div className="space-y-6 text-center py-4">
        
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 ${mode === 'upload' ? 'bg-green-900/20 border-green-500/30' : mode === 'overwrite' ? 'bg-blue-900/20 border-blue-500/30' : 'bg-yellow-900/20 border-yellow-500/30'}`}>
            <div className="animate-in zoom-in duration-300">
                {current.icon}
            </div>
        </div>

        <div>
            <h3 className="text-xl font-bold text-white mb-2">{current.title}</h3>
            <p className="text-sm text-text-sec px-4 leading-relaxed">
                {current.desc}
            </p>
        </div>

        <div className={`mx-auto p-3 rounded-lg border max-w-[90%] ${current.color}`}>
            <p className="text-xs font-mono truncate font-bold">
                {fileName}
            </p>
        </div>

      </div>
    </BaseModal>
  );
};

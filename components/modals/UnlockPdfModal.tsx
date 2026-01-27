
import React, { useState, useEffect } from 'react';
import { Lock, Unlock, AlertTriangle, Loader2, CheckCircle, X, FileText, ArrowRight } from 'lucide-react';
import { BaseModal } from '../shared/BaseModal';
import { sanitizePdf } from '../../services/pdfModifierService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
}

export const UnlockPdfModal: React.FC<Props> = ({ isOpen, onClose, file }) => {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'processing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);

  useEffect(() => {
    if (isOpen && file) {
      resetState();
      checkFile(file);
    }
  }, [isOpen, file]);

  const resetState = () => {
    setPassword('');
    setStatus('analyzing');
    setErrorMsg('');
    setNeedsPassword(false);
  };

  const checkFile = async (f: File) => {
    // Tenta sanitizar sem senha inicialmente para ver se é possível (ex: apenas owner password fraca)
    try {
        await sanitizePdf(f);
        // Se passar sem erro, significa que não precisava de senha ou a senha era vazia
        // Mas se o usuário abriu isso, provavelmente queria tirar alguma restrição.
        // Vamos direto para o sucesso.
        setNeedsPassword(false);
        setStatus('idle'); // Deixa o usuário clicar em "Desbloquear" para confirmar
    } catch (e: any) {
        if (e.message === 'PDF_ENCRYPTED_PASSWORD_REQUIRED' || e.message.includes('Password')) {
            setNeedsPassword(true);
            setStatus('idle');
        } else {
            setStatus('error');
            setErrorMsg("O arquivo parece estar corrompido ou não é um PDF válido.");
        }
    }
  };

  const handleUnlock = async () => {
    if (!file) return;
    setStatus('processing');
    setErrorMsg('');

    try {
        const unlockedBlob = await sanitizePdf(file, password);
        
        // Download Automático
        const url = URL.createObjectURL(unlockedBlob);
        const a = document.createElement('a');
        a.href = url;
        // Adiciona _unlocked ao nome
        a.download = file.name.replace('.pdf', '_unlocked.pdf');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setStatus('success');
    } catch (e: any) {
        console.error(e);
        setStatus('error');
        if (e.message === 'PDF_ENCRYPTED_PASSWORD_REQUIRED' || e.message.includes('Incorrect password')) {
            setErrorMsg("Senha incorreta. Tente novamente.");
        } else {
            setErrorMsg("Falha ao desbloquear. O arquivo pode ter uma proteção não suportada.");
        }
    }
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Desbloquear PDF"
      icon={<Unlock size={20} className={status === 'success' ? 'text-green-500' : 'text-text'} />}
      maxWidth="max-w-md"
    >
      <div className="space-y-6">
        {/* Header Status */}
        <div className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
            status === 'success' ? 'bg-green-500/10 border-green-500/30' :
            status === 'error' ? 'bg-red-500/10 border-red-500/30' :
            'bg-brand/5 border-brand/20'
        }`}>
            {status === 'success' ? <CheckCircle size={20} className="text-green-500 shrink-0" /> :
             status === 'error' ? <AlertTriangle size={20} className="text-red-500 shrink-0" /> :
             status === 'analyzing' || status === 'processing' ? <Loader2 size={20} className="text-brand shrink-0 animate-spin" /> :
             <Lock size={20} className="text-brand shrink-0" />
            }
            
            <div className="flex-1 min-w-0">
                <h4 className={`text-sm font-bold mb-1 ${
                    status === 'success' ? 'text-green-400' :
                    status === 'error' ? 'text-red-400' :
                    'text-brand'
                }`}>
                    {status === 'success' ? "Arquivo Desbloqueado!" :
                     status === 'error' ? "Erro no Processo" :
                     status === 'analyzing' ? "Analisando Criptografia..." :
                     status === 'processing' ? "Removendo Proteção..." :
                     "Arquivo Selecionado"
                    }
                </h4>
                <p className="text-xs text-text-sec truncate" title={file?.name}>
                    {status === 'success' ? "Download iniciado automaticamente." : 
                     errorMsg || file?.name}
                </p>
            </div>
        </div>

        {/* Password Input */}
        {status !== 'success' && status !== 'analyzing' && (
            <div className="space-y-4">
                {needsPassword ? (
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-text-sec uppercase tracking-widest px-1">Senha do Arquivo</label>
                        <input 
                            type="password"
                            autoFocus
                            className="w-full bg-[#2c2c2c] border border-gray-600 rounded-xl p-3 text-sm text-white focus:border-brand outline-none transition-all placeholder:text-gray-600"
                            placeholder="Digite a senha..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                        />
                        <p className="text-[10px] text-gray-500 px-1">
                            A senha é usada apenas localmente para descriptografar o arquivo.
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-gray-300 px-1">
                        Este arquivo parece não ter senha de abertura, ou possui apenas restrições de edição (Owner Password). Clique abaixo para remover as restrições.
                    </p>
                )}

                <div className="flex justify-end pt-2">
                    <button 
                        onClick={handleUnlock}
                        disabled={status === 'processing' || (needsPassword && !password)}
                        className="w-full bg-brand text-[#0b141a] font-bold py-3 rounded-xl hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        {status === 'processing' ? <Loader2 size={18} className="animate-spin" /> : <Unlock size={18} />}
                        {status === 'processing' ? 'Processando...' : 'Desbloquear PDF'}
                    </button>
                </div>
            </div>
        )}

        {status === 'success' && (
            <button onClick={onClose} className="w-full bg-[#2c2c2c] hover:bg-[#363636] text-white py-3 rounded-xl font-bold transition-colors">
                Fechar
            </button>
        )}
      </div>
    </BaseModal>
  );
};

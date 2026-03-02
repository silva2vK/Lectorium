
import React, { useState } from 'react';
import { Icon } from '../../src/components/shared/Icon';
import { BaseModal } from '../shared/BaseModal';
import { useGlobalContext } from '../../context/GlobalContext';
import { loadOcrData, loadAnnotations, saveOfflineFile, addToSyncQueue } from '../../services/storageService';
import { burnAnnotationsToPdf } from '../../services/pdfModifierService';
import { updateDriveFile, uploadFileToDrive } from '../../services/driveService';
import { getValidDriveToken } from '../../services/authService';
import { auth } from '../../firebase';

export const OcrCompletionModal = () => {
  const { ocrCompletion, clearOcrCompletion, addNotification } = useGlobalContext();
  const [isSaving, setIsSaving] = useState(false);

  if (!ocrCompletion) return null;

  const { fileId, filename, sourceBlob, stoppedAtPage } = ocrCompletion;
  const isStopped = !!stoppedAtPage;
  
  // Identifica se foi uma análise da Lente Semântica pelo "filename" especial injetado no SemanticRangeModal
  const isSemanticResult = filename === "Semantic Analysis" || filename === "Semantic Translation";

  const handleReview = () => {
    // Dispara um evento global que o App.tsx ouve para reabrir o arquivo
    window.dispatchEvent(new CustomEvent('reopen-file-request', { 
        detail: { fileId, filename, sourceBlob } 
    }));
    clearOcrCompletion();
  };

  const handleSave = async (mode: 'overwrite' | 'copy') => {
    setIsSaving(true);
    try {
        // 1. Carregar dados processados
        const fullOcrData = await loadOcrData(fileId);
        const ocrMap: Record<number, any[]> = {};
        const semanticData: Record<number, any> = {};

        Object.entries(fullOcrData).forEach(([page, record]) => {
            const p = parseInt(page);
            ocrMap[p] = record.words;
            if (record.markdown) {
                semanticData[p] = { markdown: record.markdown, processedAt: Date.now() };
            }
        });

        const uid = auth.currentUser?.uid || 'guest';
        const annotations = await loadAnnotations(uid, fileId);

        // 2. Processar PDF ("Queimar" camadas visuais, OCR e agora dados semânticos)
        const newBlob = await burnAnnotationsToPdf(sourceBlob, annotations, ocrMap, 0, semanticData);
        
        const accessToken = getValidDriveToken();
        const isLocal = fileId.startsWith('local-') || fileId.startsWith('native-');
        const finalFilename = isSemanticResult ? "Análise Lectorium.pdf" : filename;

        if (mode === 'overwrite') {
            if (!isLocal && accessToken) {
               await updateDriveFile(accessToken, fileId, newBlob);
            }
            await saveOfflineFile({ id: fileId, name: finalFilename, mimeType: 'application/pdf' }, newBlob);
            
            if (!isLocal && !navigator.onLine && accessToken) {
               await addToSyncQueue({ fileId, action: 'update', blob: newBlob, name: finalFilename, mimeType: 'application/pdf' });
            }

            addNotification("Arquivo original atualizado com sucesso.", "success");
        } else {
            const suffix = isStopped ? ' (Parcial)' : ' (Analisado)';
            const newName = finalFilename.replace(/\.pdf$/i, '') + suffix + '.pdf';
            
            if (!isLocal && accessToken) {
               await uploadFileToDrive(accessToken, newBlob, newName);
            } else {
               const url = URL.createObjectURL(newBlob);
               const a = document.createElement('a');
               a.href = url;
               a.download = newName;
               document.body.appendChild(a);
               a.click();
               document.body.removeChild(a);
            }
            addNotification("Cópia salva com sucesso!", "success");
        }
        
        clearOcrCompletion();
    } catch (e: any) {
        console.error(e);
        addNotification(`Erro ao salvar: ${e.message}`, "error");
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <BaseModal
      isOpen={!!ocrCompletion}
      onClose={clearOcrCompletion}
      title={isSemanticResult ? "Análise Semântica Concluída" : (isStopped ? "Processo Pausado" : "OCR Concluído")}
      icon={isSemanticResult ? <BrainCircuit size={20} className="text-purple-400" /> : (isStopped ? <AlertTriangle size={20} className="text-yellow-500" /> : <CheckCircle size={20} className="text-green-500" />)}
      maxWidth="max-w-md"
    >
      <div className="space-y-6">
        {isSemanticResult ? (
            <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl flex items-start gap-3">
                <Sparkles size={20} className="text-purple-400 shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-white mb-1">Inteligência Estruturada</h4>
                    <p className="text-xs text-text-sec">
                        O Gemini Vision transcreveu o conteúdo preservando a semântica. O documento está pronto para leitura enriquecida.
                    </p>
                </div>
            </div>
        ) : isStopped ? (
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex items-start gap-3">
                <Hourglass size={20} className="text-yellow-500 shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-white mb-1">Pausa Técnica (Pág {stoppedAtPage})</h4>
                    <p className="text-xs text-text-sec">A cota da API foi atingida. Salve o progresso atual para continuar depois.</p>
                </div>
            </div>
        ) : (
            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-start gap-3">
                <FileText size={20} className="text-green-500 shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-white mb-1">Processamento Finalizado</h4>
                    <p className="text-xs text-text-sec">As camadas de texto selecionável foram injetadas com sucesso.</p>
                </div>
            </div>
        )}

        {isSaving ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 size={32} className="animate-spin text-brand" />
                <p className="text-sm text-text-sec animate-pulse">Codificando metadados no PDF...</p>
            </div>
        ) : (
            <div className="space-y-3">
                <button 
                    onClick={handleReview}
                    className="w-full bg-white text-black p-4 rounded-xl font-bold flex items-center justify-between group hover:bg-brand hover:text-black transition-all shadow-lg active:scale-95"
                >
                    <div className="flex items-center gap-3">
                        <ExternalLink size={20} />
                        <div className="text-left">
                            <span className="block text-sm">Abrir e Revisar</span>
                            <span className="block text-[10px] opacity-70 font-normal">Ver transcrição e destaques agora</span>
                        </div>
                    </div>
                </button>

                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => handleSave('overwrite')}
                        className="bg-[#2c2c2c] text-white p-3 rounded-xl font-bold flex flex-col items-center gap-1 hover:bg-[#363636] border border-transparent hover:border-brand/30 transition-all"
                    >
                        <Save size={18} className="text-brand" />
                        <span className="text-[11px]">Substituir Original</span>
                    </button>

                    <button 
                        onClick={() => handleSave('copy')}
                        className="bg-[#2c2c2c] text-white p-3 rounded-xl font-bold flex flex-col items-center gap-1 hover:bg-[#363636] border border-transparent hover:border-brand/30 transition-all"
                    >
                        <Copy size={18} className="text-blue-400" />
                        <span className="text-[11px]">Baixar Cópia</span>
                    </button>
                </div>

                <button 
                    onClick={clearOcrCompletion}
                    className="w-full text-text-sec p-3 text-xs hover:text-white transition-colors"
                >
                    Fechar (Manter apenas local)
                </button>
            </div>
        )}
      </div>
    </BaseModal>
  );
};

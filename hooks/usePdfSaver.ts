
import React, { useState, useCallback, useEffect } from 'react';
import { burnAnnotationsToPdf } from '../services/pdfModifierService';
import { updateDriveFile, uploadFileToDrive } from '../services/driveService';
import { 
  saveOfflineFile, addToSyncQueue, 
  acquireFileLock, releaseFileLock, saveAuditRecord 
} from '../services/storageService';
import { computeSparseHash } from '../utils/hashUtils';
import { blobRegistry } from '../services/blobRegistry';
import { Annotation, SemanticLensData } from '../types';

export type SaveErrorType = 'auth' | 'forbidden' | 'network' | null;

interface UsePdfSaverProps {
  fileId: string;
  fileName: string;
  fileParents?: string[];
  accessToken?: string | null;
  annotations: Annotation[];
  currentBlobRef: React.MutableRefObject<Blob | null>;
  originalBlob: Blob | null;
  ocrToBurn: Record<number, any[]>;
  docPageOffset: number;
  lensData: Record<number, SemanticLensData>;
  onUpdateOriginalBlob: (blob: Blob) => void;
  onOcrSaved: () => void;
  setHasUnsavedOcr: (v: boolean) => void;
}

export const usePdfSaver = ({
  fileId,
  fileName,
  fileParents,
  accessToken,
  annotations,
  currentBlobRef,
  originalBlob,
  ocrToBurn,
  docPageOffset,
  lensData,
  onUpdateOriginalBlob,
  onOcrSaved,
  setHasUnsavedOcr
}: UsePdfSaverProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState<SaveErrorType>(null);
  const [isOfflineAvailable, setIsOfflineAvailable] = useState(false);

  // Janitor Hook: Limpa blobs gerados ao desmontar o componente de visualização
  useEffect(() => {
    return () => {
      blobRegistry.revokeAll();
    };
  }, [fileId]);

  const handleDownload = async () => {
     const sourceBlob = currentBlobRef.current || originalBlob;
     if (!sourceBlob) return;
     
     setIsSaving(true);
     setSaveMessage("Consolidando inteligência...");
     
     try {
         const newBlob = await burnAnnotationsToPdf(sourceBlob, annotations, ocrToBurn, docPageOffset, lensData);
         const url = blobRegistry.register(URL.createObjectURL(newBlob));
         
         const a = document.createElement('a');
         a.href = url;
         a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         
         // Não revogamos imediatamente para dar tempo ao browser de iniciar o download
         setTimeout(() => blobRegistry.revoke(url), 10000);
         setSaveError(null);
     } catch (e) {
         console.error("Falha na exportação:", e);
         setSaveError('network');
     } finally {
         setIsSaving(false);
         setSaveMessage("");
     }
  };

  const uploadToSpecificFolder = useCallback(async (folderId: string) => {
    const sourceBlob = currentBlobRef.current || originalBlob;
    if (!sourceBlob || !accessToken) return;
    
    setIsSaving(true);
    setSaveMessage("Injetando metadados e enviando...");
    
    try {
        const newBlob = await burnAnnotationsToPdf(sourceBlob, annotations, ocrToBurn, docPageOffset, lensData);
        const name = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
        await uploadFileToDrive(accessToken, newBlob, name, [folderId]);
        setSaveError(null);
    } catch (e: any) {
        console.error(e);
        if (e.message?.includes('401')) setSaveError('auth');
        else if (e.message?.includes('403')) setSaveError('forbidden');
        else setSaveError('network');
    } finally {
        setIsSaving(false);
        setSaveMessage("");
    }
  }, [accessToken, annotations, currentBlobRef, originalBlob, ocrToBurn, docPageOffset, lensData, fileName]);

  // Função auxiliar de salvamento offline/fila (DRY)
  const executeOfflineFallback = async (blob: Blob, hash: string, mode: 'overwrite' | 'copy') => {
      const fileMeta = { id: fileId, name: fileName, mimeType: 'application/pdf', parents: fileParents };
      
      // 1. Salva localmente (acesso imediato)
      await saveOfflineFile(fileMeta, blob);
      setIsOfflineAvailable(true);
      
      if (mode === 'overwrite') {
          await saveAuditRecord(fileId, hash, annotations.length);
      }

      // 2. Adiciona à fila de sincronização
      await addToSyncQueue({
          fileId: mode === 'overwrite' ? fileId : `new-${Date.now()}`,
          action: mode === 'overwrite' ? 'update' : 'create',
          blob: blob,
          name: mode === 'overwrite' ? fileName : fileName.replace('.pdf', '') + ' (Anotado).pdf',
          parents: fileParents,
          mimeType: 'application/pdf'
      });

      // 3. Atualiza estado da UI como "Salvo" (mas offline)
      setHasUnsavedOcr(false);
      if (mode === 'overwrite') {
          onOcrSaved();
          onUpdateOriginalBlob(blob);
      }
  };

  const handleSave = async (mode: 'local' | 'overwrite' | 'copy' | 'drive_picker') => {
    const sourceBlob = currentBlobRef.current || originalBlob;
    if (!sourceBlob) return;
    if (isSaving) return;

    if (mode === 'drive_picker') return;

    setIsSaving(true);
    setSaveError(null);

    if (mode === 'local') {
        await handleDownload();
        return;
    }

    setSaveMessage(mode === 'copy' ? "Criando Cópia Inteligente..." : "Sincronizando com a Nuvem...");

    try {
        const hasLock = await acquireFileLock(fileId);
        if (!hasLock && mode === 'overwrite') {
            setIsSaving(false);
            return;
        }

        const newBlob = await burnAnnotationsToPdf(sourceBlob, annotations, ocrToBurn, docPageOffset, lensData);
        const newHash = await computeSparseHash(newBlob);
        
        const isLocal = fileId.startsWith('local-') || fileId.startsWith('native-') || !fileId;

        // Caso Offline Explícito: Sem internet detectada
        if (!isLocal && !navigator.onLine && accessToken) {
            try {
                await executeOfflineFallback(newBlob, newHash, mode === 'overwrite' ? 'overwrite' : 'copy');
            } catch (err) {
                console.error("Critical offline save error", err);
                setSaveError('network');
            }
            return;
        }

        if (accessToken && !isLocal) {
            try {
                if (mode === 'overwrite') {
                    await updateDriveFile(accessToken, fileId, newBlob);
                    onUpdateOriginalBlob(newBlob);
                    onOcrSaved();
                    await saveAuditRecord(fileId, newHash, annotations.length);
                    setHasUnsavedOcr(false);
                } else {
                    const name = fileName.replace('.pdf', '') + ' (Anotado).pdf';
                    await uploadFileToDrive(accessToken, newBlob, name, fileParents);
                }
            } catch (e: any) {
                const msg = e.message?.toLowerCase() || "";
                
                // Erros Críticos de Auth/Permissão -> Mostra Modal
                if (msg.includes('401') || msg.includes('unauthorized')) {
                    setSaveError('auth');
                } else if (msg.includes('403') || msg.includes('permission')) {
                    setSaveError('forbidden');
                } else {
                    // Erro de Rede ou Genérico (API falhou, internet caiu, etc) -> FALLBACK PARA FILA
                    console.warn("[Saver] Falha de rede. Ativando fallback para SyncQueue.", e);
                    try {
                        await executeOfflineFallback(newBlob, newHash, mode === 'overwrite' ? 'overwrite' : 'copy');
                        // Limpa qualquer erro residual pois o fallback cuidou disso
                        setSaveError(null);
                    } catch (fallbackErr) {
                        // Se falhar localmente também, aí sim mostramos erro crítico
                        console.error("Fallback failed", fallbackErr);
                        setSaveError('network');
                    }
                }
            }
        } else if (!accessToken && !isLocal) {
            setSaveError('auth');
        }
    } catch (e: any) {
        console.error("Global Save Error:", e);
        setSaveError('network');
    } finally {
        await releaseFileLock(fileId);
        setIsSaving(false);
        setSaveMessage("");
    }
  };

  return {
    handleSave,
    uploadToSpecificFolder,
    isSaving,
    saveMessage,
    saveError,
    setSaveError,
    setIsOfflineAvailable
  };
};

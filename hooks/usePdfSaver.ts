
import React, { useState, useCallback, useEffect } from 'react';
import { burnAnnotationsToPdf } from '../services/pdfModifierService';
import { updateDriveFile, uploadFileToDrive } from '../services/driveService';
import { 
  saveOfflineFile, addToSyncQueue, 
  acquireFileLock, releaseFileLock, saveAuditRecord 
} from '../services/storageService';
import { computeSparseHash } from '../utils/hashUtils';
import { blobRegistry } from '../services/blobRegistry';
import { Annotation, SemanticLensData, MIME_TYPES } from '../types';
import { packLectoriumFile } from '../services/lectService';
import { SuccessMode } from '../components/pdf/modals/SaveSuccessModal';

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
  password?: string;
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
  setHasUnsavedOcr,
  password
}: UsePdfSaverProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState<SaveErrorType>(null);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [isOfflineAvailable, setIsOfflineAvailable] = useState(false);
  
  // Success Modal State
  const [successModal, setSuccessModal] = useState<{ open: boolean; mode: SuccessMode }>({ open: false, mode: 'overwrite' });

  useEffect(() => {
    return () => {
      blobRegistry.revokeAll();
    };
  }, [fileId]);

  // Função centralizada para gerar o Blob final
  // Se PDF_PROTECTED, gera .lect
  const generateFinalBlob = async (): Promise<{ blob: Blob, name: string, mime: string, isFallback: boolean }> => {
     const sourceBlob = currentBlobRef.current || originalBlob;
     if (!sourceBlob) throw new Error("Documento base não encontrado.");

     try {
         const pdfBlob = await burnAnnotationsToPdf(sourceBlob, annotations, ocrToBurn, docPageOffset, lensData, password);
         return { 
             blob: pdfBlob, 
             name: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`, 
             mime: 'application/pdf',
             isFallback: false 
         };
     } catch (e: any) {
         if (e.message === 'PDF_PROTECTED' || e.message.includes('Encrypted')) {
             setSaveMessage("Arquivo Protegido. Criando pacote .lect...");
             console.warn("PDF Protegido detectado. Ativando fallback para container Lectorium (.lect).");
             
             // Cria pacote .lect contendo o PDF original + Metadados
             const meta = {
                 annotations,
                 pageOffset: docPageOffset,
                 semanticData: lensData
             };
             
             const lectBlob = await packLectoriumFile('pdf_wrapper', meta, fileName, {}, sourceBlob);
             const lectName = fileName.replace(/\.pdf$/i, '') + MIME_TYPES.LECT_EXT;
             
             return { 
                 blob: lectBlob, 
                 name: lectName, 
                 mime: MIME_TYPES.LECTORIUM,
                 isFallback: true 
             };
         }
         throw e; // Repassa outros erros
     }
  };

  const handleDownload = async () => {
     const sourceBlob = currentBlobRef.current || originalBlob;
     if (!sourceBlob) return;
     
     setIsSaving(true);
     setSaveMessage("Consolidando inteligência...");
     setTechnicalError(null);
     
     try {
         const { blob, name } = await generateFinalBlob();
         const url = blobRegistry.register(URL.createObjectURL(blob));
         
         const a = document.createElement('a');
         a.href = url;
         a.download = name;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         
         setTimeout(() => blobRegistry.revoke(url), 10000);
         setSaveError(null);
     } catch (e: any) {
         console.error("Falha na exportação:", e);
         setTechnicalError(e.message || String(e));
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
    setSaveMessage("Processando e enviando...");
    setTechnicalError(null);
    
    try {
        const { blob, name, mime } = await generateFinalBlob();
        await uploadFileToDrive(accessToken, blob, name, [folderId], mime);
        setSaveError(null);
        setSuccessModal({ open: true, mode: 'upload' });
    } catch (e: any) {
        console.error(e);
        setTechnicalError(e.message || String(e));
        if (e.message?.includes('401')) setSaveError('auth');
        else if (e.message?.includes('403')) setSaveError('forbidden');
        else setSaveError('network');
    } finally {
        setIsSaving(false);
        setSaveMessage("");
    }
  }, [accessToken, annotations, currentBlobRef, originalBlob, ocrToBurn, docPageOffset, lensData, fileName, password]);

  const executeOfflineFallback = async (blob: Blob, name: string, mime: string, hash: string, mode: 'overwrite' | 'copy') => {
      const fileMeta = { id: fileId, name: name, mimeType: mime, parents: fileParents };
      
      await saveOfflineFile(fileMeta, blob);
      setIsOfflineAvailable(true);
      
      if (mode === 'overwrite') {
          await saveAuditRecord(fileId, hash, annotations.length);
      }

      await addToSyncQueue({
          fileId: mode === 'overwrite' ? fileId : `new-${Date.now()}`,
          action: mode === 'overwrite' ? 'update' : 'create',
          blob: blob,
          name: name,
          parents: fileParents,
          mimeType: mime
      });

      setHasUnsavedOcr(false);
      if (mode === 'overwrite') {
          onOcrSaved();
          onUpdateOriginalBlob(blob);
      }
      
      setSuccessModal({ open: true, mode: 'offline' });
  };

  const handleSave = async (mode: 'local' | 'overwrite' | 'copy' | 'drive_picker') => {
    const sourceBlob = currentBlobRef.current || originalBlob;
    if (!sourceBlob) return;
    if (isSaving) return;

    if (mode === 'drive_picker') return;

    setIsSaving(true);
    setSaveError(null);
    setTechnicalError(null);

    if (mode === 'local') {
        await handleDownload();
        return;
    }

    setSaveMessage("Sincronizando com a Nuvem...");

    try {
        const hasLock = await acquireFileLock(fileId);
        if (!hasLock && mode === 'overwrite') {
            setIsSaving(false);
            return;
        }

        // Gera o blob final (PDF ou .lect fallback)
        const { blob: newBlob, name: finalName, mime: finalMime, isFallback } = await generateFinalBlob();
        const newHash = await computeSparseHash(newBlob);
        
        // Se houve fallback para .lect, forçamos o modo 'copy' para não corromper o ID original do PDF
        // com um binário de tipo diferente, a menos que seja um arquivo local novo.
        const effectiveMode = isFallback && !fileId.startsWith('local-') ? 'copy' : mode;

        const isLocal = fileId.startsWith('local-') || fileId.startsWith('native-') || !fileId;

        if (!isLocal && !navigator.onLine && accessToken) {
            try {
                await executeOfflineFallback(newBlob, finalName, finalMime, newHash, effectiveMode);
            } catch (err: any) {
                console.error("Critical offline save error", err);
                setTechnicalError("Offline Fallback Failed: " + (err.message || String(err)));
                setSaveError('network');
            }
            return;
        }

        if (accessToken && !isLocal) {
            try {
                if (effectiveMode === 'overwrite') {
                    await updateDriveFile(accessToken, fileId, newBlob, finalMime);
                    onUpdateOriginalBlob(newBlob);
                    onOcrSaved();
                    await saveAuditRecord(fileId, newHash, annotations.length);
                    setHasUnsavedOcr(false);
                    setSuccessModal({ open: true, mode: 'overwrite' });
                } else {
                    await uploadFileToDrive(accessToken, newBlob, finalName, fileParents, finalMime);
                    setSuccessModal({ open: true, mode: 'upload' });
                }
                
                if (isFallback) {
                    alert("Aviso: O arquivo original é protegido. Suas alterações foram salvas num novo arquivo '.lect' (Lectorium Workspace) para manter suas anotações.");
                }

            } catch (e: any) {
                const msg = e.message?.toLowerCase() || "";
                if (msg.includes('401') || msg.includes('unauthorized')) {
                    setSaveError('auth');
                } else if (msg.includes('403') || msg.includes('permission')) {
                    setSaveError('forbidden');
                } else {
                    console.warn("[Saver] Falha de rede. Ativando fallback para SyncQueue.", e);
                    try {
                        await executeOfflineFallback(newBlob, finalName, finalMime, newHash, effectiveMode);
                        setSaveError(null);
                    } catch (fallbackErr: any) {
                        console.error("Fallback failed", fallbackErr);
                        setTechnicalError("Cloud & Offline Fallback Failed: " + (fallbackErr.message || String(fallbackErr)));
                        setSaveError('network');
                    }
                }
            }
        } else if (!accessToken && !isLocal) {
            setSaveError('auth');
        }
    } catch (e: any) {
        console.error("Global Save Error:", e);
        setTechnicalError(e.message || String(e));
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
    technicalError,
    setIsOfflineAvailable,
    successModal,
    closeSuccessModal: () => setSuccessModal(prev => ({ ...prev, open: false }))
  };
};

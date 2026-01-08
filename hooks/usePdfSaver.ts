
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
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isOfflineAvailable, setIsOfflineAvailable] = useState(false);

  // Janitor: Limpa blobs gerados ao desmontar o componente de visualização
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
     } catch (e) {
         console.error("Falha na exportação:", e);
         alert("Erro ao consolidar arquivo para download.");
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
        alert("Documento inteligente salvo com sucesso!");
    } catch (e: any) {
        console.error(e);
        alert("Erro ao realizar upload: " + e.message);
    } finally {
        setIsSaving(false);
        setSaveMessage("");
    }
  }, [accessToken, annotations, currentBlobRef, originalBlob, ocrToBurn, docPageOffset, lensData, fileName]);

  const handleSave = async (mode: 'local' | 'overwrite' | 'copy' | 'drive_picker') => {
    const sourceBlob = currentBlobRef.current || originalBlob;
    if (!sourceBlob) return;
    if (isSaving) return;

    if (mode === 'drive_picker') return;

    setIsSaving(true);
    setShowPermissionModal(false);

    if (mode === 'local') {
        await handleDownload();
        return;
    }

    setSaveMessage(mode === 'copy' ? "Criando Cópia Inteligente..." : "Sincronizando com a Nuvem...");

    try {
        const hasLock = await acquireFileLock(fileId);
        if (!hasLock && mode === 'overwrite') {
            alert("Sincronização em andamento. Aguarde um instante.");
            setIsSaving(false);
            return;
        }

        const newBlob = await burnAnnotationsToPdf(sourceBlob, annotations, ocrToBurn, docPageOffset, lensData);
        const newHash = await computeSparseHash(newBlob);
        
        const isLocal = fileId.startsWith('local-') || fileId.startsWith('native-') || !fileId;

        if (!isLocal && !navigator.onLine && accessToken) {
            const fileMeta = { id: fileId, name: fileName, mimeType: 'application/pdf', parents: fileParents };
            await saveOfflineFile(fileMeta, newBlob);
            setIsOfflineAvailable(true);
            await saveAuditRecord(fileId, newHash, annotations.length);
            await addToSyncQueue({
                fileId: mode === 'overwrite' ? fileId : `new-${Date.now()}`,
                action: mode === 'overwrite' ? 'update' : 'create',
                blob: newBlob,
                name: mode === 'overwrite' ? fileName : fileName.replace('.pdf', '') + ' (Anotado).pdf',
                parents: fileParents,
                mimeType: 'application/pdf'
            });
            setHasUnsavedOcr(false);
            if (mode === 'overwrite') {
                onOcrSaved();
                onUpdateOriginalBlob(newBlob);
            }
            return;
        }

        if (accessToken && !isLocal) {
            if (mode === 'overwrite') {
               try {
                  await updateDriveFile(accessToken, fileId, newBlob);
                  onUpdateOriginalBlob(newBlob);
                  onOcrSaved();
                  await saveAuditRecord(fileId, newHash, annotations.length);
                  setHasUnsavedOcr(false);
               } catch (e: any) {
                  if (e.message.includes('403') || e.message.includes('permission')) {
                     setShowPermissionModal(true);
                  } else {
                     throw e;
                  }
               }
            } else {
               const name = fileName.replace('.pdf', '') + ' (Anotado).pdf';
               await uploadFileToDrive(accessToken, newBlob, name, fileParents);
            }
        }
    } catch (e: any) {
        console.error(e);
        alert("Erro no pipeline de salvamento: " + e.message);
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
    showPermissionModal,
    setShowPermissionModal,
    setIsOfflineAvailable
  };
};

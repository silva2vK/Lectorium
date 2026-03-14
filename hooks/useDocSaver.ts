import { useState, useRef } from 'react';
import { Editor } from '@tiptap/react';
import JSZip from 'jszip';
import { updateDriveFile, uploadFileToDrive } from '../services/driveService';
import { 
  saveOfflineFile, addToSyncQueue, 
  acquireFileLock, releaseFileLock, saveDocVersion,
  cacheDocumentData
} from '../services/storageService';
import { generateDocxBlob } from '../services/docxService';
import { packLectoriumFile } from '../services/lectService';
import { MIME_TYPES, Reference } from '../types';
import { PageSettings } from '../components/doc/modals/PageSetupModal';
import { CommentData } from '../components/doc/CommentsSidebar';
import { getStoredUser } from '../services/authService';
import { useGlobalContext } from '../context/GlobalContext';

interface UseDocSaverProps {
  fileId: string;
  accessToken: string;
  isLocalFile: boolean;
  currentName: string;
  fileParents?: string[];
  onAuthError?: () => void;
}

export const useDocSaver = ({ fileId, accessToken, isLocalFile, currentName, fileParents = [], onAuthError }: UseDocSaverProps) => {
  const { addNotification } = useGlobalContext();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'error'>('saved');
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);
  const [originalZip, setOriginalZip] = useState<JSZip | undefined>(undefined);
  const [promotedDriveId, setPromotedDriveId] = useState<string | null>(null);
  const lastVersionTime = useRef(0);

  const save = async (editor: Editor, pageSettings?: PageSettings, comments?: CommentData[], references?: Reference[]) => {
      setIsSaving(true);
      
      const effectiveFileId = promotedDriveId || fileId;
      const isStillLocalId = effectiveFileId.startsWith('local-') || effectiveFileId.startsWith('new-');
      
      const isLect = currentName.endsWith(MIME_TYPES.LECT_EXT);
      let blob: Blob;
      let mimeType: string;
      let nameToSave: string;
      let jsonContent: any;
      
      try {
        jsonContent = editor.getJSON();
        
        if (isLect) {
            nameToSave = currentName;
            mimeType = MIME_TYPES.LECTORIUM;
            const lectData = { content: jsonContent, pageSettings, comments, references };
            const docxSnapshot = await generateDocxBlob(jsonContent, pageSettings, comments, references, originalZip);
            blob = await packLectoriumFile('document', lectData, nameToSave, {}, docxSnapshot);
        } else {
            nameToSave = currentName.endsWith('.docx') ? currentName : `${currentName}.docx`;
            mimeType = MIME_TYPES.DOCX;
            blob = await generateDocxBlob(jsonContent, pageSettings, comments, references, originalZip);
        }

      } catch (e) {
          console.error(e);
          addNotification("Erro crítico ao gerar arquivo.", "error");
          setIsSaving(false);
          setSaveStatus('error');
          return;
      }

      // Versioning snapshot a cada 5 minutos
      const now = Date.now();
      if (now - lastVersionTime.current > 5 * 60 * 1000) {
          const author = getStoredUser()?.displayName || 'Você';
          saveDocVersion(fileId, jsonContent, author, "Salvamento Automático").catch(e => console.warn("Failed to save version snapshot", e));
          lastVersionTime.current = now;
      }

      if (isLocalFile && !accessToken && navigator.onLine) {
          await saveOfflineFile({ id: fileId, name: nameToSave, mimeType: mimeType, parents: fileParents }, blob);
          setSaveStatus('saved');
          setIsSaving(false);
          return;
      }

      let lockAcquired = await acquireFileLock(effectiveFileId);
      if (!lockAcquired) {
          await new Promise(r => setTimeout(r, 500));
          lockAcquired = await acquireFileLock(effectiveFileId);
      }

      if (!lockAcquired) {
          console.warn("[Saver] Arquivo está sendo sincronizado em segundo plano. Aguarde um instante.");
          setIsSaving(false);
          return;
      }

      try {
          try {
              await cacheDocumentData(fileId, {
                  content: jsonContent,
                  contentType: 'json',
                  settings: pageSettings,
                  comments: comments,
                  references: references
              });
          } catch (e) {}

          if (!navigator.onLine) {
              try {
                  await saveOfflineFile({ id: effectiveFileId, name: nameToSave, mimeType: mimeType, parents: fileParents }, blob);
                  const action = isStillLocalId ? 'create' : 'update';
                  await addToSyncQueue({ 
                      fileId: effectiveFileId, 
                      action: action, 
                      blob: blob, 
                      name: nameToSave, 
                      mimeType: mimeType, 
                      parents: fileParents 
                  });
                  setSaveStatus('saved');
                  setIsOfflineSaved(true);
              } catch (e) {
                  console.error("Offline save failed", e);
                  setSaveStatus('error');
              }
              return;
          }

          if (accessToken) {
              try {
                  if (isStillLocalId) {
                      const result = await uploadFileToDrive(accessToken, blob, nameToSave, fileParents, mimeType);
                      setPromotedDriveId(result.id);
                      await saveOfflineFile({ id: result.id, name: nameToSave, mimeType, parents: fileParents }, blob);
                      setSaveStatus('saved');
                      setIsOfflineSaved(false);
                  } else {
                      await updateDriveFile(accessToken, effectiveFileId, blob, mimeType);
                      setSaveStatus('saved');
                      setIsOfflineSaved(false);
                  }
              } catch (e: any) {
                  console.error("Drive save failed", e);
                  if (e.message !== "Unauthorized") {
                      try {
                          await saveOfflineFile({ id: effectiveFileId, name: nameToSave, mimeType: mimeType, parents: fileParents }, blob);
                          const action = isStillLocalId ? 'create' : 'update';
                          await addToSyncQueue({ fileId: effectiveFileId, action, blob, name: nameToSave, mimeType, parents: fileParents });
                          setSaveStatus('saved');
                          setIsOfflineSaved(true);
                      } catch (offlineErr) {
                          setSaveStatus('error');
                      }
                  } else {
                      setSaveStatus('error');
                      if (onAuthError) onAuthError();
                  }
              }
          }
      } finally {
          await releaseFileLock(effectiveFileId);
          setIsSaving(false);
      }
  };

  const downloadDocx = async (editor: Editor, pageSettings?: PageSettings, comments?: CommentData[], references?: Reference[]) => {
      setIsSaving(true);
      try {
          const jsonContent = editor.getJSON();
          const nameToSave = currentName.endsWith('.docx') ? currentName : `${currentName}.docx`;
          const blob = await generateDocxBlob(jsonContent, pageSettings, comments, references, originalZip);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = nameToSave;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setSaveStatus('saved');
      } catch (e) {
          console.error("Download failed", e);
          addNotification("Erro ao gerar o arquivo DOCX.", "error");
          setSaveStatus('error');
      } finally {
          setIsSaving(false);
      }
  };

  const saveAsLect = async (editor: Editor, pageSettings?: PageSettings, comments?: CommentData[]) => {
      setIsSaving(true);
      const jsonContent = editor.getJSON();
      const lectData = { content: jsonContent, pageSettings, comments };
      const lectName = currentName.replace('.docx', '') + MIME_TYPES.LECT_EXT;

      try {
          const docxSnapshot = await generateDocxBlob(jsonContent, pageSettings, comments, [], originalZip);
          const blob = await packLectoriumFile('document', lectData, currentName, {}, docxSnapshot);

          if ((isLocalFile && !promotedDriveId) || !navigator.onLine || !accessToken) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = lectName;
              document.body.appendChild(a);
              a.click();
              URL.revokeObjectURL(url);
              document.body.removeChild(a);
          } else {
              await uploadFileToDrive(
                  accessToken, 
                  blob, 
                  lectName, 
                  fileParents && fileParents.length > 0 ? fileParents : [], 
                  MIME_TYPES.LECTORIUM
              );
              addNotification("Arquivo Lectorium (.lect) salvo no Drive com sucesso!\nSalvo na mesma pasta do arquivo original.", "success");
          }
      } catch (e) {
          console.error("Failed to save .lect", e);
          addNotification("Erro ao salvar formato Lectorium.", "error");
      } finally {
          setIsSaving(false);
      }
  };

  return {
    save,
    downloadDocx,
    saveAsLect,
    isSaving,
    saveStatus,
    setSaveStatus,
    isOfflineSaved,
    setOriginalZip,
    originalZip
  };
};

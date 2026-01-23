
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
import { auth } from '../firebase';

interface UseDocSaverProps {
  fileId: string;
  accessToken: string;
  isLocalFile: boolean;
  currentName: string;
  fileParents?: string[]; // Novo: Recebe a lista de pais
  onAuthError?: () => void;
}

export const useDocSaver = ({ fileId, accessToken, isLocalFile, currentName, fileParents = [], onAuthError }: UseDocSaverProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'error'>('saved');
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);
  const [originalZip, setOriginalZip] = useState<JSZip | undefined>(undefined);
  
  // Rastreia o ID real do Drive caso um arquivo local seja promovido para a nuvem nesta sessão
  const [promotedDriveId, setPromotedDriveId] = useState<string | null>(null);
  
  // Rate limit para versões (evita criar versão a cada auto-save de 3s)
  const lastVersionTime = useRef(0);

  const save = async (editor: Editor, pageSettings?: PageSettings, comments?: CommentData[], references?: Reference[]) => {
      setIsSaving(true);
      
      // Determina o ID efetivo (se já foi salvo no Drive nesta sessão, usa o novo ID)
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
            // Se for .lect, salvamos como container Lectorium
            nameToSave = currentName;
            mimeType = MIME_TYPES.LECTORIUM;
            
            // 1. Dados estruturados (Source of Truth)
            const lectData = { content: jsonContent, pageSettings, comments, references };
            
            // 2. Backup DOCX (Compatibilidade)
            const docxSnapshot = await generateDocxBlob(jsonContent, pageSettings, comments, references, originalZip);
            
            // 3. Pack
            blob = await packLectoriumFile('document', lectData, nameToSave, {}, docxSnapshot);
        } else {
            // Padrão DOCX
            nameToSave = currentName.endsWith('.docx') ? currentName : `${currentName}.docx`;
            mimeType = MIME_TYPES.DOCX;
            blob = await generateDocxBlob(jsonContent, pageSettings, comments, references, originalZip);
        }

      } catch (e) {
          console.error(e);
          alert("Erro crítico ao gerar arquivo.");
          setIsSaving(false);
          setSaveStatus('error');
          return;
      }

      // --- VERSIONING SNAPSHOT ---
      // Salva uma versão se passaram-se mais de 5 minutos desde a última ou se é a primeira
      const now = Date.now();
      if (now - lastVersionTime.current > 5 * 60 * 1000) {
          const author = auth.currentUser?.displayName || 'Você';
          // Fire and forget, não bloqueia o save principal
          // Nota: Salvamos versões locais com o ID original para manter histórico consistente na sessão
          saveDocVersion(fileId, jsonContent, author, "Salvamento Automático").catch(e => console.warn("Failed to save version snapshot", e));
          lastVersionTime.current = now;
      }

      // Caso 0: Usuário deslogado e online (Modo Visitante estrito)
      // Se não tem token e tem internet, não podemos salvar na nuvem.
      // Apenas baixa se for solicitado explicitamente (o que não acontece nesta função save, que é autosave/ctrl+s)
      if (isLocalFile && !accessToken && navigator.onLine) {
          // Apenas salva no IDB local para não perder dados se fechar a aba
          await saveOfflineFile({ id: fileId, name: nameToSave, mimeType: mimeType, parents: fileParents }, blob);
          setSaveStatus('saved');
          setIsSaving(false);
          return;
      }

      // Tenta adquirir o Lock para evitar conflito com background sync
      let lockAcquired = await acquireFileLock(effectiveFileId);
      if (!lockAcquired) {
          // Retry simples
          await new Promise(r => setTimeout(r, 500));
          lockAcquired = await acquireFileLock(effectiveFileId);
      }

      if (!lockAcquired) {
          console.warn("[Saver] Arquivo está sendo sincronizado em segundo plano. Aguarde um instante.");
          setIsSaving(false);
          return;
      }

      try {
          // Atualiza cache de renderização (Documento para reabertura rápida)
          try {
              await cacheDocumentData(fileId, { // Mantém ID original no cache de sessão
                  content: jsonContent,
                  contentType: 'json',
                  settings: pageSettings,
                  comments: comments,
                  references: references
              });
          } catch (e) {}

          // Caso 2: Sem Internet -> Offline Mode
          if (!navigator.onLine) {
              try {
                  // Salva o blob localmente
                  await saveOfflineFile({ id: effectiveFileId, name: nameToSave, mimeType: mimeType, parents: fileParents }, blob);
                  
                  // Enfileira para sync
                  // Se o ID ainda é local (local-...), a ação é 'create'. Se já foi promovido ou é do drive, é 'update'.
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

          // Caso 3: Online -> Drive (Com ou sem Token)
          if (accessToken) {
              try {
                  if (isStillLocalId) {
                      // CRIAÇÃO (Upload Inicial)
                      // O arquivo é local mas estamos online e logados. Promove para o Drive.
                      const result = await uploadFileToDrive(accessToken, blob, nameToSave, fileParents, mimeType);
                      
                      // Importante: Guardamos o novo ID para que o próximo save seja um UPDATE
                      setPromotedDriveId(result.id);
                      
                      // Também atualizamos o arquivo offline com o novo ID para consistência futura
                      // (Isso cria uma duplicata temporária no IDB com o ID novo, o que é bom para cache)
                      await saveOfflineFile({ id: result.id, name: nameToSave, mimeType, parents: fileParents }, blob);
                      
                      setSaveStatus('saved');
                      setIsOfflineSaved(false);
                  } else {
                      // ATUALIZAÇÃO (Patch)
                      await updateDriveFile(accessToken, effectiveFileId, blob, mimeType);
                      setSaveStatus('saved');
                      setIsOfflineSaved(false);
                  }
              } catch (e: any) {
                  console.error("Drive save failed", e);
                  // Fallback para offline se falhar (ex: token expirado momentaneamente ou erro de rede 5xx)
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

  /**
   * Força o download do DOCX gerado (Exportação)
   */
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
          alert("Erro ao gerar o arquivo DOCX.");
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

          const blob = await packLectoriumFile(
              'document', 
              lectData, 
              currentName, 
              {}, 
              docxSnapshot 
          );

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
              alert("Arquivo Lectorium (.lect) salvo no Drive com sucesso!\nSalvo na mesma pasta do arquivo original.");
          }
      } catch (e) {
          console.error("Failed to save .lect", e);
          alert("Erro ao salvar formato Lectorium.");
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

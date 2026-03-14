import React, { useState, useCallback, useMemo, lazy } from 'react';
import { flushSync } from 'react-dom';
import { DriveFile, MIME_TYPES } from '../types';
import { getOfflineFile, saveOfflineFile, addRecentFile } from '../services/storageService';
import { downloadDriveFile, renameDriveFile } from '../services/driveService';
import { generateMindMapAi } from '../services/aiService';
import { getValidDriveToken } from '../services/authService';

const PdfViewer = lazy(() => import('../components/PdfViewer').then(m => ({ default: m.PdfViewer })));
const MindMapEditor = lazy(() => import('../components/MindMapEditor').then(m => ({ default: m.MindMapEditor })));
const DocEditor = lazy(() => import('../components/DocEditor').then(m => ({ default: m.DocEditor })));
const UniversalMediaAdapter = lazy(() => import('../components/UniversalMediaAdapter').then(m => ({ default: m.UniversalMediaAdapter })));
const LectAdapter = lazy(() => import('../components/LectAdapter').then(m => ({ default: m.LectAdapter })));

const GlobalLoader = () => (
  <div className="flex-1 flex flex-col items-center justify-center bg-bg min-h-[300px]">
    <div className="relative mb-4">
        <div className="absolute inset-0 bg-brand/20 rounded-full blur-xl animate-pulse"></div>
        <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin relative z-10" />
    </div>
    <p className="text-sm font-medium text-text-sec animate-pulse tracking-wide uppercase">Carregando Workspace...</p>
  </div>
);

interface UseFileManagerParams {
  accessToken: string | null;
  uid: string;
  isOcrRunning: boolean;
  addNotification: (message: string, type: 'success'|'error'|'info') => void;
  onAuthError: () => void;
  onCloseMenu: () => void;
  commonProps: {
    accessToken: string;
    uid: string;
    onBack: () => void;
    onAuthError: () => void;
    onToggleMenu: () => void;
    onToggleSplitView: () => void;
  };
}

export function useFileManager({
  accessToken,
  uid,
  isOcrRunning,
  addNotification,
  onAuthError,
  onCloseMenu,
  commonProps
}: UseFileManagerParams) {
  const [openFiles, setOpenFiles] = useState<DriveFile[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [secondaryTab, setSecondaryTab] = useState<string | null>(null);
  const [transitionId, setTransitionId] = useState<string | null>(null);
  const [aiLoadingMessage, setAiLoadingMessage] = useState<string | null>(null);

  const handleOpenFile = useCallback(async (file: DriveFile, background: boolean = false) => {
    if (isOcrRunning && openFiles.length >= 1) {
        addNotification("Processamento em segundo plano ativo. Limite de 1 aba aberta para estabilidade.", "error");
        return;
    }

    if (!background) {
        flushSync(() => { setTransitionId(file.id); });
    }

    if (!file.blob && !file.id.startsWith('local-') && !file.id.startsWith('native-')) {
        const cached = await getOfflineFile(file.id);
        if (cached) {
            file.blob = cached;
        } else if (navigator.onLine) {
            // FIX: accessToken pode chegar como '' (App.tsx passa accessToken || '')
            // '' é falsy mas não é null — verificação explícita evita ambiguidade futura
            const token = (accessToken && accessToken.length > 0) ? accessToken : getValidDriveToken();
            if (!token) { onAuthError(); return; }
            try { 
                const blob = await downloadDriveFile(token, file.id, file.mimeType); 
                const syncStrategy = localStorage.getItem('sync_strategy') || 'smart';
                if (syncStrategy === 'smart') await saveOfflineFile(file, blob); 
                file.blob = blob; 
            } catch (e: any) { 
                if (e.message.includes('401') || e.message.includes('DRIVE_TOKEN_EXPIRED')) {
                    onAuthError();
                    return;
                }
                addNotification("Erro ao baixar arquivo.", "error"); 
                return; 
            }
        }
    }

    if (file.id.startsWith('native-') && file.handle && !file.blob) { 
        try { file.blob = await (file.handle as FileSystemFileHandle).getFile(); } 
        catch (e) { addNotification("Erro ao ler arquivo local.", "error"); return; } 
    }

    addRecentFile(file);
    
    if (!background && document.startViewTransition) {
        document.startViewTransition(() => {
            flushSync(() => {
                setOpenFiles(prev => prev.find(f => f.id === file.id) ? prev : [...prev, file]);
                setActiveTab(file.id);
                onCloseMenu();
            });
        });
    } else {
        setOpenFiles(prev => prev.find(f => f.id === file.id) ? prev : [...prev, file]);
        if (!background) {
            setActiveTab(file.id);
            onCloseMenu();
        } else {
            addNotification(`"${file.name}" aberto em segundo plano.`, 'success');
        }
    }
  }, [accessToken, isOcrRunning, openFiles.length, addNotification, onAuthError, onCloseMenu]);

  const handleCreateMindMap = useCallback((parentId?: string) => {
    const fileId = `local-mindmap-${Date.now()}`;
    const emptyMap = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
    const blob = new Blob([JSON.stringify(emptyMap)], { type: 'application/json' });
    handleOpenFile({ id: fileId, name: 'Novo Mapa Mental.mindmap', mimeType: 'application/json', blob, parents: parentId ? [parentId] : [] });
  }, [handleOpenFile]);

  const handleGenerateMindMapWithAi = useCallback(async (topic: string) => {
    setAiLoadingMessage(`Pesquisando sobre "${topic}"...`);
    try {
        const data = await generateMindMapAi(topic);
        const fileId = `local-mindmap-ai-${Date.now()}`;
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        handleOpenFile({ id: fileId, name: `${topic.slice(0, 20)}.mindmap`, mimeType: 'application/json', blob });
    } catch (e: any) {
        addNotification(e.message || "Erro ao gerar mapa com IA.", "error");
    } finally {
        setAiLoadingMessage(null);
    }
  }, [handleOpenFile, addNotification]);

  const handleCreateDocument = useCallback((parentId?: string) => {
    const fileId = `local-doc-${Date.now()}`;
    const blob = new Blob([''], { type: MIME_TYPES.DOCX });
    handleOpenFile({ id: fileId, name: 'Novo Documento.docx', mimeType: MIME_TYPES.DOCX, blob, parents: parentId ? [parentId] : [] });
  }, [handleOpenFile]);

  const handleCreateFileFromBlob = useCallback((blob: Blob, name: string, mimeType: string) => { 
      handleOpenFile({ id: `local-${Date.now()}`, name, mimeType, blob }); 
  }, [handleOpenFile]);

  const handleCloseFile = useCallback((id: string) => {
    setOpenFiles(prev => { 
        const next = prev.filter(f => f.id !== id); 
        if (activeTab === id) setActiveTab(next.length ? next[next.length - 1].id : 'dashboard'); 
        return next; 
    });
  }, [activeTab]);

  const handleReturnToDashboard = () => {
      setTransitionId(null); 
      if (document.startViewTransition) {
          document.startViewTransition(() => { flushSync(() => { setActiveTab('dashboard'); }); });
      } else {
          setActiveTab('dashboard');
      }
  };

  const handleRenameActiveFile = async (fileId: string, newName: string) => {
      if (!accessToken && !fileId.startsWith('local-')) return;
      const isLocal = fileId.startsWith('local-') || fileId.startsWith('native-');
      const originalFile = openFiles.find(f => f.id === fileId);
      const ext = originalFile?.name.includes('.') ? '.' + originalFile.name.split('.').pop() : '';
      const safeName = newName.endsWith(ext) ? newName : `${newName}${ext}`;
      try {
          if (!isLocal) await renameDriveFile(accessToken!, fileId, safeName);
          setOpenFiles(prev => prev.map(f => f.id === fileId ? { ...f, name: safeName } : f));
          addNotification("Arquivo renomeado.", "success");
      } catch (e) {
          console.error("Rename failed", e);
          addNotification("Erro ao renomear.", "error");
      }
  };

  const renderFileContent = useCallback((fileId: string) => {
    const file = openFiles.find(f => f.id === fileId);
    if (!file) return <GlobalLoader />;
    
    if (file.name.endsWith('.lect') || file.mimeType === MIME_TYPES.LECTORIUM)
        return <LectAdapter key={file.id} {...commonProps} file={file} />;
    
    if (file.name.endsWith('.mindmap') || file.name.endsWith('.json') || file.mimeType === MIME_TYPES.MINDMAP || file.mimeType === 'application/json')
        return <MindMapEditor key={file.id} {...commonProps} fileId={file.id} fileName={file.name} fileBlob={file.blob} onRename={(newName) => handleRenameActiveFile(file.id, newName)} />;

    if (file.name.endsWith('.docx') || file.mimeType === MIME_TYPES.DOCX || file.mimeType === MIME_TYPES.GOOGLE_DOC)
        return <DocEditor key={file.id} {...commonProps} fileId={file.id} fileName={file.name} fileBlob={file.blob} fileParents={file.parents} />;

    if (file.mimeType.startsWith('image/') || file.mimeType === 'application/dicom' || file.mimeType.startsWith('text/') || file.name.endsWith('.cbz'))
        return <UniversalMediaAdapter key={file.id} {...commonProps} file={file} onToggleNavigation={commonProps.onToggleMenu} />;
    
    return <PdfViewer key={file.id} {...commonProps} fileId={file.id} fileName={file.name} fileBlob={file.blob} fileParents={file.parents} onRename={(newName) => handleRenameActiveFile(file.id, newName)} />;
  }, [openFiles, commonProps, handleRenameActiveFile]);

  return {
    openFiles, activeTab, setActiveTab,
    isSplitMode, setIsSplitMode,
    secondaryTab, setSecondaryTab,
    transitionId, aiLoadingMessage,
    handleOpenFile, handleCloseFile,
    handleCreateMindMap, handleCreateDocument,
    handleCreateFileFromBlob, handleGenerateMindMapWithAi,
    handleRenameActiveFile, handleReturnToDashboard,
    renderFileContent,
  };
}

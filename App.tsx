
import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { signInWithGoogleDrive, logout, saveDriveToken, getValidDriveToken, DRIVE_TOKEN_EVENT, checkRedirectResult } from './services/authService';
import { 
  addRecentFile, performAppUpdateCleanup, runJanitor, saveOfflineFile, 
  getOfflineFile, getLocalDirectoryHandle, saveLocalDirectoryHandle 
} from './services/storageService';
import { downloadDriveFile, renameDriveFile } from './services/driveService';
import { openDirectoryPicker, verifyPermission } from './services/localFileService';
import { useSync } from './hooks/useSync';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CookieConsent } from './components/CookieConsent';
import { DriveFile, MIME_TYPES } from './types';
import { Loader2, Wifi, Sparkles, X, CheckCircle, AlertTriangle, ScanLine, Maximize, Monitor } from 'lucide-react';
import ReauthToast from './components/ReauthToast';
import { LegalModal, LegalTab } from './components/modals/LegalModal';
import { generateMindMapAi } from './services/aiService';
import { GlobalProvider, useGlobalContext } from './context/GlobalContext';
import { OcrCompletionModal } from './components/modals/OcrCompletionModal';
import { SecretThemeModal } from './components/SecretThemeModal';
import { flushSync } from 'react-dom';
import { GlobalHelpModal } from './components/GlobalHelpModal';

const DriveBrowser = lazy(() => import('./components/DriveBrowser').then(m => ({ default: m.DriveBrowser })));
const PdfViewer = lazy(() => import('./components/PdfViewer').then(m => ({ default: m.PdfViewer })));
const MindMapEditor = lazy(() => import('./components/MindMapEditor').then(m => ({ default: m.MindMapEditor })));
const DocEditor = lazy(() => import('./components/DocEditor').then(m => ({ default: m.DocEditor })));
const UniversalMediaAdapter = lazy(() => import('./components/UniversalMediaAdapter').then(m => ({ default: m.UniversalMediaAdapter })));
const LectAdapter = lazy(() => import('./components/LectAdapter').then(m => ({ default: m.LectAdapter })));

const GlobalLoader = () => (
  <div className="flex-1 flex flex-col items-center justify-center bg-bg min-h-[300px]">
    <div className="relative mb-4">
        <div className="absolute inset-0 bg-brand/20 rounded-full blur-xl animate-pulse"></div>
        <Loader2 size={48} className="animate-spin text-brand relative z-10" />
    </div>
    <p className="text-sm font-medium text-text-sec animate-pulse tracking-wide uppercase">Carregando Workspace...</p>
  </div>
);

const GlobalToastContainer = () => {
    const { notifications, removeNotification, isOcrRunning, ocrProgress, ocrStatusMessage } = useGlobalContext();

    return (
        <div className="fixed top-6 right-6 z-[150] flex flex-col gap-2 pointer-events-none">
            {isOcrRunning && ocrProgress && (
                <div className="bg-[#1e1e1e] border border-brand/30 p-3 rounded-xl shadow-2xl flex items-center gap-3 w-80 animate-in slide-in-from-right pointer-events-auto">
                    <Loader2 size={20} className="text-brand animate-spin shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate mb-0.5">
                            {ocrStatusMessage || `Processando: ${ocrProgress.filename}`}
                        </p>
                        <div className="w-full bg-white/10 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div 
                                className="h-full bg-brand transition-all duration-500" 
                                style={{ width: `${(ocrProgress.current / ocrProgress.total) * 100}%` }}
                            />
                        </div>
                        <p className="text-[9px] text-text-sec mt-1 text-right">
                            Página {ocrProgress.current} de {ocrProgress.total}
                        </p>
                    </div>
                </div>
            )}

            {notifications.map(n => (
                <div 
                    key={n.id} 
                    className={`
                        p-3 rounded-xl shadow-2xl flex items-center gap-3 w-80 animate-in slide-in-from-right pointer-events-auto border
                        ${n.type === 'error' ? 'bg-red-950/90 border-red-500/30 text-red-200' : 
                          n.type === 'success' ? 'bg-green-950/90 border-green-500/30 text-green-200' : 
                          'bg-[#1e1e1e]/90 border-white/10 text-white'}
                    `}
                >
                    <div className="shrink-0">
                        {n.type === 'error' ? <AlertTriangle size={18} /> : 
                         n.type === 'success' ? <CheckCircle size={18} /> : 
                         <ScanLine size={18} />}
                    </div>
                    <p className="text-xs font-medium leading-relaxed">{n.message}</p>
                    <button onClick={() => removeNotification(n.id)} className="ml-auto hover:bg-white/10 p-1 rounded">
                        <X size={14} />
                    </button>
                </div>
            ))}
        </div>
    );
};

const AppContent = () => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => getValidDriveToken());
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [openFiles, setOpenFiles] = useState<DriveFile[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [storageMode, setStorageMode] = useState<any>('local');
  const [syncStrategy, setSyncStrategy] = useState<'smart' | 'online'>(() => (localStorage.getItem('sync_strategy') as 'smart' | 'online') || 'smart');
  const [localDirHandle, setLocalDirHandle] = useState<any>(null);
  const [savedLocalDirHandle, setSavedLocalDirHandle] = useState<any>(null);
  const [showReauthToast, setShowReauthToast] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalTab>('privacy');
  const [aiLoadingMessage, setAiLoadingMessage] = useState<string | null>(null);
  const [isImmersive, setIsImmersive] = useState(false);
  
  // Onboarding State
  const [onboardingStep, setOnboardingStep] = useState<'none' | 'legal' | 'guide'>('none');
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Fullscreen Prompt State
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);

  // Split View State
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [secondaryTab, setSecondaryTab] = useState<string | null>(null);

  const [transitionId, setTransitionId] = useState<string | null>(null);
  const [showSecretThemeModal, setShowSecretThemeModal] = useState(false);
  const { isOcrRunning, addNotification } = useGlobalContext();

  // --- WAKE LOCK API (Keep Screen On) ---
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.debug('[Lectorium] Wake Lock active (Screen On)');
        } catch (err: any) {
          console.warn('[Lectorium] Wake Lock denied:', err.message);
        }
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) wakeLock.release();
    };
  }, []);

  const handleAuthError = useCallback(() => {
      setAccessToken(null);
      setShowReauthToast(true);
  }, []);

  const handleToggleSyncStrategy = useCallback((strategy: 'smart' | 'online') => { setSyncStrategy(strategy); localStorage.setItem('sync_strategy', strategy); }, []);

  const handleLogin = useCallback(async () => {
    try {
      const result = await signInWithGoogleDrive();
      // Se result for null (no caso de Redirect flow), não faz nada ainda
      if (result && result.accessToken) { 
          saveDriveToken(result.accessToken); 
          setAccessToken(result.accessToken); 
          setShowReauthToast(false); 
      }
    } catch (e) { alert("Não foi possível conectar ao Google Drive."); }
  }, []);

  const handleReauth = useCallback(async () => {
    try { 
        const result = await signInWithGoogleDrive(); 
        if (result && result.accessToken) { 
            saveDriveToken(result.accessToken); 
            setAccessToken(result.accessToken); 
            setShowReauthToast(false); 
        } 
    } catch (error) { console.error("Falha na reconexão:", error); }
  }, []);

  const { syncStatus } = useSync({ accessToken, onAuthError: handleAuthError });

  // Onboarding Checks
  const checkOnboarding = useCallback(() => {
      const legalAccepted = localStorage.getItem('legal_terms_accepted_v1');
      const guideSeen = localStorage.getItem('onboarding_guide_seen');
      const cookiesAccepted = localStorage.getItem('cookie_consent_accepted');

      if (!cookiesAccepted) {
          // Cookie component handles itself
          return;
      }

      if (!legalAccepted) {
          setOnboardingStep('legal');
          setShowLegalModal(true);
          return;
      }

      if (!guideSeen) {
          setOnboardingStep('guide');
          setShowGuideModal(true);
          return;
      }

      setOnboardingStep('none');
  }, []);

  // Init & Theme Application
  useEffect(() => {
    const init = async () => {
        const params = new URLSearchParams(window.location.search);
        
        // Deep Link: Suporte a links diretos para Termos/Privacidade
        const legalParam = params.get('legal');
        if (legalParam === 'privacy' || legalParam === 'terms') {
            setLegalModalTab(legalParam as LegalTab);
            setShowLegalModal(true);
            window.history.replaceState({}, document.title, "/");
        }

        if (params.get('protocol') === 'genesis') {
            setShowSecretThemeModal(true);
            window.history.replaceState({}, document.title, "/");
        }

        // TENTA RECUPERAR RESULTADO DE REDIRECIONAMENTO (MOBILE AUTH)
        await checkRedirectResult();

        const root = document.documentElement;
        const godModeTheme = localStorage.getItem('god_mode_theme');
        
        if (godModeTheme) {
            try {
                const parsed = JSON.parse(godModeTheme);
                if (parsed.vars) {
                    Object.entries(parsed.vars).forEach(([key, value]) => {
                        root.style.setProperty(key, value as string);
                    });
                    root.classList.add('custom');
                }
            } catch (e) { console.warn("Erro ao carregar tema secreto"); }
        } else {
            const savedTheme = localStorage.getItem('app-theme') || 'forest';
            const customColor = localStorage.getItem('custom-theme-brand');
            
            // Limpa classes antes de aplicar
            root.className = ''; 
            if (savedTheme !== 'forest') {
                root.classList.add(savedTheme);
                if (savedTheme === 'custom' && customColor) {
                    root.style.setProperty('--custom-brand', customColor);
                }
            }
        }

        await performAppUpdateCleanup();
        await runJanitor(); 
        const storedHandle = await getLocalDirectoryHandle();
        if (storedHandle) setSavedLocalDirHandle(storedHandle);

        checkOnboarding();

        // Check Fullscreen Preference
        const fsPref = localStorage.getItem('fullscreen_pref');
        if (fsPref === 'true' && !document.fullscreenElement) {
            setTimeout(() => setShowFullscreenPrompt(true), 1000);
        }
    };
    init();
    
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) { setAccessToken(null); setOpenFiles([]); setActiveTab('dashboard'); } 
      else { const storedToken = getValidDriveToken(); if (storedToken) setAccessToken(storedToken); }
    });

    const handleTokenUpdate = (e: Event) => {
        const customEvent = e as CustomEvent;
        if (customEvent.detail && customEvent.detail.token) {
            setAccessToken(customEvent.detail.token);
            setShowReauthToast(false);
        }
    };
    window.addEventListener(DRIVE_TOKEN_EVENT, handleTokenUpdate);

    const handleKalakiAction = (e: Event) => {
        const { name, args } = (e as CustomEvent).detail;
        switch (name) {
            case 'open_file':
                handleOpenFile({ id: args.fileId, name: args.fileName || 'Arquivo solicitado', mimeType: '' });
                break;
            case 'search_drive':
                setActiveTab('browser');
                // A busca será tratada pelo componente DriveBrowser se integrarmos o estado
                break;
            case 'create_structure':
                if (args.type === 'mindmap') handleCreateMindMap();
                else handleCreateDocument();
                break;
        }
    };
    window.addEventListener('kalaki-action', handleKalakiAction);

    return () => {
        unsubscribeAuth();
        window.removeEventListener(DRIVE_TOKEN_EVENT, handleTokenUpdate);
        window.removeEventListener('kalaki-action', handleKalakiAction);
    };
  }, [checkOnboarding, handleOpenFile, handleCreateMindMap, handleCreateDocument]);

  const handleCookieAccepted = () => {
      // Quando cookie é aceito, dispara verificação dos próximos passos
      checkOnboarding();
  };

  const handleLegalAccepted = () => {
      localStorage.setItem('legal_terms_accepted_v1', 'true');
      setShowLegalModal(false);
      checkOnboarding(); // Verifica próximo passo (Guia)
  };

  const handleGuideCompleted = () => {
      localStorage.setItem('onboarding_guide_seen', 'true');
      setShowGuideModal(false);
      checkOnboarding();
  };

  // Modificado: Aceita um handle manual (Virtual)
  const handleOpenLocalFolder = useCallback(async (manualHandle?: any) => {
    // Se recebermos um handle manual (do input padrão), usamos ele diretamente
    if (manualHandle) {
        setLocalDirHandle(manualHandle);
        setSavedLocalDirHandle(null); // Handles virtuais não são persistidos
        setActiveTab('local-fs');
        return;
    }

    // Caso contrário, tenta a API Nativa
    try { 
        const handle = await openDirectoryPicker(); 
        if (handle) { 
            setLocalDirHandle(handle); 
            setSavedLocalDirHandle(handle); 
            await saveLocalDirectoryHandle(handle); 
            setActiveTab('local-fs'); 
        } 
    } catch (e: any) { 
        if (e.name !== 'AbortError') alert(e.message); 
    }
  }, []);

  const handleReconnectLocalFolder = useCallback(async () => {
      if (!savedLocalDirHandle) return;
      try { const granted = await verifyPermission(savedLocalDirHandle, true); if (granted) { setLocalDirHandle(savedLocalDirHandle); setActiveTab('local-fs'); } else { alert("Acesso negado."); setSavedLocalDirHandle(null); } } catch (e) { handleOpenLocalFolder(); }
  }, [savedLocalDirHandle, handleOpenLocalFolder]);

  const handleOpenFile = useCallback(async (file: DriveFile, background: boolean = false) => {
    if (isOcrRunning && openFiles.length >= 1) {
        addNotification("Processamento em segundo plano ativo. Limite de 1 aba aberta para estabilidade.", "error");
        return;
    }

    if (!background) {
        flushSync(() => {
            setTransitionId(file.id);
        });
    }

    if (!file.blob && !file.id.startsWith('local-') && !file.id.startsWith('native-')) {
        const cached = await getOfflineFile(file.id);
        if (cached) file.blob = cached; else if (navigator.onLine) {
            if (!accessToken) { const valid = getValidDriveToken(); if (!valid) { setShowReauthToast(true); return; } setAccessToken(valid); }
            try { const blob = await downloadDriveFile(accessToken || '', file.id, file.mimeType); if (syncStrategy === 'smart') await saveOfflineFile(file, blob); file.blob = blob; } catch (e: any) { if (e.message.includes('401')) { setShowReauthToast(true); return; } alert("Erro ao baixar arquivo."); return; }
        }
    }
    if (file.id.startsWith('native-') && file.handle && !file.blob) { try { file.blob = await file.handle.getFile(); } catch (e) { alert("Erro ao ler arquivo local."); return; } }
    addRecentFile(file);
    
    if (!background && document.startViewTransition) {
        document.startViewTransition(() => {
            flushSync(() => {
                setOpenFiles(prev => prev.find(f => f.id === file.id) ? prev : [...prev, file]);
                setActiveTab(file.id);
                setIsSidebarOpen(false);
            });
        });
    } else {
        setOpenFiles(prev => prev.find(f => f.id === file.id) ? prev : [...prev, file]);
        if (!background) {
            setActiveTab(file.id);
            setIsSidebarOpen(false);
        } else {
            addNotification(`"${file.name}" aberto em segundo plano.`, 'success');
        }
    }
  }, [accessToken, syncStrategy, isOcrRunning, openFiles.length, addNotification]);

  useEffect(() => {
      const handler = (e: Event) => {
          const detail = (e as CustomEvent).detail;
          if (detail && detail.fileId) {
              handleOpenFile({
                  id: detail.fileId,
                  name: detail.filename || "Documento Analisado",
                  mimeType: "application/pdf",
                  blob: detail.sourceBlob
              });
          }
      };
      window.addEventListener('reopen-file-request', handler);
      return () => window.removeEventListener('reopen-file-request', handler);
  }, [handleOpenFile]);

  const handleCreateMindMap = useCallback((parentId?: string) => {
    const fileId = `local-mindmap-${Date.now()}`;
    const emptyMap = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
    const blob = new Blob([JSON.stringify(emptyMap)], { type: 'application/json' });
    handleOpenFile({ id: fileId, name: 'Novo Mapa Mental.mindmap', mimeType: 'application/json', blob: blob, parents: parentId ? [parentId] : [] });
  }, [handleOpenFile]);

  const handleGenerateMindMapWithAi = useCallback(async (topic: string) => {
    setAiLoadingMessage(`Pesquisando sobre "${topic}"...`);
    try {
        const data = await generateMindMapAi(topic);
        const fileId = `local-mindmap-ai-${Date.now()}`;
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        handleOpenFile({ 
            id: fileId, 
            name: `${topic.slice(0, 20)}.mindmap`, 
            mimeType: 'application/json', 
            blob: blob 
        });
    } catch (e: any) {
        alert(e.message || "Erro ao gerar mapa com IA.");
    } finally {
        setAiLoadingMessage(null);
    }
  }, [handleOpenFile]);

  const handleCreateDocument = useCallback((parentId?: string) => {
    const fileId = `local-doc-${Date.now()}`;
    const blob = new Blob([''], { type: MIME_TYPES.DOCX });
    handleOpenFile({ id: fileId, name: 'Novo Documento.docx', mimeType: MIME_TYPES.DOCX, blob: blob, parents: parentId ? [parentId] : [] });
  }, [handleOpenFile]);

  const handleCreateFileFromBlob = useCallback((blob: Blob, name: string, mimeType: string) => { handleOpenFile({ id: `local-${Date.now()}`, name, mimeType, blob }); }, [handleOpenFile]);

  const handleCloseFile = useCallback((id: string) => {
    setOpenFiles(prev => { const next = prev.filter(f => f.id !== id); if (activeTab === id) setActiveTab(next.length ? next[next.length - 1].id : 'dashboard'); return next; });
  }, [activeTab]);

  const handleReturnToDashboard = () => {
      setTransitionId(null); 
      if (document.startViewTransition) {
          document.startViewTransition(() => {
              flushSync(() => {
                  setActiveTab('dashboard');
              });
          });
      } else {
          setActiveTab('dashboard');
      }
  };

  const handleRenameActiveFile = async (fileId: string, newName: string) => {
      if (!accessToken && !fileId.startsWith('local-')) return;
      
      const isLocal = fileId.startsWith('local-') || fileId.startsWith('native-');
      const safeName = newName.endsWith('.mindmap') ? newName : `${newName}.mindmap`;

      try {
          if (!isLocal) {
              await renameDriveFile(accessToken!, fileId, safeName);
          }
          // Update local state
          setOpenFiles(prev => prev.map(f => f.id === fileId ? { ...f, name: safeName } : f));
          addNotification("Arquivo renomeado.", "success");
      } catch (e) {
          console.error("Rename failed", e);
          addNotification("Erro ao renomear.", "error");
      }
  };

  const commonProps = useMemo(() => ({ accessToken: accessToken || '', uid: user?.uid || 'guest', onBack: handleReturnToDashboard, onAuthError: handleAuthError, onToggleMenu: () => setIsSidebarOpen(v => !v), onToggleSplitView: () => setIsSplitMode(v => !v) }), [accessToken, user?.uid, handleAuthError]);

  const renderFileContent = useCallback((fileId: string) => {
    const file = openFiles.find(f => f.id === fileId);
    if (!file) return <GlobalLoader />;
    
    if (file.name.endsWith('.lect') || file.mimeType === MIME_TYPES.LECTORIUM) return <LectAdapter key={file.id} {...commonProps} file={file} />;
    
    if (file.name.endsWith('.mindmap') || file.name.endsWith('.json') || file.mimeType === MIME_TYPES.MINDMAP || file.mimeType === 'application/json') {
        return <MindMapEditor key={file.id} {...commonProps} fileId={file.id} fileName={file.name} fileBlob={file.blob} onRename={(newName) => handleRenameActiveFile(file.id, newName)} />;
    }

    if (file.name.endsWith('.docx') || file.mimeType === MIME_TYPES.DOCX || file.mimeType === MIME_TYPES.GOOGLE_DOC) return <DocEditor key={file.id} {...commonProps} fileId={file.id} fileName={file.name} fileBlob={file.blob} fileParents={file.parents} />;
    if (file.mimeType.startsWith('image/') || file.mimeType === 'application/dicom' || file.mimeType.startsWith('text/') || file.name.endsWith('.cbz')) return <UniversalMediaAdapter key={file.id} {...commonProps} file={file} onToggleNavigation={() => setIsSidebarOpen(true)} />;
    
    return <PdfViewer key={file.id} {...commonProps} fileId={file.id} fileName={file.name} fileBlob={file.blob} fileParents={file.parents} />;
  }, [openFiles, commonProps, handleRenameActiveFile]);

  const activeContent = useMemo(() => {
    if (activeTab === 'dashboard') return <Dashboard userName={user?.displayName} onOpenFile={handleOpenFile} onUploadLocal={(e) => { const f = e.target.files?.[0]; if (f) handleCreateFileFromBlob(f, f.name, f.type); }} onCreateMindMap={() => handleCreateMindMap()} onCreateDocument={() => handleCreateDocument()} onCreateFileFromBlob={handleCreateFileFromBlob} onChangeView={(view) => setActiveTab(view)} onToggleMenu={() => setIsSidebarOpen(true)} storageMode={storageMode} onToggleStorageMode={setStorageMode} onLogin={handleLogin} onOpenLocalFolder={handleOpenLocalFolder} savedLocalDirHandle={savedLocalDirHandle} onReconnectLocalFolder={handleReconnectLocalFolder} syncStrategy={syncStrategy} onToggleSyncStrategy={handleToggleSyncStrategy} />;
    
    if (activeTab === 'browser' || activeTab === 'mindmaps' || activeTab === 'offline' || activeTab === 'local-fs' || activeTab === 'shared') {
        const mode = activeTab === 'browser' ? 'default' : activeTab === 'local-fs' ? 'local' : activeTab as any;
        return (
            <DriveBrowser 
                key={mode}
                accessToken={accessToken || ''} 
                onSelectFile={handleOpenFile} 
                onLogout={logout} 
                onAuthError={handleAuthError} 
                onToggleMenu={() => setIsSidebarOpen(true)} 
                mode={mode} 
                onCreateMindMap={(parentId) => mode === 'mindmaps' ? handleCreateMindMap(parentId) : handleCreateDocument(parentId)} 
                onGenerateMindMapWithAi={handleGenerateMindMapWithAi} 
                localDirectoryHandle={mode === 'local' ? localDirHandle : undefined} 
                onLogin={handleLogin}
                expandingFileId={transitionId} 
            />
        );
    }

    if (isSplitMode) {
        return (
            <div className="flex h-full w-full overflow-hidden">
                <div className="flex-1 border-r border-white/10 relative min-w-0">
                    {renderFileContent(activeTab)}
                </div>
                <div className="flex-1 relative min-w-0 bg-surface/50">
                    {secondaryTab ? (
                        <div className="h-full w-full relative">
                            {renderFileContent(secondaryTab)}
                            <button 
                                onClick={() => setSecondaryTab(null)}
                                className="absolute top-2 right-2 z-[60] p-1.5 bg-black/60 hover:bg-red-500/80 rounded-full text-white/70 hover:text-white transition-colors backdrop-blur-sm border border-white/10"
                                title="Fechar Painel Secundário"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full p-6 animate-in fade-in">
                            <div className="bg-surface border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <ScanLine className="text-brand" size={20} />
                                        Split View
                                    </h3>
                                    <button onClick={() => setIsSplitMode(false)} className="text-xs text-red-400 hover:text-red-300">Fechar</button>
                                </div>
                                <p className="text-sm text-text-sec mb-4">Selecione um arquivo aberto para visualizar lado a lado:</p>
                                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {openFiles.filter(f => f.id !== activeTab).map(file => (
                                        <button 
                                            key={file.id}
                                            onClick={() => setSecondaryTab(file.id)}
                                            className="p-3 rounded-lg bg-black/40 border border-white/5 hover:border-brand/50 hover:bg-brand/5 text-left transition-all flex items-center gap-3 group"
                                        >
                                            <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-text-sec group-hover:text-brand transition-colors">
                                                {file.mimeType.includes('pdf') ? 'PDF' : file.mimeType.includes('image') ? 'IMG' : 'DOC'}
                                            </div>
                                            <span className="truncate flex-1 text-sm text-text-sec group-hover:text-white font-medium">{file.name}</span>
                                        </button>
                                    ))}
                                    {openFiles.filter(f => f.id !== activeTab).length === 0 && (
                                        <div className="text-center py-8 text-text-sec text-sm border border-dashed border-white/10 rounded-lg">
                                            Nenhum outro arquivo aberto.
                                            <br/>
                                            <button onClick={() => setIsSidebarOpen(true)} className="text-brand hover:underline mt-2">Abrir Arquivos</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return renderFileContent(activeTab);
  }, [activeTab, openFiles, commonProps, user, handleOpenFile, handleAuthError, accessToken, handleCreateMindMap, handleCreateDocument, handleCreateFileFromBlob, storageMode, handleLogin, handleOpenLocalFolder, localDirHandle, savedLocalDirHandle, handleReconnectLocalFolder, syncStrategy, handleToggleSyncStrategy, handleGenerateMindMapWithAi, transitionId, isSplitMode, secondaryTab, renderFileContent]);

  return (
    <>
      <GlobalToastContainer />
      <OcrCompletionModal />
      <SecretThemeModal isOpen={showSecretThemeModal} onClose={() => setShowSecretThemeModal(false)} />

      <div className="flex h-screen w-full bg-bg overflow-hidden relative selection:bg-brand/30">
        <Sidebar 
            activeTab={activeTab} 
            onSwitchTab={setActiveTab} 
            openFiles={openFiles} 
            onCloseFile={handleCloseFile} 
            user={user} 
            onLogout={logout} 
            onLogin={handleLogin} 
            isOpen={isSidebarOpen} 
            onClose={() => setIsSidebarOpen(false)} 
            driveActive={!!accessToken} 
            onOpenLegal={() => { setLegalModalTab('privacy'); setShowLegalModal(true); }}
            isImmersive={isImmersive}
        />
        <main className="flex-1 relative flex flex-col bg-bg overflow-hidden transition-all duration-300">
          <Suspense fallback={<GlobalLoader />}>
              {syncStatus.message && <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-brand text-bg px-6 py-2 rounded-full font-bold shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-6 duration-300 pointer-events-none"><Wifi size={18} className="animate-pulse" /> {syncStatus.message}</div>}
              {activeContent}
          </Suspense>
        </main>
        {showReauthToast && <ReauthToast onReauth={handleReauth} onClose={() => setShowReauthToast(false)} />}
        
        {/* Onboarding Modals Chain */}
        <LegalModal 
            isOpen={showLegalModal} 
            onClose={onboardingStep === 'legal' ? handleLegalAccepted : () => setShowLegalModal(false)} 
            initialTab={legalModalTab} 
            isMandatory={onboardingStep === 'legal'}
        />
        <GlobalHelpModal
            isOpen={showGuideModal}
            onClose={handleGuideCompleted}
            isMandatory={onboardingStep === 'guide'}
        />

        {/* Fullscreen Prompt */}
        {showFullscreenPrompt && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                <div className="bg-[#1e1e1e] border border-brand/30 rounded-2xl shadow-2xl p-6 max-w-sm w-full relative">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center text-brand border border-brand/20 shadow-[0_0_20px_rgba(74,222,128,0.1)]">
                            <Monitor size={32} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Modo Imersivo</h3>
                            <p className="text-sm text-gray-400 mt-2">
                                Você utilizou a tela cheia na última sessão. Deseja reativar agora para melhor foco?
                            </p>
                        </div>
                        <div className="flex flex-col w-full gap-2 pt-2">
                            <button 
                                onClick={() => {
                                    document.documentElement.requestFullscreen().catch(() => {});
                                    setShowFullscreenPrompt(false);
                                }}
                                className="w-full bg-brand text-[#0b141a] font-bold py-3 rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2"
                            >
                                <Maximize size={18} /> Sim, Ativar
                            </button>
                            <button 
                                onClick={() => setShowFullscreenPrompt(false)}
                                className="w-full bg-[#2c2c2c] text-white font-medium py-3 rounded-xl hover:bg-[#3c3c3c] transition-colors"
                            >
                                Agora não
                            </button>
                            <button 
                                onClick={() => {
                                    localStorage.setItem('fullscreen_pref', 'false');
                                    setShowFullscreenPrompt(false);
                                }}
                                className="text-xs text-gray-500 hover:text-gray-300 py-1 transition-colors"
                            >
                                Não perguntar mais
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {aiLoadingMessage && (
            <div className="fixed inset-0 z-[100] bg-bg/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-brand/20 rounded-full blur-xl animate-pulse"></div>
                    <div className="relative bg-surface p-6 rounded-full border border-brand/30 shadow-2xl">
                        <Sparkles size={48} className="text-brand animate-pulse" />
                    </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">IA Criando Conexões</h3>
                <p className="text-sm text-text-sec max-w-xs text-center px-4 animate-pulse">
                    {aiLoadingMessage}
                </p>
            </div>
        )}
      </div>
      <CookieConsent onAccept={handleCookieAccepted} />
    </>
  );
};

export default function App() {
  return (
    <GlobalProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </GlobalProvider>
  );
}

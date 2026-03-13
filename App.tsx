import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { signInWithGoogleDrive, logout, saveDriveToken, getValidDriveToken, DRIVE_TOKEN_EVENT, checkRedirectResult, getStoredUser, GisUser } from './services/authService';
import { performAppUpdateCleanup, runJanitor, getLocalDirectoryHandle, saveLocalDirectoryHandle } from './services/storageService';
import { openDirectoryPicker, verifyPermission } from './services/localFileService';
import { useSync } from './hooks/useSync';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { OperationalArchive } from './components/OperationalArchive';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CookieConsent } from './components/CookieConsent';
import { StorageMode, MIME_TYPES } from './types';
import { Loader2, Wifi, Sparkles, X, ScanLine, Maximize, Monitor } from 'lucide-react';
import ReauthToast from './components/ReauthToast';
import { LegalModal, LegalTab } from './components/modals/LegalModal';
import { GlobalHelpModal } from './components/GlobalHelpModal';
import { GlobalProvider, useGlobalContext } from './context/GlobalContext';
import { OcrCompletionModal } from './components/modals/OcrCompletionModal';
import { SecretThemeModal } from './components/SecretThemeModal';
import { DriveBrowser } from './components/DriveBrowser';
import { useWorkspace } from './hooks/useWorkspace';
import { useFileManager } from './hooks/useFileManager';

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
                        {n.type === 'error' ? <X size={18} /> : 
                         n.type === 'success' ? <X size={18} /> : 
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
  const isMountedRef = React.useRef(true);
  useEffect(() => {
      return () => { isMountedRef.current = false; };
  }, []);

  const { addNotification, isOcrRunning } = useGlobalContext();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => getValidDriveToken());
  const [showReauthToast, setShowReauthToast] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalTab>('privacy');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [storageMode, setStorageMode] = useState<StorageMode>('local');
  const [syncStrategy, setSyncStrategy] = useState<'smart' | 'online'>(() => (localStorage.getItem('sync_strategy') as 'smart' | 'online') || 'smart');
  const [localDirHandle, setLocalDirHandle] = useState<any>(null);
  const [savedLocalDirHandle, setSavedLocalDirHandle] = useState<any>(null);

  const workspace = useWorkspace();

  // Abre o LegalModal automaticamente quando onboarding chega na etapa 'legal'.
  // Sem isso, onboardingStep === 'legal' nunca seta showLegalModal = true
  // e o modal de consentimento obrigatorio nunca aparece apos o CookieConsent.
  useEffect(() => {
    if (workspace.onboardingStep === 'legal') {
      setLegalModalTab('privacy');
      setShowLegalModal(true);
    }
  }, [workspace.onboardingStep]);

  const handleAuthError = useCallback(() => {
      setAccessToken(null);
      setShowReauthToast(true);
  }, []);

  const handleToggleSyncStrategy = useCallback((strategy: 'smart' | 'online') => { setSyncStrategy(strategy); localStorage.setItem('sync_strategy', strategy); }, []);

  const handleLogin = useCallback(async () => {
    try {
      const result = await signInWithGoogleDrive();
      if (result && result.accessToken) { 
          saveDriveToken(result.accessToken); 
          setAccessToken(result.accessToken); 
          setShowReauthToast(false); 
      }
    } catch (e) { addNotification("Não foi possível conectar ao Google Drive.", "error"); }
  }, [addNotification]);

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

  useEffect(() => {
    const init = async () => {
        const params = new URLSearchParams(window.location.search);
        const legalParam = params.get('legal');
        if (legalParam === 'privacy' || legalParam === 'terms') {
            setLegalModalTab(legalParam as LegalTab);
            setShowLegalModal(true);
            window.history.replaceState({}, document.title, "/");
        }

        if (params.get('protocol') === 'genesis') {
            workspace.setShowSecretThemeModal(true);
            window.history.replaceState({}, document.title, "/");
        }

        await checkRedirectResult();
        await performAppUpdateCleanup();
        await runJanitor(); 
        const storedHandle = await getLocalDirectoryHandle();
        if (storedHandle) setSavedLocalDirHandle(storedHandle);
    };
    init();
    
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) { setAccessToken(null); } 
      else { const storedToken = getValidDriveToken(); if (storedToken) setAccessToken(storedToken); }
    });

    const handleTokenUpdate = (e: Event) => {
        if (!isMountedRef.current) return;
        const customEvent = e as CustomEvent;
        if (customEvent.detail && customEvent.detail.token) {
            setAccessToken(customEvent.detail.token);
            setShowReauthToast(false);
        }
    };
    window.addEventListener(DRIVE_TOKEN_EVENT, handleTokenUpdate);

    return () => {
        unsubscribeAuth();
        window.removeEventListener(DRIVE_TOKEN_EVENT, handleTokenUpdate);
    };
  }, [workspace]);

  const handleOpenLocalFolder = useCallback(async (manualHandle?: any) => {
    if (manualHandle) {
        setLocalDirHandle(manualHandle);
        setSavedLocalDirHandle(null);
        fileManager.setActiveTab('local-fs');
        return;
    }
    try { 
        const handle = await openDirectoryPicker(); 
        if (handle) { 
            setLocalDirHandle(handle); 
            setSavedLocalDirHandle(handle); 
            await saveLocalDirectoryHandle(handle); 
            fileManager.setActiveTab('local-fs'); 
        } 
    } catch (e: any) { 
        if (e.name !== 'AbortError') addNotification(e.message, "error"); 
    }
  }, [addNotification]);

  const handleReconnectLocalFolder = useCallback(async () => {
      if (!savedLocalDirHandle) return;
      try { const granted = await verifyPermission(savedLocalDirHandle, true); if (granted) { setLocalDirHandle(savedLocalDirHandle); fileManager.setActiveTab('local-fs'); } else { addNotification("Acesso negado.", "error"); setSavedLocalDirHandle(null); } } catch (e) { handleOpenLocalFolder(); }
  }, [savedLocalDirHandle, handleOpenLocalFolder, addNotification]);

  const commonProps = useMemo(() => ({ 
      accessToken: accessToken || '', 
      uid: user?.uid || 'guest', 
      onBack: () => fileManager.handleReturnToDashboard(), 
      onAuthError: handleAuthError, 
      onToggleMenu: () => setIsSidebarOpen(v => !v), 
      onToggleSplitView: () => fileManager.setIsSplitMode(v => !v) 
  }), [accessToken, user?.uid, handleAuthError]);

  const fileManager = useFileManager({
    accessToken,
    uid: user?.uid || 'guest',
    isOcrRunning,
    addNotification,
    onAuthError: handleAuthError,
    onCloseMenu: () => setIsSidebarOpen(false),
    commonProps,
  });

  useEffect(() => {
      const handler = (e: Event) => {
          const detail = (e as CustomEvent).detail;
          if (detail && detail.fileId) {
              fileManager.handleOpenFile({
                  id: detail.fileId,
                  name: detail.filename || "Documento Analisado",
                  mimeType: "application/pdf",
                  blob: detail.sourceBlob
              });
          }
      };
      window.addEventListener('reopen-file-request', handler);
      return () => window.removeEventListener('reopen-file-request', handler);
  }, [fileManager]);

  const activeContent = useMemo(() => {
    if (fileManager.activeTab === 'dashboard') return <Dashboard userName={user?.displayName} onOpenFile={fileManager.handleOpenFile} onUploadLocal={(e) => { const f = e.target.files?.[0]; if (f) fileManager.handleCreateFileFromBlob(f, f.name, f.type); }} onCreateMindMap={() => fileManager.handleCreateMindMap()} onCreateDocument={() => fileManager.handleCreateDocument()} onCreateFileFromBlob={fileManager.handleCreateFileFromBlob} onChangeView={(view) => fileManager.setActiveTab(view)} onToggleMenu={() => setIsSidebarOpen(true)} storageMode={storageMode} onToggleStorageMode={setStorageMode} onLogin={handleLogin} onOpenLocalFolder={handleOpenLocalFolder} savedLocalDirHandle={savedLocalDirHandle} onReconnectLocalFolder={handleReconnectLocalFolder} syncStrategy={syncStrategy} onToggleSyncStrategy={handleToggleSyncStrategy} />;
    
    if (fileManager.activeTab === 'operational-archive') {
        const openDocxFiles = fileManager.openFiles.filter(
            f => f.name.endsWith('.docx') || f.mimeType === MIME_TYPES.DOCX || f.mimeType === MIME_TYPES.GOOGLE_DOC
        );
        return (
            <OperationalArchive
                accessToken={accessToken || ''}
                uid={user?.uid || 'guest'}
                onToggleMenu={() => setIsSidebarOpen(true)}
                openDocxFiles={openDocxFiles}
                onInjectToDocx={(fileId, markdown) => {
                    window.dispatchEvent(new CustomEvent('inject-markdown-to-doc', {
                        detail: { fileId, markdown }
                    }));
                }}
            />
        );
    }

    if (fileManager.activeTab === 'browser' || fileManager.activeTab === 'mindmaps' || fileManager.activeTab === 'offline' || fileManager.activeTab === 'local-fs' || fileManager.activeTab === 'shared') {
        const mode = fileManager.activeTab === 'browser' ? 'default' : fileManager.activeTab === 'local-fs' ? 'local' : fileManager.activeTab as any;
        return (
            <DriveBrowser 
                key={mode}
                accessToken={accessToken || ''} 
                onSelectFile={fileManager.handleOpenFile} 
                onLogout={logout} 
                onAuthError={handleAuthError} 
                onToggleMenu={() => setIsSidebarOpen(true)} 
                mode={mode} 
                onCreateMindMap={(parentId) => mode === 'mindmaps' ? fileManager.handleCreateMindMap(parentId) : fileManager.handleCreateDocument(parentId)} 
                onGenerateMindMapWithAi={fileManager.handleGenerateMindMapWithAi} 
                localDirectoryHandle={mode === 'local' ? localDirHandle : undefined} 
                onLogin={handleLogin}
                expandingFileId={fileManager.transitionId} 
            />
        );
    }

    if (fileManager.isSplitMode) {
        return (
            <div className="flex h-full w-full overflow-hidden">
                <div className="flex-1 border-r border-white/10 relative min-w-0">
                    {fileManager.renderFileContent(fileManager.activeTab)}
                </div>
                <div className="flex-1 relative min-w-0 bg-surface/50">
                    {fileManager.secondaryTab ? (
                        <div className="h-full w-full relative">
                            {fileManager.renderFileContent(fileManager.secondaryTab)}
                            <button 
                                onClick={() => fileManager.setSecondaryTab(null)}
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
                                    <button onClick={() => fileManager.setIsSplitMode(false)} className="text-xs text-red-400 hover:text-red-300">Fechar</button>
                                </div>
                                <p className="text-sm text-text-sec mb-4">Selecione um arquivo aberto para visualizar lado a lado:</p>
                                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {fileManager.openFiles.filter(f => f.id !== fileManager.activeTab).map(file => (
                                        <button 
                                            key={file.id}
                                            onClick={() => fileManager.setSecondaryTab(file.id)}
                                            className="p-3 rounded-lg bg-black/40 border border-white/5 hover:border-brand/50 hover:bg-brand/5 text-left transition-all flex items-center gap-3 group"
                                        >
                                            <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-text-sec group-hover:text-brand transition-colors">
                                                {file.mimeType.includes('pdf') ? 'PDF' : file.mimeType.includes('image') ? 'IMG' : 'DOC'}
                                            </div>
                                            <span className="truncate flex-1 text-sm text-text-sec group-hover:text-white font-medium">{file.name}</span>
                                        </button>
                                    ))}
                                    {fileManager.openFiles.filter(f => f.id !== fileManager.activeTab).length === 0 && (
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

    return fileManager.renderFileContent(fileManager.activeTab);
  }, [fileManager, user, storageMode, handleLogin, handleOpenLocalFolder, localDirHandle, savedLocalDirHandle, handleReconnectLocalFolder, syncStrategy, handleToggleSyncStrategy, accessToken, handleAuthError]);

  return (
    <>
      <GlobalToastContainer />
      <OcrCompletionModal />
      <SecretThemeModal isOpen={workspace.showSecretThemeModal} onClose={() => workspace.setShowSecretThemeModal(false)} />

      <div className="flex h-screen w-full bg-bg overflow-hidden relative selection:bg-brand/30">
        <Sidebar 
            activeTab={fileManager.activeTab} 
            onSwitchTab={fileManager.setActiveTab} 
            openFiles={fileManager.openFiles} 
            onCloseFile={fileManager.handleCloseFile} 
            user={user} 
            onLogout={logout} 
            onLogin={handleLogin} 
            isOpen={isSidebarOpen} 
            onClose={() => setIsSidebarOpen(false)} 
            driveActive={!!accessToken} 
            onOpenLegal={() => { setLegalModalTab('privacy'); setShowLegalModal(true); }}
            isImmersive={workspace.isImmersive}
        />
        <main className="flex-1 relative flex flex-col bg-bg overflow-hidden transition-all duration-300">
          <Suspense fallback={<GlobalLoader />}>
              {syncStatus.message && <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-brand text-bg px-6 py-2 rounded-full font-bold shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-6 duration-300 pointer-events-none"><Wifi size={18} className="animate-pulse" /> {syncStatus.message}</div>}
              {activeContent}
          </Suspense>
        </main>
        {showReauthToast && <ReauthToast onReauth={handleReauth} onClose={() => setShowReauthToast(false)} />}
        
        <LegalModal 
            isOpen={showLegalModal} 
            onClose={() => setShowLegalModal(false)}
            onAccept={workspace.onboardingStep === 'legal' ? () => {
                setShowLegalModal(false);
                workspace.handleLegalAccepted();
            } : undefined}
            initialTab={legalModalTab} 
            isMandatory={workspace.onboardingStep === 'legal'}
        />
        <GlobalHelpModal
            isOpen={workspace.showGuideModal}
            onClose={workspace.handleGuideCompleted}
            isMandatory={workspace.onboardingStep === 'guide'}
        />

        {workspace.showFullscreenPrompt && (
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
                                    workspace.setShowFullscreenPrompt(false);
                                }}
                                className="w-full bg-brand text-[#0b141a] font-bold py-3 rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2"
                            >
                                <Maximize size={18} /> Sim, Ativar
                            </button>
                            <button 
                                onClick={() => workspace.setShowFullscreenPrompt(false)}
                                className="w-full bg-[#2c2c2c] text-white font-medium py-3 rounded-xl hover:bg-[#3c3c3c] transition-colors"
                            >
                                Agora não
                            </button>
                            <button 
                                onClick={() => {
                                    localStorage.setItem('fullscreen_pref', 'false');
                                    workspace.setShowFullscreenPrompt(false);
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

        {fileManager.aiLoadingMessage && (
            <div className="fixed inset-0 z-[100] bg-bg/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-brand/20 rounded-full blur-xl animate-pulse"></div>
                    <div className="relative bg-surface p-6 rounded-full border border-brand/30 shadow-2xl">
                        <Sparkles size={48} className="text-brand animate-pulse" />
                    </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">IA Criando Conexões</h3>
                <p className="text-sm text-text-sec max-w-xs text-center px-4 animate-pulse">
                    {fileManager.aiLoadingMessage}
                </p>
            </div>
        )}
      </div>
      <CookieConsent onAccept={workspace.handleCookieAccepted} />
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

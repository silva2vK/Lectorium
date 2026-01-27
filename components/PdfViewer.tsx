
import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { Loader2, ShieldCheck, ScanLine, Save, Lock, Unlock, Zap } from 'lucide-react';
import { PDFDocumentProxy } from 'pdfjs-dist';

// Hooks & Context
import { usePdfDocument } from '../hooks/usePdfDocument';
import { usePdfAnnotations } from '../hooks/usePdfAnnotations';
import { PdfProvider, usePdfContext } from '../context/PdfContext';
import { usePdfStore, PdfStoreProvider, usePdfStoreApi } from '../stores/usePdfStore';
import { usePdfSaver } from '../hooks/usePdfSaver';
import { usePdfGestures } from '../hooks/usePdfGestures'; 
import { usePdfPreloader } from '../hooks/usePdfPreloader';
import { Annotation, SemanticLensData } from '../types';

// Components
import { PdfPage } from './pdf/PdfPage';
import { PdfToolbar } from './pdf/PdfToolbar';
import { PdfSidebar, SidebarTab } from './pdf/PdfSidebar';
import { SelectionMenu } from './pdf/SelectionMenu';
import { OcrRangeModal } from './pdf/modals/OcrRangeModal';
import { ConflictResolutionModal } from './pdf/modals/ConflictResolutionModal';
import { PdfHeader } from './pdf/PdfHeader';
import { SaveDocumentModal } from './pdf/modals/SaveDocumentModal';
import { DefinitionModal } from './pdf/modals/DefinitionModal';
import { DriveFolderPickerModal } from './pdf/modals/DriveFolderPickerModal';
import { SaveErrorModal } from './pdf/modals/SaveErrorModal';
import { PasswordPromptModal } from './pdf/modals/PasswordPromptModal';
import { PdfRestrictionModal } from './pdf/modals/PdfRestrictionModal';
import { SaveSuccessModal } from './pdf/modals/SaveSuccessModal';

// Services
import { fetchDefinition } from '../services/dictionaryService';
import { isFileOffline } from '../services/storageService';

interface Props {
  accessToken?: string | null;
  fileId: string;
  fileName: string;
  fileParents?: string[];
  uid: string;
  onBack: () => void;
  fileBlob?: Blob;
  isPopup?: boolean;
  onToggleNavigation?: () => void;
  onToggleMenu?: () => void; 
  onAuthError?: () => void;
  
  // Props para dados importados (LectAdapter)
  initialAnnotations?: Annotation[];
  initialPageOffset?: number;
  initialSemanticData?: Record<number, SemanticLensData>;
}

interface PdfViewerContentProps extends Props {
  originalBlob: Blob | null;
  setOriginalBlob: (b: Blob) => void;
  pdfDoc: PDFDocumentProxy | null;
  pageDimensions: { width: number, height: number } | null;
  numPages: number;
  jumpToPageRef: React.MutableRefObject<((page: number) => void) | null>;
  conflictDetected: boolean;
  isCheckingIntegrity: boolean;
  hasPageMismatch: boolean;
  resolveConflict: (action: 'use_external' | 'restore_lectorium' | 'merge') => void;
  password?: string;
}

const PdfViewerContent: React.FC<PdfViewerContentProps> = ({ 
  accessToken, fileId, fileName, fileParents, onBack, originalBlob, setOriginalBlob, pdfDoc, pageDimensions, numPages, jumpToPageRef, onToggleNavigation, onToggleMenu,
  conflictDetected, isCheckingIntegrity, hasPageMismatch, resolveConflict, onAuthError, password
}) => {
  const scale = usePdfStore(state => state.scale);
  const setScale = usePdfStore(state => state.setScale);
  const currentPage = usePdfStore(state => state.currentPage);
  const setCurrentPage = usePdfStore(state => state.setCurrentPage);
  const activeTool = usePdfStore(state => state.activeTool);
  const goNext = usePdfStore(state => state.nextPage);
  const goPrev = usePdfStore(state => state.prevPage);
  const storeApi = usePdfStoreApi();
  
  // Store Setters for Initialization
  const setStoreNumPages = usePdfStore(state => state.setNumPages);
  const setStorePageDimensions = usePdfStore(state => state.setPageDimensions);
  const setStorePageSizes = usePdfStore(state => state.setPageSizes);

  // Restriction State
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);

  // --- OWNER PASSWORD CHECK ---
  useEffect(() => {
    if (!pdfDoc) return;
    
    const checkPermissions = async () => {
        // getPermissions() retorna null se não houver restrições.
        // Retorna um array se houver restrições (Owner Password presente).
        const permissions = await pdfDoc.getPermissions();
        
        if (permissions !== null) {
            console.warn("[Lectorium Security] Arquivo protegido por Owner Password. Edição bloqueada.");
            setShowRestrictionModal(true);
        }
    };
    checkPermissions();
  }, [pdfDoc]);

  // --- Session Persistence Logic (Auto-Save Page & Zoom) ---
  useEffect(() => {
    const unsub = storeApi.subscribe(
        (state) => ({ page: state.currentPage, scale: state.scale }),
        (state) => {
            const sessionData = {
                page: state.page,
                scale: state.scale,
                lastAccess: Date.now()
            };
            localStorage.setItem(`lectorium_session_${fileId}`, JSON.stringify(sessionData));
        },
        { fireImmediately: false, equalityFn: (a, b) => a.page === b.page && a.scale === b.scale }
    );
    return unsub;
  }, [fileId, storeApi]);

  useEffect(() => {
    setStoreNumPages(numPages);
  }, [numPages, setStoreNumPages]);

  useEffect(() => {
    if (pageDimensions) setStorePageDimensions(pageDimensions);
  }, [pageDimensions, setStorePageDimensions]);

  useEffect(() => {
    if (!pdfDoc) return;
    let mounted = true;
    const fetchSizes = async () => {
        const sizes: { width: number, height: number }[] = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            if (!mounted) return;
            try {
                const page = await pdfDoc.getPage(i);
                const vp = page.getViewport({ scale: 1 });
                sizes.push({ width: vp.width, height: vp.height });
            } catch (e) {
                sizes.push(sizes.length > 0 ? sizes[sizes.length-1] : { width: 600, height: 800 });
            }
        }
        if (mounted) setStorePageSizes(sizes);
    };
    setTimeout(fetchSizes, 100);
    return () => { mounted = false; };
  }, [pdfDoc, setStorePageSizes]);

  const numPagesStore = usePdfStore(state => state.numPages); 

  const { 
    settings, 
    annotations, addAnnotation, removeAnnotation,
    ocrNotification,
    currentBlobRef,
    getUnburntOcrMap,
    markOcrAsSaved,
    setChatRequest,
    showOcrModal, setShowOcrModal,
    setHasUnsavedOcr,
    selection, setSelection,
    docPageOffset,
    lensData
  } = usePdfContext();
  
  usePdfPreloader({
      pdfDoc,
      currentPage,
      scale,
      fileId
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const visualContentRef = useRef<HTMLDivElement>(null);

  const { handlers: gestureHandlers } = usePdfGestures(visualContentRef);

  const handleToggleNav = onToggleNavigation || onToggleMenu;

  useEffect(() => {
    jumpToPageRef.current = (page: number) => {
        setCurrentPage(page);
    };
  }, [jumpToPageRef, setCurrentPage]);

  useEffect(() => {
    if (containerRef.current) {
        containerRef.current.scrollTop = 0;
    }
  }, [currentPage]);

  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('annotations');
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [isOfflineAvailable, setIsOfflineAvailableState] = useState(false);
  const [showDefinitionModal, setShowDefinitionModal] = useState(false);
  const [definition, setDefinition] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { 
    handleSave, uploadToSpecificFolder, isSaving, saveMessage, saveError, setSaveError,
    setIsOfflineAvailable, technicalError, successModal, closeSuccessModal
  } = usePdfSaver({
    fileId, fileName, fileParents, accessToken, annotations, 
    currentBlobRef, originalBlob, 
    ocrToBurn: getUnburntOcrMap(), 
    docPageOffset: docPageOffset, 
    lensData,
    onUpdateOriginalBlob: setOriginalBlob,
    onOcrSaved: () => markOcrAsSaved(Object.keys(getUnburntOcrMap()).map(Number)),
    setHasUnsavedOcr,
    password // Passa a senha para o saver
  });

  const isLocalFile = fileId.startsWith('local-') || fileId.startsWith('native-') || !fileId;

  useEffect(() => {
    setIsOfflineAvailableState(false);
    isFileOffline(fileId).then(setIsOfflineAvailableState);
  }, [fileId]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goPrev, goNext]);

  const createHighlight = () => {
    if (!selection) return;
    selection.relativeRects.forEach((rect: any, index: number) => {
      addAnnotation({
        id: `hl-${Date.now()}-${Math.random()}`,
        page: selection.page,
        bbox: [rect.x, rect.y, rect.width, rect.height],
        type: 'highlight',
        text: index === 0 ? selection.text : '',
        color: settings.highlightColor,
        opacity: settings.highlightOpacity
      });
    });
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleDeleteSelection = useCallback(() => {
    if (!selection) return;
    
    const pageAnns = annotations.filter(a => a.page === selection.page && !a.isBurned);
    const idsToDelete = new Set<string>();

    selection.relativeRects.forEach((selRect: any) => {
       pageAnns.forEach(ann => {
           if (ann.bbox && ann.bbox[2] > 0) { 
               const [ax, ay, aw, ah] = ann.bbox;
               const [sx, sy, sw, sh] = [selRect.x, selRect.y, selRect.width, selRect.height];
               const intersects = (ax < sx + sw) && (ax + aw > sx) && (ay < sy + sh) && (ay + ah > sy);
               
               if (intersects && ann.id) {
                   idsToDelete.add(ann.id);
               }
           }
       });
    });

    if (idsToDelete.size > 0) {
        idsToDelete.forEach(id => {
            const ann = pageAnns.find(a => a.id === id);
            if (ann) removeAnnotation(ann);
        });
    }

    setSelection(null);
    if (window.getSelection) window.getSelection()?.removeAllRanges();
  }, [selection, annotations, removeAnnotation]);

  const handleFitWidth = async () => { 
      if (!pdfDoc || !containerRef.current) return; 
      try { 
          const page = await pdfDoc.getPage(currentPage); 
          const viewport = page.getViewport({ scale: 1 }); 
          const containerWidth = containerRef.current.clientWidth; 
          const isMobile = window.innerWidth < 768; 
          const padding = isMobile ? 20 : 100; 
          const newScale = (containerWidth - padding) / viewport.width; 
          setScale(newScale); 
      } catch (e) { console.error("Erro ao ajustar largura:", e); } 
  };

  const handleExplainAi = () => { if (!selection) return; setChatRequest(`Explique este trecho: "${selection.text}"`); setSelection(null); setSidebarTab('chat'); setShowSidebar(true); };
  const handleDefine = async () => { if (!selection) return; const word = selection.text; setSelection(null); setDefinition(null); setShowDefinitionModal(true); try { const def = await fetchDefinition(word); setDefinition(def || { word, meanings: ["Definição não encontrada"] }); } catch (e) { setDefinition({ word, meanings: ["Erro ao buscar"] }); } };
  
  const sidebarAnnotations = useMemo(() => annotations.sort((a, b) => (a.page - b.page)), [annotations]);
  
  const fichamentoText = useMemo(() => {
      const seen = new Set<string>();
      return sidebarAnnotations
        .filter(ann => ann.text && ann.text.trim().length > 0)
        .filter(ann => ann.type !== 'note')
        .filter(ann => {
            const signature = `${ann.page}-${ann.text!.trim()}`;
            if (seen.has(signature)) return false;
            seen.add(signature);
            return true;
        })
        .map(ann => `(Pág ${ann.page}) ${ann.text}`)
        .join('\n\n');
  }, [sidebarAnnotations]);

  const handleDownloadFichamento = () => { const blob = new Blob([fichamentoText], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Fichamento.txt`; a.click(); URL.revokeObjectURL(url); };
  const filterValues = useMemo(() => { const hexToRgb = (hex: string) => { const bigint = parseInt(hex.slice(1), 16); return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]; }; const [tr, tg, tb] = hexToRgb(settings.textColor); const [br, bg, bb] = hexToRgb(settings.pageColor); const rScale = (br - tr) / 255, gScale = (bg - tg) / 255, bScale = (bb - tb) / 255; const rOffset = tr / 255, gOffset = tg / 255, bOffset = tb / 255; return `${rScale} 0 0 0 ${rOffset} 0 ${gScale} 0 0 ${gOffset} 0 0 ${bScale} 0 ${bOffset} 0 0 0 1 0`; }, [settings.textColor, settings.pageColor]);
  
  const handleOcrConfirm = useCallback(() => { setShowOcrModal(false); onBack(); }, [onBack, setShowOcrModal]);

  const onSelectSaveMode = (mode: 'local' | 'overwrite' | 'copy' | 'drive_picker') => {
      if (mode === 'drive_picker') {
          if (!accessToken) {
              setSaveError('auth');
              return;
          }
          setShowSaveModal(false);
          setShowDrivePicker(true);
      } else {
          handleSave(mode);
          setShowSaveModal(false);
      }
  };

  const handleFolderSelected = async (folderId: string) => {
      setShowDrivePicker(false);
      await uploadToSpecificFolder(folderId);
  };

  return (
    <div 
      className="flex flex-col h-screen bg-bg text-text relative overflow-hidden font-sans" 
      style={{ viewTransitionName: 'hero-expand' }}
    >
      <svg style={{ width: 0, height: 0, position: 'absolute' }}>
        <filter id="pdf-recolor"><feColorMatrix type="matrix" values={filterValues} /></filter>
      </svg>
      
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '40px 40px', backgroundPosition: '0 0' }} />
      <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-transparent via-bg/50 to-bg"/>
      
      {/* Modal de Restrição (Obrigatório se owner password for detectado) */}
      <PdfRestrictionModal isOpen={showRestrictionModal} onClose={onBack} />

      {isCheckingIntegrity && (
          <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in">
              <div className="bg-surface p-6 rounded-2xl border border-brand/20 shadow-2xl flex flex-col items-center gap-4">
                  <ShieldCheck size={48} className="text-brand animate-pulse" />
                  <div className="text-center">
                      <h3 className="font-bold text-lg text-white">Verificando Integridade</h3>
                      <p className="text-sm text-text-sec">Validando assinatura digital do arquivo...</p>
                  </div>
              </div>
          </div>
      )}

      {ocrNotification && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[80] animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-black/60 backdrop-blur-md border border-white/10 px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-3">
                <ScanLine size={16} className={`text-brand ${ocrNotification.includes('Iniciando') || ocrNotification.includes('Processando') ? 'animate-pulse' : ''}`} />
                <span className="text-sm font-medium text-white tracking-wide">{ocrNotification}</span>
            </div>
        </div>
      )}
      
      <PdfHeader 
        isVisible={isHeaderVisible}
        fileName={fileName}
        currentPage={currentPage + docPageOffset}
        numPages={numPagesStore + docPageOffset}
        isSaving={isSaving}
        isFullscreen={isFullscreen}
        onToggleNavigation={handleToggleNav}
        onBack={onBack}
        onSave={() => setShowSaveModal(true)}
        onToggleFullscreen={toggleFullscreen}
        headerRef={headerRef}
      />

      <div 
        className={`fixed left-1/2 -translate-x-1/2 z-[60] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] flex justify-center cursor-pointer ${isHeaderVisible ? 'top-[4.5rem]' : 'top-0'}`}
        onClick={() => setIsHeaderVisible(!isHeaderVisible)}
        title={isHeaderVisible ? "Retrair Menu" : "Mostrar Menu"}
      >
          <div className="tactical-puller bg-black border-b border-x border-brand/50 shadow-[0_5px_20px_-5px_rgba(0,0,0,0.8)] rounded-b-2xl px-6 py-1.5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:pt-3 hover:pb-2 group flex items-center justify-center">
              <div className="puller-indicator w-8 h-1 bg-white/20 rounded-full group-hover:bg-brand group-hover:shadow-[0_0_10px_var(--brand)] transition-colors duration-300" />
          </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <PdfSidebar 
            isOpen={showSidebar} 
            onClose={() => setShowSidebar(!showSidebar)} 
            activeTab={sidebarTab} 
            onTabChange={setSidebarTab} 
            sidebarAnnotations={sidebarAnnotations} 
            fichamentoText={fichamentoText} 
            onCopyFichamento={() => navigator.clipboard.writeText(fichamentoText)} 
            onDownloadFichamento={handleDownloadFichamento} 
            onNavigateBack={onBack}
        />
        
        <div 
            ref={containerRef} 
            className={`flex-1 overflow-auto relative flex flex-col items-center p-4 md:p-8 pt-[3.5cm] ${(activeTool === 'ink' || activeTool === 'brush') ? 'touch-none' : ''}`} 
            {...gestureHandlers}
        >
            <PdfToolbar onFitWidth={handleFitWidth} />
            {selection && (
                <SelectionMenu 
                    selection={selection} 
                    onHighlight={createHighlight} 
                    onExplainAi={handleExplainAi} 
                    onDefine={handleDefine} 
                    onCopy={() => navigator.clipboard.writeText(selection.text)} 
                    onDelete={handleDeleteSelection}
                    onClose={() => setSelection(null)} 
                />
            )}
            
            <div 
                ref={visualContentRef}
                className="transition-all duration-300 ease-out" 
                style={{ boxShadow: '0 0 50px -10px rgba(0,0,0,0.5)' }}
            >
                <PdfPage pageNumber={currentPage} filterValues={filterValues} pdfDoc={pdfDoc} />
            </div>
        </div>
      </div>

      <DefinitionModal 
        isOpen={showDefinitionModal} 
        onClose={() => setShowDefinitionModal(false)} 
        definition={definition}
      />
      
      <SaveDocumentModal 
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={onSelectSaveMode}
        isOffline={!navigator.onLine}
        isLocalFile={isLocalFile}
        isEncrypted={!!password}
      />

      <DriveFolderPickerModal
        isOpen={showDrivePicker}
        onClose={() => setShowDrivePicker(false)}
        accessToken={accessToken || ''}
        onSelectFolder={handleFolderSelected}
      />

      <SaveErrorModal 
        isOpen={!!saveError}
        errorType={saveError}
        technicalDetails={technicalError}
        onClose={() => setSaveError(null)}
        onReconnect={() => { setSaveError(null); onAuthError?.(); }}
        onDownload={() => { handleSave('local'); setSaveError(null); }}
        onSaveCopy={() => { handleSave('copy'); setSaveError(null); }}
      />

      <SaveSuccessModal 
        isOpen={successModal.open}
        onClose={closeSuccessModal}
        mode={successModal.mode}
        fileName={fileName}
      />
      
      {isSaving && (
          <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
              <div className="relative mb-6">
                  <div className="absolute inset-0 bg-brand/20 rounded-full blur-xl animate-pulse"></div>
                  <div className="relative bg-[#121212] p-6 rounded-full border border-brand/30 shadow-2xl"><Save size={48} className="text-brand animate-pulse" /></div>
                  <div className="absolute -bottom-2 -right-2 bg-black rounded-full p-1.5 border border-white/10"><Loader2 size={24} className="animate-spin text-white" /></div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2 tracking-wide uppercase">{saveMessage || 'Salvando...'}</h3>
              <p className="text-sm text-text-sec">Não feche a janela.</p>
          </div>
      )}

      <OcrRangeModal 
        isOpen={showOcrModal} 
        onClose={() => setShowOcrModal(false)} 
        numPages={numPages} 
        currentPage={currentPage} 
        fileName={fileName}
        onConfirm={handleOcrConfirm} 
      />
      
      <ConflictResolutionModal 
        isOpen={conflictDetected} 
        onClose={() => {}} 
        onResolve={resolveConflict} 
        hasPageMismatch={hasPageMismatch}
      />
    </div>
  );
};

export const PdfViewer: React.FC<Props> = (props) => {
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const { 
    pdfDoc, 
    originalBlob, 
    setOriginalBlob,
    numPages, 
    loading, 
    error, 
    scale, 
    pageDimensions 
  } = usePdfDocument({ 
    fileId: props.fileId, 
    fileBlob: props.fileBlob, 
    accessToken: props.accessToken, 
    onAuthError: props.onAuthError,
    password
  });

  const { 
    annotations, 
    addAnnotation, 
    removeAnnotation, 
    conflictDetected, 
    resolveConflict, 
    isCheckingIntegrity, 
    hasPageMismatch, 
    pageOffset, 
    setPageOffset, 
    semanticData 
  } = usePdfAnnotations(
    props.fileId, 
    props.uid, 
    pdfDoc, 
    originalBlob,
    props.initialAnnotations, 
    props.initialPageOffset,
    props.initialSemanticData
  );

  const jumpToPageRef = useRef<((page: number) => void) | null>(null);

  // Password Handling
  useEffect(() => {
      if (error === 'PASSWORD_REQUIRED') {
          setShowPasswordModal(true);
      }
  }, [error]);

  const handlePasswordSubmit = (pass: string) => {
      setPassword(pass);
      setShowPasswordModal(false);
  };

  const handlePasswordClose = () => {
      setShowPasswordModal(false);
      props.onBack();
  };

  if (loading && !pdfDoc) {
      return (
          <div className="flex flex-col items-center justify-center h-screen bg-bg">
              <div className="relative mb-4">
                  <div className="absolute inset-0 bg-brand/20 rounded-full blur-xl animate-pulse"></div>
                  <Loader2 size={48} className="animate-spin text-brand relative z-10" />
              </div>
              <p className="text-sm font-medium text-text-sec animate-pulse tracking-wide uppercase">Abrindo Documento...</p>
          </div>
      );
  }

  return (
    <>
        <PdfStoreProvider initialScale={scale}>
            <PdfProvider 
                numPages={numPages} 
                annotations={annotations} 
                onAddAnnotation={addAnnotation} 
                onRemoveAnnotation={removeAnnotation} 
                accessToken={props.accessToken} 
                fileId={props.fileId} 
                pdfDoc={pdfDoc}
                onUpdateSourceBlob={setOriginalBlob}
                currentBlob={originalBlob}
                initialPageOffset={pageOffset}
                onSetPageOffset={setPageOffset}
                initialSemanticData={semanticData}
            >
                <PdfViewerContent 
                    {...props} 
                    originalBlob={originalBlob}
                    setOriginalBlob={setOriginalBlob}
                    pdfDoc={pdfDoc}
                    pageDimensions={pageDimensions}
                    numPages={numPages}
                    jumpToPageRef={jumpToPageRef}
                    conflictDetected={conflictDetected}
                    isCheckingIntegrity={isCheckingIntegrity}
                    hasPageMismatch={hasPageMismatch}
                    resolveConflict={resolveConflict}
                    password={password}
                />
            </PdfProvider>
        </PdfStoreProvider>

        <PasswordPromptModal 
            isOpen={showPasswordModal}
            onClose={handlePasswordClose}
            onSubmit={handlePasswordSubmit}
            fileName={props.fileName}
            isRetry={!!password}
        />
    </>
  );
};

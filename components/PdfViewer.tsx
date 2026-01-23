
import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { Loader2, ShieldCheck, ScanLine, Save, Lock } from 'lucide-react';
import { PDFDocumentProxy } from 'pdfjs-dist';

// Hooks & Context
import { usePdfDocument } from '../hooks/usePdfDocument';
import { usePdfAnnotations } from '../hooks/usePdfAnnotations';
import { PdfProvider, usePdfContext } from '../context/PdfContext';
import { usePdfStore, PdfStoreProvider, usePdfStoreApi } from '../stores/usePdfStore'; // Import Provider & API
import { usePdfSaver } from '../hooks/usePdfSaver';
import { usePdfGestures } from '../hooks/usePdfGestures'; 
import { usePdfPreloader } from '../hooks/usePdfPreloader';

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
  onToggleMenu?: () => void; // Added for compatibility with App.tsx commonProps
  onAuthError?: () => void;
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
}

const PdfViewerContent: React.FC<PdfViewerContentProps> = ({ 
  accessToken, fileId, fileName, fileParents, onBack, originalBlob, setOriginalBlob, pdfDoc, pageDimensions, numPages, jumpToPageRef, onToggleNavigation, onToggleMenu,
  conflictDetected, isCheckingIntegrity, hasPageMismatch, resolveConflict, onAuthError
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

  // --- Session Persistence Logic (Auto-Save Page & Zoom) ---
  useEffect(() => {
    // Subscreve a mudanças na store para salvar estado da sessão
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

  // Sync Document Properties to Store
  useEffect(() => {
    setStoreNumPages(numPages);
  }, [numPages, setStoreNumPages]);

  useEffect(() => {
    if (pageDimensions) setStorePageDimensions(pageDimensions);
  }, [pageDimensions, setStorePageDimensions]);

  // Background fetch of page sizes
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
                // Fallback
                sizes.push(sizes.length > 0 ? sizes[sizes.length-1] : { width: 600, height: 800 });
            }
        }
        if (mounted) setStorePageSizes(sizes);
    };
    
    // Non-blocking
    setTimeout(fetchSizes, 100);
    return () => { mounted = false; };
  }, [pdfDoc, setStorePageSizes]);

  const numPagesStore = usePdfStore(state => state.numPages); // Used for UI display

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

  // Normalize navigation trigger (App uses onToggleMenu, internal uses onToggleNavigation)
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
    setIsOfflineAvailable 
  } = usePdfSaver({
    fileId, fileName, fileParents, accessToken, annotations, 
    currentBlobRef, originalBlob, 
    ocrToBurn: getUnburntOcrMap(), 
    docPageOffset: docPageOffset, 
    lensData,
    onUpdateOriginalBlob: setOriginalBlob,
    onOcrSaved: () => markOcrAsSaved(Object.keys(getUnburntOcrMap()).map(Number)),
    setHasUnsavedOcr
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
    selection.relativeRects.forEach((rect, index) => {
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

    selection.relativeRects.forEach(selRect => {
       pageAnns.forEach(ann => {
           if (ann.bbox && ann.bbox[2] > 0) { 
               const [ax, ay, aw, ah] = ann.bbox;
               const [sx, sy, sw, sh] = [selRect.x, selRect.y, selRect.width, selRect.height];
               const intersects = (ax < sx + sw) && (ax + aw > sx) && (ay < sy + sh) && (ax + aw > sx) && (ay < sy + sh) && (ax + aw > sx) && (ay < sy + sh) && (ax + aw > sx) && (ay + ah > sy);
               
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
      
      {/* Background Effect - Removed explicit black bg to allow theme gradient */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '40px 40px', backgroundPosition: '0 0' }} />
      <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-transparent via-bg/50 to-bg"/>
      
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

      {/* THE TACTICAL PULLER */}
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
        onClose={() => setSaveError(null)}
        onReconnect={() => { setSaveError(null); onAuthError?.(); }}
        onDownload={() => { handleSave('local'); setSaveError(null); }}
        onSaveCopy={() => { handleSave('copy'); setSaveError(null); }}
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
  const { fileId, fileBlob, accessToken, uid, onAuthError } = props;
  
  // UsePdfDocument é o HOOK GLOBAL que baixa o PDF e monta o objeto Proxy
  const { 
    pdfDoc, 
    originalBlob, 
    setOriginalBlob,
    numPages, 
    loading: docLoading, 
    error: docError,
    scale: initialScale,
    pageDimensions
  } = usePdfDocument({ fileId, fileBlob, accessToken, onAuthError });

  // Annotations Hook (Global Logic)
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
  } = usePdfAnnotations(fileId, uid, pdfDoc, originalBlob);

  const jumpToPageRef = useRef<((page: number) => void) | null>(null);

  // Restore Session (Page/Scale) from LocalStorage
  const savedSession = useMemo(() => {
      try {
          const item = localStorage.getItem(`lectorium_session_${fileId}`);
          return item ? JSON.parse(item) : null;
      } catch { return null; }
  }, [fileId]);

  if (docLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-bg text-text">
        <Loader2 size={40} className="animate-spin text-brand mb-4" />
        <p className="text-sm text-text-sec animate-pulse">Carregando documento...</p>
      </div>
    );
  }

  if (docError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-bg text-text p-6 text-center">
        <div className="bg-red-500/10 p-4 rounded-full mb-4 border border-red-500/20">
            <Lock size={32} className="text-red-500" />
        </div>
        <h3 className="text-xl font-bold mb-2">Erro ao abrir arquivo</h3>
        <p className="text-text-sec mb-6 max-w-md">{docError}</p>
        <button onClick={props.onBack} className="bg-surface border border-border hover:bg-white/5 px-6 py-2 rounded-full font-bold transition-colors">
            Voltar
        </button>
      </div>
    );
  }

  return (
    // PdfStoreProvider ISOLA o estado de UI (Página atual, Zoom, Ferramenta) para este componente
    // Inicializa com valores salvos se disponíveis, ou usa defaults da factory
    <PdfStoreProvider 
        initialPage={savedSession?.page} 
        initialScale={savedSession?.scale || initialScale}
    >
      <PdfProvider 
        initialScale={savedSession?.scale || initialScale}
        numPages={numPages}
        annotations={annotations}
        onAddAnnotation={addAnnotation}
        onRemoveAnnotation={removeAnnotation}
        onJumpToPage={(page: number) => jumpToPageRef.current?.(page)}
        accessToken={accessToken}
        fileId={fileId}
        pdfDoc={pdfDoc}
        currentBlob={originalBlob}
        onUpdateSourceBlob={setOriginalBlob}
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
        />
      </PdfProvider>
    </PdfStoreProvider>
  );
};

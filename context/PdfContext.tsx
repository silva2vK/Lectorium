
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Annotation, SemanticLensData, OcrMetrics } from '../types';
import { loadOcrData, saveOcrData } from '../services/storageService';
import { performFullPageOcr } from '../services/visionService';
import { translatePageImage, mapTranslationSegments } from '../services/translationService';
import { usePdfSelection, AnchorData } from '../hooks/usePdfSelection';
import { usePdfStore } from '../stores/usePdfStore';
import { mapSegmentsToWords } from '../services/backgroundOcrService';
import { indexDocumentForSearch } from '../services/ragService';
import { createSmartCanvas, smartCanvasToBlob } from '../utils/canvasUtils';
import { refineTranscript } from '../services/aiService';

export type ToolType = 'cursor' | 'brush' | 'note' | 'ink' | 'eraser';

interface PdfSettings {
  pageOffset: number;
  disableColorFilter: boolean;
  detectColumns: boolean;
  showConfidenceOverlay: boolean;
  pageColor: string;
  textColor: string;
  highlightColor: string;
  highlightOpacity: number;
  inkColor: string;
  inkStrokeWidth: number;
  inkOpacity: number;
  toolbarScale: number;
  toolbarYOffset: number;
}

interface PdfContextState {
  settings: PdfSettings;
  updateSettings: (newSettings: Partial<PdfSettings>) => void;
  annotations: Annotation[];
  addAnnotation: (ann: Annotation) => void;
  removeAnnotation: (ann: Annotation) => void;
  ocrMap: Record<number, any[]>;
  nativeTextMap: Record<number, string>; 
  setPageOcrData: (page: number, words: any[]) => void;
  showOcrModal: boolean;
  setShowOcrModal: (v: boolean) => void;
  hasUnsavedOcr: boolean;
  setHasUnsavedOcr: (val: boolean) => void;
  ocrNotification: string | null;
  accessToken?: string | null;
  fileId: string;
  updateSourceBlob: (newBlob: Blob) => void;
  currentBlobRef: React.MutableRefObject<Blob | null>;
  getUnburntOcrMap: () => Record<number, any[]>;
  markOcrAsSaved: (pages: number[]) => void;
  chatRequest: string | null;
  setChatRequest: (msg: string | null) => void;
  docPageOffset: number;
  setDocPageOffset: (offset: number) => void;
  selection: any;
  setSelection: (s: any) => void;
  onSmartTap: (t: HTMLElement) => void;
  anchorData: AnchorData | null;
  lensData: Record<number, SemanticLensData>;
  isLensLoading: boolean;
  lastOcrMetrics: OcrMetrics | null; 
  triggerSemanticLens: (page: number) => void;
  translationMap: Record<number, any[]>;
  triggerTranslation: (page: number) => void;
  isTranslationMode: boolean;
  toggleTranslationMode: () => void;
  setTranslationMode: (value: boolean) => void; // Added setter explicitamente
  numPages: number;
  generateSearchIndex: (text: string) => Promise<void>;
  ocrStatusMap: Record<number, string>;
  triggerOcr: (page: number) => void;
  updateOcrWord: (page: number, index: number, newText: string) => void;
  triggerRefinement: (page: number) => void;
}

const PdfContext = createContext<PdfContextState | null>(null);

export const usePdfContext = () => {
  const context = useContext(PdfContext);
  if (!context) throw new Error('usePdfContext must be used within a PdfProvider');
  return context;
};

export const useOptionalPdfContext = () => useContext(PdfContext);

const DEFAULT_SETTINGS: PdfSettings = {
  pageOffset: 1, disableColorFilter: false, detectColumns: false, showConfidenceOverlay: false,
  pageColor: "#ffffff", textColor: "#000000", highlightColor: "#4ade80", highlightOpacity: 0.4, 
  inkColor: "#a855f7", inkStrokeWidth: 42, inkOpacity: 0.35, toolbarScale: 1, toolbarYOffset: 0
};

export const PdfProvider: React.FC<any> = ({ 
  children, numPages, annotations, onAddAnnotation, onRemoveAnnotation, accessToken, fileId, pdfDoc,
  onUpdateSourceBlob, currentBlob, initialPageOffset, onSetPageOffset, initialScale, initialSemanticData
}) => {
  const activeTool = usePdfStore(s => s.activeTool);
  const scale = usePdfStore(s => s.scale);
  const setScale = usePdfStore(s => s.setScale);
  const currentPage = usePdfStore(s => s.currentPage);
  const setCurrentText = usePdfStore(s => s.setCurrentText);

  const [ocrMap, setOcrMap] = useState<Record<number, any[]>>({});
  const [nativeTextMap] = useState<Record<number, string>>({}); 
  const [hasUnsavedOcr, setHasUnsavedOcr] = useState(false);
  const [ocrNotification, setOcrNotificationState] = useState<string | null>(null);
  const notificationTimeoutRef = useRef<any>(null);
  const [chatRequest, setChatRequest] = useState<string | null>(null);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [lensData, setLensData] = useState<Record<number, SemanticLensData>>({});
  const [lastOcrMetrics, setLastOcrMetrics] = useState<OcrMetrics | null>(null);
  const [translationMap, setTranslationMap] = useState<Record<number, any[]>>({});
  const [isTranslationMode, setIsTranslationMode] = useState(false);
  const [ocrStatusMap, setOcrStatusMap] = useState<Record<number, string>>({});
  
  const currentBlobRef = useRef<Blob | null>(currentBlob);
  useEffect(() => { currentBlobRef.current = currentBlob; }, [currentBlob]);

  // Listener para OCR em Segundo Plano (Real-time Sync)
  useEffect(() => {
    const handleOcrReady = (e: any) => {
        const { fileId: eventFileId, page, words, markdown, metrics } = e.detail;
        if (eventFileId === fileId) {
            setOcrMap(prev => ({ ...prev, [page]: words }));
            if (markdown) {
                setLensData(prev => ({ ...prev, [page]: { markdown, processedAt: Date.now() } }));
            }
            if (metrics) {
                setLastOcrMetrics({ ...metrics, timestamp: Date.now() });
            }
        }
    };
    window.addEventListener('ocr-page-ready', handleOcrReady);
    return () => window.removeEventListener('ocr-page-ready', handleOcrReady);
  }, [fileId]);

  useEffect(() => {
    if (initialScale && initialScale > 0) setScale(initialScale);
  }, [initialScale]);

  // Sync Current Text to Store (for Split View / Extraction)
  useEffect(() => {
      const pageWords = ocrMap[currentPage];
      if (pageWords && pageWords.length > 0) {
          const text = pageWords.map(w => w.text).join(' ');
          setCurrentText(text);
      } else {
          setCurrentText("");
      }
  }, [currentPage, ocrMap, setCurrentText]);

  useEffect(() => {
      if (initialSemanticData && Object.keys(initialSemanticData).length > 0) {
          const loadedData: Record<number, SemanticLensData> = {};
          Object.entries(initialSemanticData).forEach(([page, markdown]) => {
              loadedData[parseInt(page)] = { markdown: markdown as string, processedAt: Date.now() };
          });
          setLensData(prev => ({ ...prev, ...loadedData }));
      }
  }, [initialSemanticData]);

  const [settings, setSettings] = useState<PdfSettings>(() => {
    let defaults = { ...DEFAULT_SETTINGS };
    
    // Check for active theme to set defaults
    try {
        if (typeof window !== 'undefined' && localStorage.getItem('app-theme') === 'maker') {
            defaults.highlightColor = '#3b82f6';
        }
    } catch (e) {}

    try {
        const saved = localStorage.getItem('pdf_tool_preferences');
        if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch (e) {}
    return defaults;
  });

  const { selection, setSelection, onSmartTap, anchorData } = usePdfSelection({ activeTool, scale });

  useEffect(() => {
    if (!fileId) return;
    loadOcrData(fileId).then(data => {
        if (!data) return;
        const loadedOcrMap: Record<number, any[]> = {};
        const loadedLensData: Record<number, SemanticLensData> = {};
        Object.entries(data).forEach(([pageStr, record]) => {
            const p = parseInt(pageStr);
            if (record.words) loadedOcrMap[p] = record.words;
            if (record.markdown) loadedLensData[p] = { markdown: record.markdown, processedAt: Date.now() };
        });
        setOcrMap(prev => ({ ...prev, ...loadedOcrMap }));
        setLensData(prev => ({ ...prev, ...loadedLensData }));
    });
  }, [fileId]);

  const showOcrNotification = useCallback((message: string, duration = 4000) => {
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    setOcrNotificationState(message);
    notificationTimeoutRef.current = setTimeout(() => setOcrNotificationState(null), duration);
  }, []);

  // --- MUTATIONS ---

  const semanticLensMutation = useMutation({
    mutationFn: async (pageNumber: number) => {
        if (!pdfDoc) throw new Error("Documento não carregado");
        
        const page = await pdfDoc.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1.0 });
        
        // IA-FRIENDLY RESOLUTION: 1536px largura é ideal para Gemini 3 Flash
        const TARGET_WIDTH = 1536; 
        const renderScale = TARGET_WIDTH / baseViewport.width;
        
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = createSmartCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d', { alpha: false }) as any;
        
        // "Clean Slate" Filter
        ctx.filter = 'grayscale(1) contrast(1.4) brightness(1.1)';
        
        await page.render({ canvasContext: ctx, viewport }).promise;

        const blob = await smartCanvasToBlob(canvas, 'image/jpeg', 0.7); 
        const base64 = await new Promise<string>(r => { 
          const reader = new FileReader(); 
          reader.onloadend = () => r((reader.result as string).split(',')[1]); 
          reader.readAsDataURL(blob); 
        });
        
        const { segments, metrics } = await performFullPageOcr(base64);
        const { data: mappedWords, markdown: reconstructedMarkdown } = await mapSegmentsToWords(segments, viewport.width, viewport.height, renderScale);

        return { pageNumber, mappedWords, reconstructedMarkdown, metrics };
    },
    onSuccess: (data) => {
        setLensData(prev => ({ ...prev, [data.pageNumber]: { markdown: data.reconstructedMarkdown, processedAt: Date.now() } }));
        setOcrMap(prev => ({ ...prev, [data.pageNumber]: data.mappedWords }));
        setHasUnsavedOcr(true);
        if (data.metrics) {
            setLastOcrMetrics({ ...data.metrics, timestamp: Date.now() });
        }
        
        // Side Effect: Save to IDB
        saveOcrData(fileId, data.pageNumber, data.mappedWords, data.reconstructedMarkdown);
        showOcrNotification("Processamento cirúrgico concluído.", 2000);
    },
    onError: (err: any) => {
        showOcrNotification(`Falha na análise: ${err.message}`, 6000);
    }
  });

  const refinementMutation = useMutation({
    mutationFn: async (pageNumber: number) => {
        const currentMarkdown = lensData[pageNumber]?.markdown;
        if (!currentMarkdown) throw new Error("Sem dados para refinar.");
        
        const refined = await refineTranscript(currentMarkdown);
        return { pageNumber, refined };
    },
    onSuccess: (data) => {
        setLensData(prev => ({ ...prev, [data.pageNumber]: { markdown: data.refined, processedAt: Date.now() } }));
        setHasUnsavedOcr(true);
        // Persistir a versão refinada
        // Mantemos os words originais (coordenadas) pois o refinamento é apenas textual
        saveOcrData(fileId, data.pageNumber, ocrMap[data.pageNumber] || [], data.refined);
        showOcrNotification("Texto reorganizado com sucesso!", 3000);
    },
    onError: (err: any) => {
        showOcrNotification(`Erro ao organizar: ${err.message}`);
    }
  });

  const translationMutation = useMutation({
    mutationFn: async (pageNumber: number) => {
        if (!pdfDoc) throw new Error("Documento não carregado");

        const page = await pdfDoc.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1.0 });
        const TARGET_WIDTH = 1536;
        const renderScale = TARGET_WIDTH / baseViewport.width;
        
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = createSmartCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d', { alpha: false }) as any;
        
        ctx.filter = 'contrast(1.2) brightness(1.05)';
        
        await page.render({ canvasContext: ctx, viewport }).promise;

        const blob = await smartCanvasToBlob(canvas, 'image/jpeg', 0.7);
        const base64 = await new Promise<string>(r => { 
          const reader = new FileReader(); 
          reader.onloadend = () => r((reader.result as string).split(',')[1]); 
          reader.readAsDataURL(blob); 
        });

        const { markdown, segments } = await translatePageImage(base64, "Portuguese");
        const translatedBlocks = mapTranslationSegments(segments, viewport.width, viewport.height, renderScale);

        return { pageNumber, markdown, translatedBlocks };
    },
    onSuccess: (data) => {
        setTranslationMap(prev => ({ ...prev, [data.pageNumber]: data.translatedBlocks }));
        setLensData(prev => ({ ...prev, [data.pageNumber]: { markdown: data.markdown, processedAt: Date.now() } }));
        setIsTranslationMode(true);
    },
    onError: (err: any) => {
        showOcrNotification(`Erro na tradução: ${err.message}`);
    }
  });

  const ragIndexMutation = useMutation({
    mutationFn: async (text: string) => {
        await indexDocumentForSearch(fileId, currentBlobRef.current!, text);
    }
  });

  // Derived Loading State
  const isLensLoading = semanticLensMutation.isPending || translationMutation.isPending || ragIndexMutation.isPending || refinementMutation.isPending;

  const value = useMemo(() => ({
    settings, updateSettings: (s: any) => setSettings(p => ({ ...p, ...s })), 
    annotations, addAnnotation: onAddAnnotation, removeAnnotation: onRemoveAnnotation,
    ocrMap, nativeTextMap, setPageOcrData: (p: any, w: any) => setOcrMap(prev => ({ ...prev, [p]: w })),
    showOcrModal, setShowOcrModal, hasUnsavedOcr, setHasUnsavedOcr, ocrNotification,
    accessToken, fileId, updateSourceBlob: onUpdateSourceBlob, currentBlobRef, 
    markOcrAsSaved: () => setHasUnsavedOcr(false), getUnburntOcrMap: () => ocrMap,
    chatRequest, setChatRequest, docPageOffset: initialPageOffset, setDocPageOffset: onSetPageOffset,
    selection, setSelection, onSmartTap, anchorData,
    lensData, isLensLoading, 
    triggerSemanticLens: semanticLensMutation.mutate, 
    triggerRefinement: refinementMutation.mutate,
    lastOcrMetrics,
    translationMap, 
    triggerTranslation: translationMutation.mutate, 
    isTranslationMode, 
    toggleTranslationMode: () => setIsTranslationMode(!isTranslationMode),
    setTranslationMode: (val: boolean) => setIsTranslationMode(val),
    numPages, 
    generateSearchIndex: async (text: string) => { await ragIndexMutation.mutateAsync(text); },
    ocrStatusMap, 
    triggerOcr: async (p: number) => {
        setOcrStatusMap(v => ({...v, [p]: 'processing'}));
        // We use mutateAsync here to wait for completion inside this helper
        await semanticLensMutation.mutateAsync(p);
        setOcrStatusMap(v => ({...v, [p]: 'done'}));
    },
    updateOcrWord: (p: number, i: number, txt: string) => {
        setOcrMap(prev => {
            const next = prev[p] ? [...prev[p]] : [];
            if (next[i]) next[i] = { ...next[i], text: txt, confidence: 100 };
            return { ...prev, [p]: next };
        });
        setHasUnsavedOcr(true);
    }
  }), [settings, annotations, ocrMap, nativeTextMap, showOcrModal, hasUnsavedOcr, ocrNotification, accessToken, fileId, chatRequest, selection, anchorData, lensData, isLensLoading, lastOcrMetrics, translationMap, isTranslationMode, numPages, initialPageOffset, onSetPageOffset, ocrStatusMap, semanticLensMutation, translationMutation, ragIndexMutation, refinementMutation]);

  return <PdfContext.Provider value={value}>{children}</PdfContext.Provider>;
};


import React, { useRef, useState, useEffect, useMemo } from 'react';
import { CheckCircle2, ScanLine } from 'lucide-react';
import { NoteMarker } from './NoteMarker';
import { usePdfContext } from '../../context/PdfContext';
import { usePdfStore } from '../../stores/usePdfStore'; 
import { PDFDocumentProxy } from 'pdfjs-dist';
import { BaseModal } from '../shared/BaseModal';
import { PdfCanvasLayer } from './layers/PdfCanvasLayer';
import { PdfInkLayer } from './layers/PdfInkLayer';
import { PdfTextLayer } from './layers/PdfTextLayer';
import { usePdfInput } from '../../hooks/usePdfInput';
import { ConfidenceWord } from './ConfidenceWord';

interface PdfPageProps {
  pageNumber: number;
  filterValues: string;
  pdfDoc?: PDFDocumentProxy | null;
}

export const PdfPage: React.FC<PdfPageProps> = React.memo(({ pageNumber, filterValues, pdfDoc }) => {
  const scale = usePdfStore(state => state.scale);
  const currentPage = usePdfStore(state => state.currentPage); // Consumindo currentPage para Priority Rendering
  const activeTool = usePdfStore(state => state.activeTool);
  const setIsSpread = usePdfStore(state => state.setIsSpread);
  const spreadSide = usePdfStore(state => state.spreadSide);
  
  const { 
    settings, annotations, addAnnotation, removeAnnotation,
    ocrMap, updateOcrWord, onSmartTap, selection, anchorData,
    fileId, translationMap, isTranslationMode
  } = usePdfContext();

  const activeInkCanvasRef = useRef<HTMLCanvasElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [rendered, setRendered] = useState(false);
  const [hasText, setHasText] = useState(true); 
  const [isVisible, setIsVisible] = useState(false);
  const [pageProxy, setPageProxy] = useState<any>(null);
  
  const ocrData = ocrMap[pageNumber] || [];
  const translationData = translationMap[pageNumber] || [];

  // Priority Rendering Logic: Se for a página atual, força visibilidade total.
  // Caso contrário, permite que o Chrome otimize (content-visibility: auto).
  const isPageActive = pageNumber === currentPage;

  useEffect(() => {
    const el = pageContainerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { rootMargin: '50% 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!pdfDoc) return;
    let active = true;
    pdfDoc.getPage(pageNumber).then(p => { if (active) setPageProxy(p); });
    return () => { active = false; };
  }, [pdfDoc, pageNumber]);

  const pageDimensions = useMemo(() => {
    if (!pageProxy) return null;
    const vp = pageProxy.getViewport({ scale });
    return { width: vp.width, height: vp.height };
  }, [pageProxy, scale]);

  useEffect(() => {
    if (pageDimensions) setIsSpread(pageDimensions.width > pageDimensions.height * 1.1);
  }, [pageDimensions, setIsSpread]);

  const isSplitActive = settings.detectColumns && (pageDimensions?.width > pageDimensions?.height * 1.1);

  const { handlePointerDown, handlePointerMove, handlePointerUp, brushSelection, draftNote, setDraftNote } = usePdfInput({
      pageNumber, 
      scale, 
      activeTool, 
      settings, 
      pageContainerRef, 
      activeInkCanvasRef, 
      pageDimensions, 
      addAnnotation, 
      removeAnnotation, // Passado para o hook
      annotations,      // Passado para o hook
      onSmartTap
  });

  useEffect(() => {
    if (draftNote && draftTextareaRef.current) {
        setTimeout(() => draftTextareaRef.current?.focus({ preventScroll: true }), 50);
    }
  }, [draftNote]);

  const outerWidth = isSplitActive ? (pageDimensions?.width || 800) / 2 : (pageDimensions?.width || 800);
  const innerTransform = isSplitActive ? `translateX(${spreadSide === 'right' ? '-50%' : '0'})` : 'none';
  const pageAnnotations = annotations.filter(a => a.page === pageNumber);

  return (
    <div 
        className={`pdf-page-wrapper mx-auto mb-8 relative bg-[#18181b] border border-[#333] shadow-2xl ${isPageActive ? '' : 'native-page-contain'}`} 
        style={{ 
            width: outerWidth, 
            height: pageDimensions?.height || 1100, 
            overflow: 'hidden',
            containIntrinsicSize: `auto ${pageDimensions?.height || 1100}px` 
        }}
    >
        <div 
            ref={pageContainerRef}
            className={`pdf-page relative transition-transform duration-300 ease-out origin-top-left bg-white ${activeTool === 'cursor' ? 'select-text' : 'select-none'}`}
            style={{ width: pageDimensions?.width || 800, height: pageDimensions?.height || 1100, transform: innerTransform, touchAction: (activeTool === 'brush' || activeTool === 'ink' || activeTool === 'eraser') ? 'none' : 'pan-x pan-y' }}
            data-page-number={pageNumber}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        >
            {!hasText && rendered && isVisible && !isTranslationMode && (
                <div className="absolute top-4 left-4 flex items-center gap-2 text-xs bg-black/80 text-brand px-4 py-2 rounded-full z-[100] border border-white/10 animate-in fade-in">
                    {ocrData.length > 0 ? <><CheckCircle2 size={16}/><span>Leitura Concluída</span></> : <><ScanLine size={16}/><span>Use Lente Semântica</span></>}
                </div>
            )}

            <PdfCanvasLayer pageProxy={pageProxy} scale={scale} isVisible={isVisible} pageNumber={pageNumber} fileId={fileId} pageColor={settings.pageColor} disableColorFilter={settings.disableColorFilter} width={pageDimensions?.width || 800} height={pageDimensions?.height || 1100} onRendered={() => setRendered(true)} />
            <PdfInkLayer annotations={annotations} pageNumber={pageNumber} scale={scale} width={pageDimensions?.width || 800} height={pageDimensions?.height || 1100} />
            <canvas ref={activeInkCanvasRef} className="absolute top-0 left-0 pointer-events-none z-[36]" />

            {settings.showConfidenceOverlay && ocrData.length > 0 && rendered && (
                <div className="absolute inset-0 z-20 pointer-events-none">
                    {ocrData.filter(w => !isSplitActive || w.column === (spreadSide === 'right' ? 1 : 0)).map((w, i) => (
                        <ConfidenceWord key={i} word={w} scale={scale} wordIndex={i} onCorrect={(idx, txt) => updateOcrWord(pageNumber, idx, txt)} />
                    ))}
                </div>
            )}

            {brushSelection && (
                <div 
                    className="absolute z-[35] pointer-events-none mix-blend-multiply"
                    style={{
                        left: Math.min(brushSelection.start.x, brushSelection.current.x) * scale,
                        top: Math.min(brushSelection.start.y, brushSelection.current.y) * scale,
                        width: Math.abs(brushSelection.current.x - brushSelection.start.x) * scale,
                        height: Math.abs(brushSelection.current.y - brushSelection.start.y) * scale,
                        backgroundColor: settings.highlightColor,
                        opacity: settings.highlightOpacity,
                        border: `1px solid ${settings.highlightColor}`
                    }}
                />
            )}

            <div className="absolute inset-0 pointer-events-none z-40">
                {pageAnnotations.filter(a => a.type === 'highlight' && !a.isBurned).map((a, i) => (
                    <div key={a.id || i} className="absolute mix-blend-multiply" style={{ left: a.bbox[0] * scale, top: a.bbox[1] * scale, width: a.bbox[2] * scale, height: a.bbox[3] * scale, backgroundColor: a.color, opacity: a.opacity }} />
                ))}
                {pageAnnotations.filter(a => a.type === 'note' && !a.isBurned).map((a, i) => (
                    <NoteMarker key={a.id || i} ann={a} scale={scale} activeTool={activeTool} onDelete={removeAnnotation} />
                ))}
            </div>

            <PdfTextLayer 
                pageProxy={pageProxy} 
                scale={scale} 
                isVisible={isVisible} 
                pageNumber={pageNumber} 
                ocrData={isTranslationMode ? translationData : ocrData} 
                isTranslationMode={isTranslationMode} 
                rendered={rendered} 
                activeTool={activeTool} 
                detectColumns={settings.detectColumns} 
                width={pageDimensions?.width || 800} 
                height={pageDimensions?.height || 1100} 
                spreadSide={spreadSide} 
                isSplitActive={isSplitActive} 
                anchorData={anchorData} 
                selection={selection} 
                onHasText={setHasText} 
                highlightColor={settings.highlightColor}
            />

            {draftNote && (
                <div className="absolute z-50 bg-yellow-100 p-3 rounded-lg border border-yellow-300 shadow-xl" style={{ left: draftNote.x * scale, top: draftNote.y * scale }}>
                    <textarea ref={draftTextareaRef} autoFocus className="bg-transparent border-none outline-none text-sm text-yellow-900 resize-none w-48 h-24" placeholder="Nota..." onKeyDown={e => { 
                        if (e.key === 'Enter' && !e.shiftKey) {
                            if (e.currentTarget.value.trim()) addAnnotation({ id: `note-${Date.now()}`, page: pageNumber, bbox: [draftNote.x, draftNote.y, 0, 0], type: 'note', text: e.currentTarget.value, color: '#fef9c3', createdAt: new Date().toISOString() }); 
                            setDraftNote(null);
                        } 
                        if (e.key === 'Escape') setDraftNote(null); 
                    }} />
                </div>
            )}
        </div>
    </div>
  );
});

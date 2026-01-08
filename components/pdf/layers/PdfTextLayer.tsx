
import React, { useRef, useEffect, useCallback } from 'react';
import { PDFPageProxy } from 'pdfjs-dist';
import { renderCustomTextLayer } from '../../../utils/pdfRenderUtils';
import { AnchorData, ExtendedSelectionState } from '../../../hooks/usePdfSelection';

interface PdfTextLayerProps {
    pageProxy: PDFPageProxy | null;
    scale: number;
    isVisible: boolean;
    pageNumber: number;
    ocrData: any[];
    isTranslationMode: boolean;
    rendered: boolean;
    activeTool: string;
    detectColumns: boolean;
    width: number;
    height: number;
    spreadSide?: 'left' | 'right';
    isSplitActive: boolean;
    anchorData: AnchorData | null;
    selection?: ExtendedSelectionState | null; 
    onHasText: (hasText: boolean) => void;
    highlightColor: string; // Nova prop
}

export const PdfTextLayer: React.FC<PdfTextLayerProps> = React.memo(({
    pageProxy, scale, isVisible, pageNumber, ocrData, isTranslationMode,
    rendered, activeTool, detectColumns, width, height, spreadSide, isSplitActive, anchorData, selection, onHasText,
    highlightColor // Recebida aqui
}) => {
    const textLayerRef = useRef<HTMLDivElement>(null);
    const lastInjectedOcrRef = useRef<string>("");
    const renderRequestRef = useRef<number | null>(null);

    // Função centralizada para aplicar a âncora visual e o marcador de destino
    const updateVisualMarkers = useCallback(() => {
        const container = textLayerRef.current;
        if (!container) return;

        // Limpa marcadores antigos E estilos inline
        container.querySelectorAll('.selection-anchor, .selection-end, .selection-preview').forEach(el => {
            el.classList.remove('selection-anchor', 'selection-end', 'selection-preview');
            const span = el as HTMLElement;
            span.style.backgroundColor = '';
            span.style.borderBottomColor = '';
            span.style.opacity = ''; // Reset
        });

        const allSpans = container.querySelectorAll('span');

        // Se já existe uma seleção completa (Início e Fim definidos), pintamos o intervalo.
        if (selection && selection.page === pageNumber && selection.startIndex !== undefined && selection.endIndex !== undefined) {
            const start = Math.min(selection.startIndex, selection.endIndex);
            const end = Math.max(selection.startIndex, selection.endIndex);

            for (let i = start; i <= end; i++) {
                const span = allSpans[i];
                if (span) {
                    span.classList.add('selection-preview');
                    // Aplica a cor do marcador escolhida pelo usuário
                    span.style.backgroundColor = highlightColor;
                }
            }
            return;
        }

        // Se não há seleção completa, desenha apenas a âncora (Primeiro Clique do Smart Tap)
        if (anchorData && anchorData.page === pageNumber) {
            const startSpan = allSpans[anchorData.index];
            if (startSpan) {
                startSpan.classList.add('selection-anchor');
                // Aplica a cor do marcador à borda e fundo da âncora
                startSpan.style.borderBottomColor = highlightColor;
                startSpan.style.backgroundColor = highlightColor;
                // A opacidade é controlada pelo CSS para dar o efeito visual correto
            }
        }
    }, [anchorData, selection, pageNumber, highlightColor]); // Depende agora de highlightColor

    // Sincroniza marcadores quando o estado muda
    useEffect(() => {
        updateVisualMarkers();
    }, [anchorData, selection, pageNumber, updateVisualMarkers]);

    useEffect(() => {
        if (!rendered || !isVisible || !pageProxy || !textLayerRef.current) return;
        
        if (ocrData && ocrData.length > 0) {
            onHasText(false);
            return; 
        }

        let active = true;
        const processNativeText = async () => {
            try {
                const viewport = pageProxy.getViewport({ scale });
                const textContent = await pageProxy.getTextContent();
                if (!active) return;
                
                const fullText = textContent.items.map((i: any) => i.str).join('');
                onHasText(fullText.length > 10);

                if (textLayerRef.current) {
                    textLayerRef.current.innerHTML = '';
                    renderCustomTextLayer(textContent, textLayerRef.current, viewport, detectColumns);
                    updateVisualMarkers();
                }
            } catch(e) {}
        };
        processNativeText();
        return () => { active = false; };
    }, [rendered, isVisible, pageProxy, scale, ocrData, detectColumns, pageNumber, onHasText, updateVisualMarkers]);

    useEffect(() => {
        if (renderRequestRef.current) {
            cancelAnimationFrame(renderRequestRef.current);
            renderRequestRef.current = null;
        }

        if (ocrData && ocrData.length > 0 && textLayerRef.current && rendered) {
            const sideKey = isSplitActive ? spreadSide : 'full';
            const dataHash = `v20-${isTranslationMode}-${pageNumber}-${ocrData.length}-${scale}-${sideKey}`;
            
            if (lastInjectedOcrRef.current === dataHash) {
                updateVisualMarkers();
                return;
            }

            const container = textLayerRef.current;
            container.innerHTML = '';
            
            const visibleWords = (isSplitActive && !isTranslationMode)
                ? ocrData.filter(w => w.column === (spreadSide === 'right' ? 1 : 0))
                : ocrData;

            const totalWords = visibleWords.length;
            const CHUNK_SIZE = 400;
            let currentIdx = 0;

            const renderChunk = () => {
                const end = Math.min(currentIdx + CHUNK_SIZE, totalWords);
                let html = '';

                for (let i = currentIdx; i < end; i++) {
                    const w = visibleWords[i];
                    const x = w.bbox.x0 * scale;
                    const y = w.bbox.y0 * scale;
                    const widthPx = (w.bbox.x1 - w.bbox.x0) * scale;
                    const heightPx = (w.bbox.y1 - w.bbox.y0) * scale;

                    let st = `left:${x}px;top:${y}px;width:${widthPx}px;height:${heightPx}px;`;
                    if (isTranslationMode) {
                        st += `position:absolute;color:#fff;background:rgba(0,0,0,0.8);font-size:${heightPx*0.8}px;display:flex;align-items:center;justify-content:center;`;
                    } else {
                        st += `position:absolute;color:transparent;font-size:${heightPx*0.8}px;`;
                    }

                    html += `<span class="ocr-word-span" style="${st}" data-pdf-x="${x}" data-pdf-top="${y}" data-pdf-width="${widthPx}" data-pdf-height="${heightPx}">${w.text || ''}</span>`;
                }

                container.insertAdjacentHTML('beforeend', html);
                currentIdx = end;

                if (currentIdx < totalWords) {
                    renderRequestRef.current = requestAnimationFrame(renderChunk);
                } else {
                    renderRequestRef.current = null;
                    lastInjectedOcrRef.current = dataHash;
                    updateVisualMarkers();
                }
            };
            renderRequestRef.current = requestAnimationFrame(renderChunk);
        }
    }, [ocrData, rendered, scale, pageNumber, spreadSide, isSplitActive, isTranslationMode, updateVisualMarkers]);

    useEffect(() => () => { if (renderRequestRef.current) cancelAnimationFrame(renderRequestRef.current); }, []);

    return (
        <div 
            ref={textLayerRef} 
            className="textLayer notranslate" 
            style={{ 
                zIndex: isTranslationMode ? 45 : 30, 
                pointerEvents: activeTool === 'cursor' ? 'auto' : 'none', 
                visibility: isVisible ? 'visible' : 'hidden',
                width: `${width}px`,
                height: `${height}px`
            }} 
        />
    );
});

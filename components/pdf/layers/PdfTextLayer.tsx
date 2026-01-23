
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

        // Limpa marcadores antigos E estilos inline DE SELEÇÃO APENAS
        // Preserva o background original se for tradução
        container.querySelectorAll('.selection-anchor, .selection-end, .selection-preview').forEach(el => {
            el.classList.remove('selection-anchor', 'selection-end', 'selection-preview');
            const span = el as HTMLElement;
            // Se estiver em modo tradução, NÃO removemos o background preto
            if (!isTranslationMode) {
                span.style.backgroundColor = '';
            } else {
                // Em modo tradução, removemos apenas a borda de seleção
                span.style.borderColor = 'transparent';
                span.style.borderWidth = '0';
            }
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
                    
                    if (isTranslationMode) {
                        // Em modo tradução, usamos borda colorida para não matar o fundo preto
                        span.style.borderColor = highlightColor;
                        span.style.borderWidth = '2px';
                        span.style.borderStyle = 'solid';
                        span.style.boxSizing = 'border-box';
                    } else {
                        // Aplica a cor do marcador escolhida pelo usuário (fundo tradicional)
                        span.style.backgroundColor = highlightColor;
                    }
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
                
                if (!isTranslationMode) {
                    startSpan.style.backgroundColor = highlightColor;
                } else {
                    // No modo tradução, apenas borda inferior forte
                    startSpan.style.borderBottomWidth = '4px';
                }
                // A opacidade é controlada pelo CSS para dar o efeito visual correto
            }
        }
    }, [anchorData, selection, pageNumber, highlightColor, isTranslationMode]); 

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
            const dataHash = `v21-${isTranslationMode}-${pageNumber}-${ocrData.length}-${scale}-${sideKey}`;
            
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
                        const text = w.text || '';
                        // Lógica "Lens": Cálculo dinâmico de fonte para caber no bloco
                        const area = widthPx * heightPx;
                        const len = text.length || 1;
                        
                        // Heurística de Área: FontSize ~= sqrt(Area / (Chars * 0.6))
                        // 0.6 é uma constante de aspecto média de fontes (Width/Height)
                        const areaFontSize = Math.sqrt(area / (len * 0.6));
                        
                        // Heurística de Altura: Considera quebras de linha
                        const lines = text.split('\n').length;
                        // Se não tem quebras explícitas, estima wrapping
                        const estimatedLines = lines > 1 ? lines : Math.max(1, Math.ceil((text.length * areaFontSize * 0.6) / widthPx));
                        
                        const heightFontSize = (heightPx / estimatedLines) * 0.85;
                        
                        // Escolhe o menor (Fit Inside) e aplica clamps
                        let finalFontSize = Math.min(areaFontSize, heightFontSize);
                        finalFontSize = Math.max(9, Math.min(finalFontSize, 48)); // Min 9px, Max 48px para não explodir

                        st += `
                            position: absolute;
                            color: #ffffff;
                            background-color: rgba(20, 20, 20, 0.92) !important; /* Blindagem contra override */
                            backdrop-filter: blur(2px);
                            border-radius: 3px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            text-align: center;
                            font-family: 'Inter', system-ui, sans-serif;
                            font-weight: 500;
                            white-space: pre-wrap;
                            overflow: hidden;
                            line-height: 1.15;
                            padding: 2px 4px;
                            box-sizing: border-box;
                            z-index: 50;
                            font-size: ${finalFontSize}px;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                            -webkit-tap-highlight-color: transparent; /* Remove flash azul no mobile */
                            user-select: text; /* Garante que o texto dentro seja selecionável */
                        `;
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

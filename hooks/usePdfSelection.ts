
import { useState, useCallback, useEffect } from 'react';
import { SelectionState } from '../components/pdf/SelectionMenu';

// Estendendo o SelectionState localmente para incluir os índices do DOM
export interface ExtendedSelectionState extends SelectionState {
    startIndex?: number;
    endIndex?: number;
}

interface UsePdfSelectionProps {
  activeTool: string;
  scale: number;
}

export interface AnchorData {
    page: number;
    index: number; 
}

export const usePdfSelection = ({ activeTool, scale }: UsePdfSelectionProps) => {
  const [selection, setSelection] = useState<ExtendedSelectionState | null>(null);
  const [anchorData, setAnchorData] = useState<AnchorData | null>(null);

  useEffect(() => {
    if (!selection) {
        setAnchorData(null);
    }
  }, [selection]);

  useEffect(() => {
    setSelection(null); 
  }, [activeTool]);

  const calculateGeometry = useCallback((spans: HTMLElement[], startIndex: number, endIndex: number, pageNum: number) => {
      const first = Math.min(startIndex, endIndex);
      const last = Math.max(startIndex, endIndex);
      const selectedSpans = spans.slice(first, last + 1);
      
      // FIX: Join com espaço para evitar palavras coladas (Noçõesdetempo -> Noções de tempo)
      // O replace(/\s+/g, ' ') garante que se já houver espaços (PDF nativo), eles não sejam duplicados excessivamente.
      const fullText = selectedSpans
        .map(s => s.textContent || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      const relativeRects: { x: number; y: number; width: number; height: number }[] = [];
      
      selectedSpans.forEach(span => {
          const pdfX = parseFloat(span.dataset.pdfX || '0');
          const pdfTop = parseFloat(span.dataset.pdfTop || '0');
          const pdfW = parseFloat(span.dataset.pdfWidth || '0');
          const pdfH = parseFloat(span.dataset.pdfHeight || '0');

          if (pdfW > 0) {
              relativeRects.push({
                  x: pdfX / scale,
                  y: pdfTop / scale,
                  width: pdfW / scale,
                  height: pdfH / scale
              });
          }
      });

      if (relativeRects.length === 0) return null;

      return {
        page: pageNum,
        text: fullText,
        popupX: 0, 
        popupY: 0,
        relativeRects,
        position: 'bottom',
        startIndex,
        endIndex
      };
  }, [scale]);

  const onSmartTap = useCallback((target: HTMLElement) => {
      if (activeTool !== 'cursor') return;
      
      const isTextNode = target.tagName === 'SPAN' && (target.parentElement?.classList.contains('textLayer') || target.classList.contains('ocr-word-span'));
      if (!isTextNode) return;

      const pageElement = target.closest('.pdf-page, [data-page-number]');
      if (!pageElement) return;
      const pageNum = parseInt(pageElement.getAttribute('data-page-number') || '1');
      const textLayer = target.parentElement;
      if (!textLayer) return;
      
      const allSpans = Array.from(textLayer.querySelectorAll('span')) as HTMLElement[];
      const targetIndex = allSpans.indexOf(target);
      if (targetIndex === -1) return;

      if (!anchorData || anchorData.page !== pageNum) {
          setAnchorData({ page: pageNum, index: targetIndex });
          const menuState = calculateGeometry(allSpans, targetIndex, targetIndex, pageNum);
          if (menuState) setSelection(menuState as ExtendedSelectionState);
      } else {
          // Segundo clique: fecha a seleção
          const menuState = calculateGeometry(allSpans, anchorData.index, targetIndex, pageNum);
          if (menuState) setSelection(menuState as ExtendedSelectionState);
      }
  }, [activeTool, anchorData, calculateGeometry]);

  return { selection, setSelection, onSmartTap, anchorData };
};

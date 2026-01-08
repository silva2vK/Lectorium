
import { useEffect, useRef } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { bitmapCache } from '../services/bitmapCacheService';
import { scheduleWork, cancelWork } from '../utils/scheduler';

interface UsePdfPreloaderProps {
  pdfDoc: PDFDocumentProxy | null;
  currentPage: number;
  scale: number;
  fileId: string;
}

export const usePdfPreloader = ({ pdfDoc, currentPage, scale, fileId }: UsePdfPreloaderProps) => {
  const currentTaskRef = useRef<number | null>(null);

  useEffect(() => {
    if (!pdfDoc || !fileId) return;

    // Cancela pré-carregamento anterior se a página mudou rápido demais
    if (currentTaskRef.current) {
        cancelWork(currentTaskRef.current);
    }

    const preloadAdjacentPages = async (deadline: { timeRemaining: () => number }) => {
        // Define quais páginas pré-carregar (Próxima e Anterior)
        const pagesToPreload = [];
        if (currentPage < pdfDoc.numPages) pagesToPreload.push(currentPage + 1);
        if (currentPage > 1) pagesToPreload.push(currentPage - 1);

        for (const pageNum of pagesToPreload) {
            // Se o tempo ocioso acabar, pare e aguarde o próximo frame
            if (deadline.timeRemaining() < 1) break;

            const cacheKey = `${fileId}-p${pageNum}-s${scale.toFixed(2)}`;
            
            // Se já está no cache, ignora
            if (bitmapCache.has(cacheKey)) continue;

            try {
                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale });
                
                // Limita densidade de pixels para background tasks (economia de bateria)
                const dpr = Math.min(window.devicePixelRatio || 1, 1.5); 
                const width = Math.floor(viewport.width * dpr);
                const height = Math.floor(viewport.height * dpr);

                const canvas = new OffscreenCanvas(width, height);
                const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false }) as any;

                if (ctx) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, width, height);
                    ctx.scale(dpr, dpr);

                    await page.render({ canvasContext: ctx, viewport }).promise;
                    
                    const bitmap = await canvas.transferToImageBitmap();
                    bitmapCache.set(cacheKey, bitmap);
                    console.debug(`[Preloader] Página ${pageNum} pronta na memória.`);
                }
            } catch (e) {
                // Silently fail for preload operations
            }
        }
    };

    // Agenda a tarefa para quando o navegador estiver ocioso (não trava a UI)
    currentTaskRef.current = scheduleWork(preloadAdjacentPages, { timeout: 2000 });

    return () => {
        if (currentTaskRef.current) cancelWork(currentTaskRef.current);
    };
  }, [pdfDoc, currentPage, scale, fileId]);
};

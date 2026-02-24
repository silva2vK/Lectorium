
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

        // Limita densidade de pixels para background tasks (economia de bateria e memória)
        const PRELOAD_DPR = 1.5;

        for (const pageNum of pagesToPreload) {
            // Se o tempo ocioso acabar, pare e aguarde o próximo frame
            if (deadline.timeRemaining() < 1) break;

            // FIX: Inclui DPR na chave para diferenciar do render principal (High Quality)
            const cacheKey = `${fileId}-p${pageNum}-s${scale.toFixed(2)}-d${PRELOAD_DPR}`;
            
            // Se já está no cache, ignora
            if (bitmapCache.has(cacheKey)) continue;

            try {
                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale });
                
                const width = Math.floor(viewport.width * PRELOAD_DPR);
                const height = Math.floor(viewport.height * PRELOAD_DPR);

                let canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
                let ctx: any = null;
                let isOffscreen = false;

                // Tentativa 1: OffscreenCanvas
                if (typeof OffscreenCanvas !== 'undefined') {
                    try {
                        canvas = new OffscreenCanvas(width, height);
                        ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
                        isOffscreen = true;
                    } catch (e) {
                        console.warn("[Preloader] OffscreenCanvas falhou, usando DOM Canvas", e);
                    }
                }

                // Tentativa 2: DOM Canvas (Fallback)
                if (!isOffscreen || !ctx) {
                    canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
                    isOffscreen = false;
                }

                if (ctx && canvas) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, width, height);
                    ctx.scale(PRELOAD_DPR, PRELOAD_DPR);

                    await page.render({ canvasContext: ctx, viewport }).promise;
                    
                    let bitmap: ImageBitmap;
                    if (isOffscreen && 'transferToImageBitmap' in canvas) {
                        bitmap = (canvas as OffscreenCanvas).transferToImageBitmap();
                    } else {
                        bitmap = await createImageBitmap(canvas as HTMLCanvasElement);
                    }
                    
                    bitmapCache.set(cacheKey, bitmap);
                    console.debug(`[Preloader] Página ${pageNum} pronta na memória (DPR ${PRELOAD_DPR}).`);
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

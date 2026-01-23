
import React, { useRef, useEffect } from 'react';
import { PDFPageProxy } from 'pdfjs-dist';
import { bitmapCache } from '../../../services/bitmapCacheService';

interface PdfCanvasLayerProps {
  pageProxy: PDFPageProxy | null;
  scale: number;
  isVisible: boolean;
  pageNumber: number;
  fileId: string;
  pageColor: string;
  disableColorFilter: boolean;
  width: number;
  height: number;
  onRendered: () => void;
}

export const PdfCanvasLayer: React.FC<PdfCanvasLayerProps> = React.memo(({
  pageProxy, scale, isVisible, pageNumber, fileId, pageColor, disableColorFilter, width, height, onRendered
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  
  // Constantes de DPR
  const nativeDpr = window.devicePixelRatio || 1;
  const activeDpr = Math.min(nativeDpr, 2.0); // Qualidade Alta (Capped)
  const preloadDpr = 1.5; // Qualidade Média (Preloader)

  // Chaves de Cache Distintas
  const exactKey = `${fileId}-p${pageNumber}-s${scale.toFixed(2)}-d${activeDpr}`;
  const preloadKey = `${fileId}-p${pageNumber}-s${scale.toFixed(2)}-d${preloadDpr}`;

  useEffect(() => {
    if (!isVisible || !pageProxy || !canvasRef.current) return;
    let active = true;
    
    const render = async () => {
      try {
        const viewport = pageProxy.getViewport({ scale: scale });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
        if (!ctx) return;
        
        if (renderTaskRef.current) try { renderTaskRef.current.cancel(); } catch {}

        const targetWidth = Math.floor(viewport.width * activeDpr);
        const targetHeight = Math.floor(viewport.height * activeDpr);
        
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
        }
        
        // 1. Tenta recuperar a versão HD exata
        const cachedBitmap = bitmapCache.get(exactKey);
        
        if (cachedBitmap) {
            ctx.drawImage(cachedBitmap, 0, 0, targetWidth, targetHeight);
            if (active) onRendered();
        } else {
            // 2. Fallback Progressivo: Se não tem HD, desenha o que tiver para feedback instantâneo
            
            // Tenta o Preload (mesma escala, DPR menor) - Isso evita o flash branco!
            const preloadBitmap = bitmapCache.get(preloadKey);
            
            if (preloadBitmap) {
                // Desenha a versão pré-carregada esticada (pode ficar levemente blurry por instantes)
                ctx.drawImage(preloadBitmap, 0, 0, targetWidth, targetHeight);
            } else {
                // Tenta qualquer outra escala (Zoom)
                const nearestBitmap = bitmapCache.findNearest(fileId, pageNumber);
                if (nearestBitmap) {
                    ctx.drawImage(nearestBitmap, 0, 0, targetWidth, targetHeight);
                } else {
                    // Último caso: fundo sólido
                    ctx.fillStyle = pageColor || '#ffffff';
                    ctx.fillRect(0, 0, targetWidth, targetHeight);
                }
            }

            // 3. Renderiza a versão HD
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(activeDpr, activeDpr);

            const task = pageProxy.render({ canvasContext: ctx, viewport });
            renderTaskRef.current = task;
            await task.promise;
            
            if (renderTaskRef.current !== task || !active) return;

            // Salva o resultado HD no cache com a chave correta
            createImageBitmap(canvas).then(bitmap => {
                if (active) bitmapCache.set(exactKey, bitmap);
                else bitmap.close();
            });

            if (active) onRendered();
        }

      } catch (e: any) { 
          if (e?.name !== 'RenderingCancelledException') console.error(e); 
      }
    };
    
    render();
    
    return () => { 
        active = false; 
        if (renderTaskRef.current) try { renderTaskRef.current.cancel(); } catch {}
    };
  }, [pageProxy, scale, isVisible, pageColor, exactKey, preloadKey, width, height, activeDpr]);

  return (
    <canvas 
        ref={canvasRef} 
        className="select-none absolute top-0 left-0" 
        style={{ 
            filter: disableColorFilter ? 'none' : 'url(#pdf-recolor)', 
            display: 'block', 
            visibility: isVisible ? 'visible' : 'hidden', 
            zIndex: 5,
            width: `${width}px`,
            height: `${height}px`
        }} 
    />
  );
});

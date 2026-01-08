
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
  const cacheKey = `${fileId}-p${pageNumber}-s${scale.toFixed(2)}`;

  useEffect(() => {
    if (!isVisible || !pageProxy || !canvasRef.current) return;
    let active = true;
    
    const nativeDpr = window.devicePixelRatio || 1;
    const cappedDpr = Math.min(nativeDpr, 2.0); 

    const render = async () => {
      try {
        const viewport = pageProxy.getViewport({ scale: scale });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
        if (!ctx) return;
        
        if (renderTaskRef.current) try { renderTaskRef.current.cancel(); } catch {}

        const targetWidth = Math.floor(viewport.width * cappedDpr);
        const targetHeight = Math.floor(viewport.height * cappedDpr);
        
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
        }
        
        // Cache Logic
        const cachedBitmap = bitmapCache.get(cacheKey);
        
        if (cachedBitmap) {
            ctx.drawImage(cachedBitmap, 0, 0, targetWidth, targetHeight);
            if (active) onRendered();
        } else {
            const fallbackBitmap = bitmapCache.findNearest(fileId, pageNumber);
            if (fallbackBitmap) {
                ctx.drawImage(fallbackBitmap, 0, 0, targetWidth, targetHeight);
            } else {
                ctx.fillStyle = pageColor || '#ffffff';
                ctx.fillRect(0, 0, targetWidth, targetHeight);
            }

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(cappedDpr, cappedDpr);

            const task = pageProxy.render({ canvasContext: ctx, viewport });
            renderTaskRef.current = task;
            await task.promise;
            
            if (renderTaskRef.current !== task || !active) return;

            createImageBitmap(canvas).then(bitmap => {
                if (active) bitmapCache.set(cacheKey, bitmap);
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
  }, [pageProxy, scale, isVisible, pageColor, cacheKey, width, height]);

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

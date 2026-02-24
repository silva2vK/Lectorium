
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { saveOcrData, touchOfflineFile } from './storageService';
import { performFullPageOcr } from './visionService';
import { createSmartCanvas, smartCanvasToBlob } from '../utils/canvasUtils';

GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs`;

export interface BackgroundOcrOptions {
  fileId: string;
  blob: Blob;
  startPage: number;
  endPage: number;
  mode?: 'simple' | 'semantic';
  targetLanguage?: string;
  onProgress: (page: number, total: number) => void;
  onStatusChange?: (status: string) => void; 
  onComplete: (stats: { success: number; failed: number }) => void;
  onError: (error: string) => void;
  onQuotaExceeded?: (lastPage: number) => void;
  onSemanticResult?: (page: number, markdown: string, segments: any[]) => void;
}

/**
 * Algoritmo de Auto-Alignment (Ink-to-Text)
 * Ajusta o Bbox da IA baseado na densidade de pixels escuros reais.
 */
function alignToInk(ctx: CanvasRenderingContext2D, box: number[], w: number, h: number): number[] {
    const [ymin, xmin, ymax, xmax] = box;
    const pxLeft = Math.floor((xmin / 1000) * w);
    const pxTop = Math.floor((ymin / 1000) * h);
    const pxRight = Math.ceil((xmax / 1000) * w);
    const pxBottom = Math.ceil((ymax / 1000) * h);
    
    try {
        const imageData = ctx.getImageData(pxLeft, pxTop, pxRight - pxLeft, pxBottom - pxTop);
        const data = imageData.data;
        let sumX = 0, sumY = 0, count = 0;
        
        // Detecta pixels "escuros" (Tinta)
        for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
            if (brightness < 120) { // Threshold de tinta
                const pixelIdx = i / 4;
                sumX += pixelIdx % imageData.width;
                sumY += Math.floor(pixelIdx / imageData.width);
                count++;
            }
        }
        
        if (count > 0) {
            const centerX = sumX / count;
            const centerY = sumY / count;
            const currentCenterX = imageData.width / 2;
            const currentCenterY = imageData.height / 2;
            
            // Calcula o deslocamento necessário para centralizar na tinta
            const shiftX = ((centerX - currentCenterX) / w) * 1000;
            const shiftY = ((centerY - currentCenterY) / h) * 1000;
            
            return [
                Math.max(0, ymin + shiftY),
                Math.max(0, xmin + shiftX),
                Math.min(1000, ymax + shiftY),
                Math.min(1000, xmax + shiftX)
            ];
        }
    } catch (e) {}
    return box;
}

// Added missing export required by PdfContext.tsx
/**
 * Helper exported to map AI segments to structured word data with layout logic.
 */
export function mapSegmentsToWords(segments: any[], w: number, h: number, scale: number): { data: any[], markdown: string } {
    return mapSegmentsToWordsInLine(segments, w, h, scale);
}

export async function runBackgroundOcr({ 
  fileId, blob, startPage, endPage, targetLanguage, onProgress, onStatusChange, onComplete, onError, onQuotaExceeded, onSemanticResult 
}: BackgroundOcrOptions) {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const pdfDoc = await getDocument({
      data: arrayBuffer,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/cmaps/',
      cMapPacked: true,
    }).promise;

    const totalPagesToProcess = endPage - startPage + 1;
    let successCount = 0;
    let failedCount = 0;

    for (let i = startPage; i <= endPage; i++) {
        try {
            if (onStatusChange) onStatusChange(`Processando página ${i}...`);
            
            const page = await pdfDoc.getPage(i);
            const baseViewport = page.getViewport({ scale: 1.0 });
            const renderScale = 1024 / baseViewport.width;
            const viewport = page.getViewport({ scale: renderScale });
            
            let canvas: HTMLCanvasElement | OffscreenCanvas;
            let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
            let renderSuccess = false;

            // Tentativa 1: OffscreenCanvas (Hardware Acceleration)
            if (typeof OffscreenCanvas !== 'undefined') {
                try {
                    canvas = new OffscreenCanvas(viewport.width, viewport.height);
                    ctx = canvas.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D;
                    await page.render({ canvasContext: ctx as any, viewport }).promise;
                    renderSuccess = true;
                } catch (e) {
                    console.warn("[OCR] OffscreenCanvas falhou, revertendo para DOM Canvas", e);
                }
            }

            // Tentativa 2: DOM Canvas (Fallback Seguro)
            if (!renderSuccess) {
                canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
                await page.render({ canvasContext: ctx as any, viewport }).promise;
            }

            const blobImg = await smartCanvasToBlob(canvas!, 'image/jpeg', 0.6);
            const base64 = await new Promise<string>((r) => {
                const reader = new FileReader();
                reader.onloadend = () => r((reader.result as string).split(',')[1]);
                reader.readAsDataURL(blobImg);
            });
            
            const { segments, metrics } = await performFullPageOcr(base64, targetLanguage);
            
            // Refinamento de alinhamento por contraste
            const alignedSegments = segments.map(seg => ({
                ...seg,
                b: alignToInk(ctx, seg.b, viewport.width, viewport.height)
            }));

            const mappedResult = mapSegmentsToWordsInLine(alignedSegments, viewport.width, viewport.height, renderScale);
            const mappedWords = mappedResult.data;
            const reconstructedMarkdown = mappedResult.markdown;
            
            await saveOcrData(fileId, i, mappedWords, reconstructedMarkdown);

            window.dispatchEvent(new CustomEvent('ocr-page-ready', {
                detail: { fileId, page: i, words: mappedWords, markdown: reconstructedMarkdown, metrics }
            }));

            if (onSemanticResult) onSemanticResult(i, reconstructedMarkdown, alignedSegments);
            await touchOfflineFile(fileId);
            successCount++;
            onProgress(i, totalPagesToProcess);
        } catch (pageError: any) {
            failedCount++;
            if (pageError.message?.includes('429')) {
                if (onQuotaExceeded) { onQuotaExceeded(i); break; }
            }
        }
    }
    onComplete({ success: successCount, failed: failedCount });
  } catch (e: any) {
    onError(e.message || "Erro no processamento OCR.");
  }
}

function mapSegmentsToWordsInLine(segments: any[], w: number, h: number, scale: number): { data: any[], markdown: string } {
    const mappedWords: any[] = [];
    const originalW = w / scale;
    const originalH = h / scale;
    let fullMarkdown = "";

    for (const seg of segments) {
        const box = seg.b;
        const text = seg.t || "";
        const col = seg.c || 0;
        
        if (!box || box.length !== 4 || !text) continue;
        fullMarkdown += text + "\n\n";

        const [ymin, xmin, ymax, xmax] = box;
        const bX0 = (xmin / 1000) * originalW;
        const bY0 = (ymin / 1000) * originalH;
        const bX1 = (xmax / 1000) * originalW;
        const bY1 = (ymax / 1000) * originalH;
        
        const bWidth = bX1 - bX0;
        const bHeight = bY1 - bY0;

        const lines = text.split('\n').filter((l: string) => l.trim().length > 0);
        const estLineH = (bY1 - bY0) / lines.length;

        lines.forEach((lineText: string, lineIdx: number) => {
            const lineY0 = bY0 + (lineIdx * estLineH);
            const lineY1 = lineY0 + estLineH;
            
            // Split mantendo os espaços como elementos
            const words = lineText.trim().split(/(\s+)/);
            const totalCharsInLine = lineText.length;
            
            let currentX = bX0;

            for (const word of words) {
                if (word.length === 0) continue;
                
                // Calcula largura proporcional ao número de caracteres
                const wordWidth = (word.length / totalCharsInLine) * bWidth;
                
                // Correção: Agora incluímos também os espaços na camada de texto
                // Isso garante que a seleção 'join' pegue os espaços corretamente
                mappedWords.push({
                    text: word,
                    confidence: 99,
                    bbox: { 
                        x0: currentX, 
                        y0: lineY0, 
                        x1: currentX + wordWidth, 
                        y1: lineY1 
                    },
                    column: col,
                    isRefined: true
                });
                
                currentX += wordWidth;
            }
        });
    }
    return { data: mappedWords, markdown: fullMarkdown.trim() };
}

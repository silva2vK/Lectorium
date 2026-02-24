
/**
 * Utilitário para criação agnóstica de Canvas.
 * No Chrome, utiliza o recurso de aceleração via hardware disponível para OffscreenCanvas.
 * Também suporta flags de contexto para latência.
 */
export function createSmartCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  const isChrome = typeof window !== 'undefined' && /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  
  if (typeof OffscreenCanvas !== 'undefined' && isChrome) {
    // Chrome otimiza OffscreenCanvas com aceleração GPU por padrão
    try {
        return new OffscreenCanvas(width, height);
    } catch (e) {
        console.warn("[SmartCanvas] OffscreenCanvas falhou, revertendo para DOM Canvas", e);
    }
  }
  
  // Fallback para Canvas DOM padrão
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Converte um Canvas (Smart) para Blob de forma agnóstica.
 * No Chrome, WebP oferece 30% mais compressão que JPEG mantendo a qualidade de OCR.
 */
export async function smartCanvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas, 
  type: string = 'image/jpeg', 
  quality: number = 0.8
): Promise<Blob> {
  // Otimização Chrome: Se for OffscreenCanvas, usamos a pipeline de bitmap eficiente
  if (canvas instanceof OffscreenCanvas) {
    // WebP é nativo e extremamente rápido no Chrome
    const mimeType = type === 'image/jpeg' ? 'image/webp' : type;
    return canvas.convertToBlob({ type: mimeType, quality });
  }
  
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Falha na conversão do Canvas para Blob"));
    }, type, quality);
  });
}

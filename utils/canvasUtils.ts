
/**
 * Utilitário para criação agnóstica de Canvas.
 * Também suporta flags de contexto para latência.
 */
export function createSmartCanvas(width: number, height: number): HTMLCanvasElement {
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
  canvas: HTMLCanvasElement, 
  type: string = 'image/jpeg', 
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Falha na conversão do Canvas para Blob"));
    }, type, quality);
  });
}

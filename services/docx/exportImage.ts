
import { ImageRun } from "docx";

export const base64ToUint8Array = (base64String: string) => {
    try {
        const base64 = base64String.split(',')[1] || base64String;
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    } catch (e) {
        console.error("Error converting base64", e);
        return new Uint8Array();
    }
};

/**
 * Processamento de Imagem com Crop via Canvas para DOCX
 */
export const processImageForDocx = async (
    base64Src: string, 
    crop: { top: number, right: number, bottom: number, left: number } | null,
    targetWidth?: number,
    targetHeight?: number
): Promise<{ buffer: Uint8Array, width: number, height: number }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                resolve({ 
                    buffer: base64ToUint8Array(base64Src), 
                    width: Math.round(targetWidth || img.width), 
                    height: Math.round(targetHeight || (img.height * ((targetWidth || img.width) / img.width))) 
                });
                return;
            }

            let sx = 0, sy = 0, sw = img.width, sh = img.height;

            if (crop && (crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0)) {
                sx = img.width * (crop.left / 100);
                sy = img.height * (crop.top / 100);
                sw = img.width * (1 - (crop.left + crop.right) / 100);
                sh = img.height * (1 - (crop.top + crop.bottom) / 100);
            }

            canvas.width = Math.floor(sw);
            canvas.height = Math.floor(sh);

            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

            const aspectRatio = sw / sh;
            let finalWidth = targetWidth || 400;
            let finalHeight = targetHeight;

            if (!finalHeight) {
                finalHeight = finalWidth / aspectRatio;
            } else if (!targetWidth) {
                finalWidth = finalHeight * aspectRatio;
            }

            canvas.toBlob((blob) => {
                if (blob) {
                    blob.arrayBuffer().then(buffer => {
                        resolve({
                            buffer: new Uint8Array(buffer),
                            width: Math.round(finalWidth),
                            height: Math.round(finalHeight!)
                        });
                    });
                } else {
                    reject(new Error("Canvas to Blob failed"));
                }
            }, 'image/png');
        };
        img.onerror = (e) => reject(e);
        img.src = base64Src;
    });
};


import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface Annotation {
  id?: string;
  page: number;
  bbox: [number, number, number, number];
  text?: string;
  type: 'highlight' | 'note' | 'ink';
  points?: number[][];
  color?: string;
  opacity?: number;
  strokeWidth?: number;
  isBurned?: boolean;
}

function toBase64(str: string) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode(parseInt(p1, 16))));
}

self.onmessage = async (e: MessageEvent) => {
  const { command, pdfBytes, annotations, ocrMap, pageOffset, lensData } = e.data;

  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const drawOcr = (page: any, words: any[]) => {
        const { height } = page.getSize();
        for (const w of words) {
            const bbox = Array.isArray(w.bbox) ? { x0: w.bbox[0], y0: w.bbox[1], x1: w.bbox[0]+w.bbox[2], y1: w.bbox[1]+w.bbox[3] } : w.bbox;
            if (w.text && bbox) {
                page.drawText(w.text, {
                    x: bbox.x0,
                    y: height - bbox.y1,
                    size: Math.max(1, (bbox.y1 - bbox.y0) * 0.9),
                    font: helvetica,
                    color: rgb(0, 0, 0),
                    opacity: 0,
                    maxWidth: (bbox.x1 - bbox.x0) + 1
                });
            }
        }
    };

    if (command === 'burn-page-ocr') {
        const pIdx = e.data.pageNumber - 1;
        if (pages[pIdx]) drawOcr(pages[pIdx], e.data.ocrData);
    } else {
        const meta = {
            lectorium_v: "2.1", last_sync: new Date().toISOString(),
            pageCount: pages.length, pageOffset: pageOffset || 0,
            annotations: (annotations || []).map(a => ({ ...a, isBurned: true })),
            semanticData: lensData || {}
        };
        pdfDoc.setKeywords([`LECTORIUM_V2_B64:::${toBase64(JSON.stringify(meta))}`]);

        const hexToRgb = (hex: string) => {
            const b = parseInt(hex.replace('#', ''), 16);
            return rgb(((b >> 16) & 255)/255, ((b >> 8) & 255)/255, (b & 255)/255);
        };

        if (ocrMap) {
            Object.entries(ocrMap).forEach(([p, w]) => {
                const idx = parseInt(p) - 1;
                if (pages[idx]) drawOcr(pages[idx], w as any[]);
            });
        }

        for (const ann of (annotations || [])) {
            if (ann.isBurned || ann.page > pages.length) continue;
            const p = pages[ann.page - 1];
            const { height } = p.getSize();

            if (ann.type === 'highlight') {
                p.drawRectangle({
                    x: ann.bbox[0], y: height - ann.bbox[1] - ann.bbox[3],
                    width: ann.bbox[2], height: ann.bbox[3],
                    color: hexToRgb(ann.color || '#facc15'), opacity: ann.opacity ?? 0.4
                });
            } else if (ann.type === 'ink' && ann.points?.length > 1) {
                const col = hexToRgb(ann.color || '#ff0000');
                const thick = ann.strokeWidth || 3;
                for (let i = 0; i < ann.points.length - 1; i++) {
                    p.drawLine({
                        start: { x: ann.points[i][0], y: height - ann.points[i][1] },
                        end: { x: ann.points[i+1][0], y: height - ann.points[i+1][1] },
                        thickness: thick, color: col, opacity: ann.opacity ?? 0.5
                    });
                }
            } else if (ann.type === 'note') {
                p.drawRectangle({
                    x: ann.bbox[0] - 7, y: height - ann.bbox[1] - 7,
                    width: 14, height: 14, color: rgb(1, 0.95, 0.4),
                    borderColor: rgb(0.8, 0.7, 0), borderWidth: 1
                });
            }
        }
    }

    const bytes = await pdfDoc.save();
    (self as any).postMessage({ success: true, pdfBytes: bytes }, [bytes.buffer]);
  } catch (error: any) {
    (self as any).postMessage({ success: false, error: error.message });
  }
};
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
  tags?: string[];
}

// Comprime string com CompressionStream (deflate-raw) e retorna base64.
// Reduz o payload de metadados em ~60-70% — resolve o limite de ~65KB do pdf-lib
// para PDFString que causava setKeywords() falhar silenciosamente em arquivos
// com muitas anotações, deixando-as pintadas mas invisíveis no Painel Tático.
async function compressToBase64(str: string): Promise<string> {
    try {
        const encoded = new TextEncoder().encode(str);
        const cs = new CompressionStream('deflate-raw');
        const writer = cs.writable.getWriter();
        writer.write(encoded);
        writer.close();
        const chunks: Uint8Array[] = [];
        const reader = cs.readable.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        const total = chunks.reduce((s, c) => s + c.length, 0);
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
        // Converte para base64 em chunks para evitar stack overflow
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < merged.length; i += chunkSize) {
            binary += String.fromCharCode(...merged.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    } catch (e) {
        // Fallback: sem compressão
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode(parseInt(p1, 16))));
    }
}

self.onmessage = async (e: MessageEvent) => {
  const { command, pdfBytes, annotations, ocrMap, pageOffset, lensData, password } = e.data;

  try {
    let loadedDoc: PDFDocument;
    try {
        if (password) {
            loadedDoc = await PDFDocument.load(pdfBytes, { password });
        } else {
            loadedDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        }
    } catch (loadError) {
        throw new Error('PDF_LOAD_FAILED');
    }
    
    let pdfDoc = loadedDoc;
    const pages = pdfDoc.getPages();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const drawOcr = (page: any, words: any[]) => {
        const { height } = page.getSize();
        for (const w of words) {
            const bbox = Array.isArray(w.bbox) ? { x0: w.bbox[0], y0: w.bbox[1], x1: w.bbox[0]+w.bbox[2], y1: w.bbox[1]+w.bbox[3] } : w.bbox;
            if (w.text && bbox) {
                try {
                    page.drawText(w.text, {
                        x: bbox.x0, y: height - bbox.y1,
                        size: Math.max(1, (bbox.y1 - bbox.y0) * 0.9),
                        font: helvetica, color: rgb(0, 0, 0), opacity: 0,
                        maxWidth: (bbox.x1 - bbox.x0) + 1
                    });
                } catch (e: any) {
                    if (e.message && e.message.includes('WinAnsi cannot encode')) {
                        const sanitized = w.text.replace(/[^\x00-\xFF]/g, (match: string) => {
                            const charMap: Record<string, string> = {
                                '⁴': '^4', '³': '^3', '²': '^2', '¹': '^1', '⁰': '^0',
                                '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9',
                                '\u201C': '"', '\u201D': '"', '\u2018': "'", '\u2019': "'",
                                '–': '-', '—': '-', '…': '...'
                            };
                            return charMap[match] || '';
                        });
                        if (sanitized) {
                            try {
                                page.drawText(sanitized, {
                                    x: bbox.x0, y: height - bbox.y1,
                                    size: Math.max(1, (bbox.y1 - bbox.y0) * 0.9),
                                    font: helvetica, color: rgb(0, 0, 0), opacity: 0,
                                    maxWidth: (bbox.x1 - bbox.x0) + 1
                                });
                            } catch (e2) {}
                        }
                    }
                }
            }
        }
    };

    if (command === 'burn-page-ocr') {
        const pIdx = e.data.pageNumber - 1;
        if (pages[pIdx]) drawOcr(pages[pIdx], e.data.ocrData);
    } else {
        // Slim annotations para metadados: mantém texto mas trunca em 500 chars.
        // Texto completo está no IDB e é restaurado via mergeAndSet na abertura.
        const annotationsSlim = (annotations || []).map((a: Annotation) => ({
            id: a.id,
            page: a.page,
            bbox: a.bbox,
            type: a.type,
            color: a.color,
            opacity: a.opacity,
            strokeWidth: a.strokeWidth,
            points: a.points,
            tags: a.tags,
            isBurned: true,
            text: a.text ? a.text.slice(0, 500) : undefined,
        }));

        const meta = {
            lectorium_v: "2.1",
            last_sync: new Date().toISOString(),
            pageCount: pages.length,
            pageOffset: pageOffset || 0,
            annotations: annotationsSlim,
            semanticData: lensData || {}
        };
        
        try {
            const compressed = await compressToBase64(JSON.stringify(meta));
            const lectoriumTag = `LECTORIUM_V2_B64:::${compressed}`;
            const existingKeywords = pdfDoc.getKeywords() || '';
            const cleanKeywords = existingKeywords
                .split(/\s+/)
                .filter((k: string) => k.length > 0 && !k.startsWith('LECTORIUM_V2_B64:::'));
            pdfDoc.setKeywords([...cleanKeywords, lectoriumTag]);
            pdfDoc.setProducer("Lectorium Engine v1.7 (Mark VII)");
        } catch (metaErr) {
            (self as any).postMessage({ success: false, error: 'META_WRITE_FAILED' });
            return;
        }

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
            } else if (ann.type === 'ink' && ann.points && ann.points.length > 1) {
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

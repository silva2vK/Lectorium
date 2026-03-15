import { PDFDocument, PDFName, rgb, StandardFonts } from 'pdf-lib';

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

function buildXmpXml(meta: object): string {
    const jsonStr = JSON.stringify(meta)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:lectorium="http://lectorium.app/xmp/1.0/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>Lectorium Engine v1.7</xmp:CreatorTool>
      <xmp:ModifyDate>${new Date().toISOString()}</xmp:ModifyDate>
      <lectorium:data>${jsonStr}</lectorium:data>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function injectXmpStream(pdfDoc: PDFDocument, xmpXml: string): void {
    const encoder = new TextEncoder();
    const xmlBytes = encoder.encode(xmpXml);

    const metaStream = pdfDoc.context.stream(xmlBytes, {
        Type: 'Metadata',
        Subtype: 'XML',
    });

    const metaRef = pdfDoc.context.register(metaStream);
    pdfDoc.catalog.set(PDFName.of('Metadata'), metaRef);
}

function drawOcr(page: any, words: any[], helvetica: any): void {
    const { height } = page.getSize();
    for (const w of words) {
        const bbox = Array.isArray(w.bbox)
            ? { x0: w.bbox[0], y0: w.bbox[1], x1: w.bbox[0] + w.bbox[2], y1: w.bbox[1] + w.bbox[3] }
            : w.bbox;
        if (w.text && bbox) {
            try {
                page.drawText(w.text, {
                    x: bbox.x0, y: height - bbox.y1,
                    size: Math.max(1, (bbox.y1 - bbox.y0) * 0.9),
                    font: helvetica, color: rgb(0, 0, 0), opacity: 0,
                    maxWidth: (bbox.x1 - bbox.x0) + 1,
                });
            } catch (e: any) {
                if (e.message?.includes('WinAnsi cannot encode')) {
                    const charMap: Record<string, string> = {
                        '\u2074': '^4', '\u00B3': '^3', '\u00B2': '^2', '\u00B9': '^1', '\u2070': '^0',
                        '\u2075': '^5', '\u2076': '^6', '\u2077': '^7', '\u2078': '^8', '\u2079': '^9',
                        '\u201C': '"', '\u201D': '"', '\u2018': "'", '\u2019': "'",
                        '\u2013': '-', '\u2014': '-', '\u2026': '...',
                    };
                    const sanitized = w.text.replace(/[^\x00-\xFF]/g, (m: string) => charMap[m] || '');
                    if (sanitized) {
                        try {
                            page.drawText(sanitized, {
                                x: bbox.x0, y: height - bbox.y1,
                                size: Math.max(1, (bbox.y1 - bbox.y0) * 0.9),
                                font: helvetica, color: rgb(0, 0, 0), opacity: 0,
                                maxWidth: (bbox.x1 - bbox.x0) + 1,
                            });
                        } catch { /* ignora */ }
                    }
                }
            }
        }
    }
}

self.onmessage = async (e: MessageEvent) => {
    const { command, pdfBytes, annotations, ocrMap, pageOffset, lensData, password } = e.data;

    try {
        let pdfDoc: PDFDocument;
        try {
            pdfDoc = password
                ? await PDFDocument.load(pdfBytes, { password })
                : await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        } catch {
            throw new Error('PDF_LOAD_FAILED');
        }

        const pages = pdfDoc.getPages();
        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

        if (command === 'burn-page-ocr') {
            const pIdx = e.data.pageNumber - 1;
            if (pages[pIdx]) drawOcr(pages[pIdx], e.data.ocrData, helvetica);
        } else {
            const annotationsMeta = (annotations || []).map((a: Annotation) => ({
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
                lectorium_v: '2.1',
                last_sync: new Date().toISOString(),
                pageCount: pages.length,
                pageOffset: pageOffset || 0,
                annotations: annotationsMeta,
                semanticData: lensData || {},
            };

            try {
                // ── DIAGNÓSTICO TEMPORÁRIO ──────────────────────────────────
                // Remover após confirmar que o XMP grava sem erro.
                console.log('[META] Iniciando injectXmpStream...');
                console.log('[META] context disponível:', typeof pdfDoc.context);
                console.log('[META] context.stream disponível:', typeof (pdfDoc.context as any).stream);
                console.log('[META] PDFName.of disponível:', typeof PDFName.of);
                console.log('[META] catalog disponível:', typeof pdfDoc.catalog);

                injectXmpStream(pdfDoc, buildXmpXml(meta));
                console.log('[META] injectXmpStream OK');

                const existingKw = pdfDoc.getKeywords() || '';
                const cleanKw = existingKw
                    .split(/\s+/)
                    .filter((k: string) =>
                        k.length > 0 &&
                        !k.startsWith('LECTORIUM_V2_B64:::') &&
                        k !== 'LECTORIUM_XMP'
                    );
                pdfDoc.setKeywords([...cleanKw, 'LECTORIUM_XMP']);
                pdfDoc.setProducer('Lectorium Engine v1.7 (Mark VII)');
                console.log('[META] setKeywords + setProducer OK');
            } catch (metaErr) {
                // ── LOG DO ERRO REAL ────────────────────────────────────────
                console.error('[META] FALHA — erro completo:', metaErr);
                console.error('[META] Tipo do erro:', (metaErr as any)?.constructor?.name);
                console.error('[META] Mensagem:', (metaErr as any)?.message);
                console.error('[META] Stack:', (metaErr as any)?.stack);
                (self as any).postMessage({ success: false, error: 'META_WRITE_FAILED' });
                return;
            }

            const hexToRgb = (hex: string) => {
                const b = parseInt(hex.replace('#', ''), 16);
                return rgb(((b >> 16) & 255) / 255, ((b >> 8) & 255) / 255, (b & 255) / 255);
            };

            if (ocrMap) {
                Object.entries(ocrMap).forEach(([p, w]) => {
                    const idx = parseInt(p) - 1;
                    if (pages[idx]) drawOcr(pages[idx], w as any[], helvetica);
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
                        color: hexToRgb(ann.color || '#facc15'), opacity: ann.opacity ?? 0.4,
                    });
                } else if (ann.type === 'ink' && ann.points && ann.points.length > 1) {
                    const col = hexToRgb(ann.color || '#ff0000');
                    const thick = ann.strokeWidth || 3;
                    for (let i = 0; i < ann.points.length - 1; i++) {
                        p.drawLine({
                            start: { x: ann.points[i][0], y: height - ann.points[i][1] },
                            end: { x: ann.points[i + 1][0], y: height - ann.points[i + 1][1] },
                            thickness: thick, color: col, opacity: ann.opacity ?? 0.5,
                        });
                    }
                } else if (ann.type === 'note') {
                    p.drawRectangle({
                        x: ann.bbox[0] - 7, y: height - ann.bbox[1] - 7,
                        width: 14, height: 14, color: rgb(1, 0.95, 0.4),
                        borderColor: rgb(0.8, 0.7, 0), borderWidth: 1,
                    });
                }
            }
        }

        const bytes = await pdfDoc.save();
        (self as any).postMessage({ success: true, pdfBytes: bytes }, [bytes.buffer]);
    } catch (error: any) {
        console.error('[WORKER] Erro geral fora do bloco META:', error);
        (self as any).postMessage({ success: false, error: error.message });
    }
};

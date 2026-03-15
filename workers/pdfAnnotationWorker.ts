import { PDFDocument, PDFName, PDFRawStream, rgb, StandardFonts } from 'pdf-lib';

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

// ─── XMP Stream ────────────────────────────────────────────────────────────────
// Escreve os metadados do Lectorium como XMP stream em Root.Metadata.
// XMP é um stream XML no corpo do PDF — sem limite de tamanho documentado,
// ao contrário do campo Keywords (PDFString ~65KB).
// Custom namespace: xmlns:lectorium="http://lectorium.app/xmp/1.0/"
// O JSON é armazenado como texto UTF-8 dentro de <lectorium:data>, sem Base64.
//
// Retrocompatibilidade: mantém também o campo Keywords com um marcador mínimo
// "LECTORIUM_XMP" para que versões antigas do app saibam que o PDF foi salvo
// com a nova estratégia e não tentem ler Keywords como dados completos.

function buildXmpXml(meta: object): string {
    // JSON direto como texto UTF-8 — sem Base64 overhead (~33% menor)
    const jsonStr = JSON.stringify(meta)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    // begin="" vazio — pdfjs v5 valida o xpacket e rejeita o stream quando
    // o atributo begin contém \uFEFF (BOM codificado como entidade dentro do
    // atributo). BOM como bytes separados no início do stream seria correto,
    // mas o pdf-lib não expõe esse controle via PDFRawStream. begin="" é
    // igualmente válido pelo spec XMP ISO 16684-1 e aceito por todos os parsers.
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

    // Cria stream dict conforme PDF spec §14.3.2 (Metadata Streams)
    const metaDict = pdfDoc.context.obj({
        Type: 'Metadata',
        Subtype: 'XML',
        Length: xmlBytes.length,
    });

    const metaStream = PDFRawStream.of(metaDict, xmlBytes);
    const metaRef = pdfDoc.context.register(metaStream);

    // Aponta Root.Metadata para o novo stream
    pdfDoc.catalog.set(PDFName.of('Metadata'), metaRef);
}

// ─── OCR layer ─────────────────────────────────────────────────────────────────
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
                        '⁴': '^4', '³': '^3', '²': '^2', '¹': '^1', '⁰': '^0',
                        '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9',
                        '\u201C': '"', '\u201D': '"', '\u2018': "'", '\u2019': "'",
                        '–': '-', '—': '-', '…': '...',
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

// ─── Main worker ───────────────────────────────────────────────────────────────
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
            // ── Metadados → XMP stream ──────────────────────────────────────
            // Annotations nos metadados: id/page/bbox/type/color/opacity/tags
            // Texto truncado a 500 chars — texto completo está no IDB local.
            // Na abertura, mergeAndSet() restaura o texto completo via IDB.
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
                injectXmpStream(pdfDoc, buildXmpXml(meta));

                // Marcador mínimo em Keywords para retrocompatibilidade com
                // versões do app que checam Keywords antes de tentar ler XMP.
                // Não contém dados — só sinaliza o novo formato.
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
            } catch (metaErr) {
                (self as any).postMessage({ success: false, error: 'META_WRITE_FAILED' });
                return;
            }

            // ── Burn visual das anotações ───────────────────────────────────
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
        (self as any).postMessage({ success: false, error: error.message });
    }
};

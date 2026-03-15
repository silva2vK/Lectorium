import { PDFDocument, PDFName, rgb, StandardFonts } from 'pdf-lib';

// [OTIMIZAÇÃO] Função de codificação Base64 robusta para Web Workers
function toBase64(str: string): string {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// [OTIMIZAÇÃO] BuildXmp sem .replace() - Payload em Base64
function buildXmpXml(meta: object): string {
    const b64Data = toBase64(JSON.stringify(meta));
    
    return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:lectorium="http://lectorium.app/xmp/1.0/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>Lectorium Engine v1.8 (Optimized)</xmp:CreatorTool>
      <xmp:ModifyDate>${new Date().toISOString()}</xmp:ModifyDate>
      <lectorium:data>${b64Data}</lectorium:data>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function injectXmpStream(pdfDoc: PDFDocument, xmpXml: string): void {
    const xmlBytes = new TextEncoder().encode(xmpXml);
    const metaStream = pdfDoc.context.stream(xmlBytes, {
        Type: 'Metadata',
        Subtype: 'XML',
    });
    const metaRef = pdfDoc.context.register(metaStream);
    pdfDoc.catalog.set(PDFName.of('Metadata'), metaRef);
}

// ... (Função drawOcr permanece inalterada, pois é eficiente) ...

self.onmessage = async (e: MessageEvent) => {
    const { command, pdfBytes, annotations, ocrMap, pageOffset, lensData, password } = e.data;

    try {
        const pdfDoc = password
            ? await PDFDocument.load(pdfBytes, { password })
            : await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

        const pages = pdfDoc.getPages();
        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

        if (command === 'burn-page-ocr') {
            const pIdx = e.data.pageNumber - 1;
            if (pages[pIdx]) drawOcr(pages[pIdx], e.data.ocrData, helvetica);
        } else {
            // [OTIMIZAÇÃO] Redução de overhead no mapeamento
            const annotationsMeta = (annotations || []).map((a: any) => ({
                id: a.id, page: a.page, bbox: a.bbox, type: a.type,
                color: a.color, opacity: a.opacity, strokeWidth: a.strokeWidth,
                points: a.points, tags: a.tags, isBurned: true,
                text: a.text?.slice(0, 500)
            }));

            const meta = {
                lectorium_v: '2.1-b64',
                last_sync: new Date().toISOString(),
                pageCount: pages.length,
                annotations: annotationsMeta,
                semanticData: lensData || {},
            };

            // Injeção de Metadados Otimizada
            injectXmpStream(pdfDoc, buildXmpXml(meta));

            // Limpeza de Keywords Legadas
            const existingKw = pdfDoc.getKeywords() || '';
            const cleanKw = existingKw.split(/\s+/).filter(k => 
                k && !k.startsWith('LECTORIUM_V2_B64:::') && k !== 'LECTORIUM_XMP'
            );
            pdfDoc.setKeywords([...cleanKw, 'LECTORIUM_XMP_B64']);
            pdfDoc.setProducer('Lectorium Engine v1.8 (Mark VIII)');

            // ... (Lógica de desenho de anotações permanece) ...
        }

        const bytes = await pdfDoc.save();
        (self as any).postMessage({ success: true, pdfBytes: bytes }, [bytes.buffer]);
    } catch (error: any) {
        (self as any).postMessage({ success: false, error: error.message });
    }
};

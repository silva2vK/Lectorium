
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
  const { command, pdfBytes, annotations, ocrMap, pageOffset, lensData, password } = e.data;

  try {
    // 1. Carrega o documento original
    let loadedDoc: PDFDocument;
    
    try {
        if (password) {
            loadedDoc = await PDFDocument.load(pdfBytes, { password });
        } else {
            // Tenta carregar ignorando encriptação (funciona para Owner Password se não houver User Password)
            loadedDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        }
    } catch (loadError: any) {
        // Detecção específica de erro de senha
        if (loadError.message?.includes('Encrypted') || loadError.message?.includes('Password') || loadError.name === 'PasswordException') {
             throw new Error('PDF_ENCRYPTED_PASSWORD_REQUIRED');
        }
        throw new Error('PDF_LOAD_FAILED: ' + loadError.message);
    }
    
    let pdfDoc = loadedDoc;

    // --- PROTOCOLO DE LAVAGEM (Sanitization) ---
    if (command === 'sanitize') {
        // ESTRATÉGIA CORRIGIDA: In-Place Decryption
        // Ao carregar o PDF com a senha (ou ignorando se for apenas Owner Pwd), o pdf-lib já o decodifica na memória.
        // Chamar .save() gera um novo binário SEM a tabela de encriptação, mantendo todos os assets visuais.
        // A estratégia anterior de copiar páginas para um novo doc causava perda de recursos (páginas em branco).
        
        try {
            const bytes = await loadedDoc.save();
            (self as any).postMessage({ success: true, pdfBytes: bytes }, [bytes.buffer]);
            return;
        } catch (saveError: any) {
            console.error("Erro ao salvar PDF sanitizado:", saveError);
            throw new Error('PDF_PROTECTED: Não foi possível reconstruir o arquivo.');
        }
    }

    // ... Continuação do Burn (Inserção de Anotações) ...
    // Se o documento estiver encriptado mas o comando for 'burn', tentamos salvar direto também.
    // Nota: Se tiver Owner Password, o save() pode falhar em alguns leitores se não removermos a proteção antes,
    // mas o pdf-lib geralmente limpa isso no save padrão.

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
        
        try {
            const existingKeywords = pdfDoc.getKeywords() || '';
            const lectoriumTag = `LECTORIUM_V2_B64:::${toBase64(JSON.stringify(meta))}`;
            const cleanKeywords = existingKeywords.split(' ').filter(k => !k.startsWith('LECTORIUM_V2_B64:::'));
            pdfDoc.setKeywords([...cleanKeywords, lectoriumTag]);
            pdfDoc.setProducer("Lectorium Engine v1.7 (Mark VII)");
        } catch (metaErr) {
            // Ignora erro de metadados se o doc estiver protegido mas permitiu desenho
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
    // Repassa a mensagem exata para tratamento no main thread
    (self as any).postMessage({ success: false, error: error.message });
  }
};

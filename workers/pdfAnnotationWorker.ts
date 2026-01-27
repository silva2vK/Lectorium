
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
    // 1. Carrega o documento original com a estratégia correta de senha
    let loadedDoc: PDFDocument;
    
    if (password) {
        // Se temos senha, tentamos descriptografar para poder ler o conteúdo
        loadedDoc = await PDFDocument.load(pdfBytes, { password });
    } else {
        // Se não temos senha, tentamos carregar ignorando a criptografia (para ler metadados/páginas em branco)
        loadedDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    }
    
    let pdfDoc = loadedDoc;

    // --- PROTOCOLO DE LAVAGEM DE PDF (Sanitization) ---
    // Se o arquivo original tiver "Owner Password" (é criptografado), salvar diretamente falhará
    // ou criará um arquivo corrompido/bloqueado.
    // Solução: Transplantar as páginas para um novo container PDF limpo (sem senha).
    // NOTA: Para que 'copyPages' funcione e copie o conteúdo real, o loadedDoc deve ter sido carregado COM SENHA se for criptografado.
    
    // Se o comando for EXPLICITAMENTE 'sanitize' ou se detectarmos encriptação durante o 'burn-all'
    if (command === 'sanitize' || loadedDoc.isEncrypted) {
        // Cria um container PDF novo em folha
        const newDoc = await PDFDocument.create();
        
        // Copia todas as páginas do original para o novo
        // O método copyPages extrai o conteúdo visual mas descarta o dicionário de criptografia
        const allPageIndices = loadedDoc.getPageIndices();
        const copiedPages = await newDoc.copyPages(loadedDoc, allPageIndices);
        
        copiedPages.forEach((page) => newDoc.addPage(page));

        // TRANSPLANTE DE METADADOS
        // Ao criar um novo doc, perdemos o título/autor original. Vamos copiá-los.
        try {
            const title = loadedDoc.getTitle();
            const author = loadedDoc.getAuthor();
            const subject = loadedDoc.getSubject();
            const keywords = loadedDoc.getKeywords();
            const creator = loadedDoc.getCreator();
            const producer = loadedDoc.getProducer();
            const creationDate = loadedDoc.getCreationDate();
            const modDate = loadedDoc.getModificationDate();

            if (title) newDoc.setTitle(title);
            if (author) newDoc.setAuthor(author);
            if (subject) newDoc.setSubject(subject);
            if (keywords) newDoc.setKeywords(keywords.split(' ')); // pdf-lib retorna string única
            if (creator) newDoc.setCreator(creator);
            if (producer) newDoc.setProducer(producer);
            if (creationDate) newDoc.setCreationDate(creationDate);
            if (modDate) newDoc.setModificationDate(modDate);
        } catch (metaErr) {
            // Ignora falhas de metadados se o arquivo estiver muito bloqueado
            console.warn("Aviso: Não foi possível migrar alguns metadados do PDF original.");
        }
        
        // Substitui a referência para usarmos o novo documento limpo daqui para frente
        pdfDoc = newDoc;
    }

    // Se o comando for apenas sanitizar, salva e retorna agora
    if (command === 'sanitize') {
        const bytes = await pdfDoc.save();
        (self as any).postMessage({ success: true, pdfBytes: bytes }, [bytes.buffer]);
        return;
    }

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
        
        // Define os metadados Lectorium (sobrescrevendo ou adicionando aos originais)
        // Adicionamos aos Keywords existentes para não perder tags originais se possível
        const existingKeywords = pdfDoc.getKeywords() || '';
        const lectoriumTag = `LECTORIUM_V2_B64:::${toBase64(JSON.stringify(meta))}`;
        
        // Remove tag antiga se existir para não duplicar
        const cleanKeywords = existingKeywords.split(' ').filter(k => !k.startsWith('LECTORIUM_V2_B64:::'));
        pdfDoc.setKeywords([...cleanKeywords, lectoriumTag]);

        // Marca d'água técnica no produtor
        pdfDoc.setProducer("Lectorium Engine v1.7 (Mark VII) + " + (pdfDoc.getProducer() || "Original"));

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

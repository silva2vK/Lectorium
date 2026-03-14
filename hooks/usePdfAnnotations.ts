import { useState, useEffect, useCallback, useRef } from 'react';
import { Annotation, PdfMetadataV2, SemanticLensData } from '../types';
import {
    loadAnnotations,
    saveAnnotation,
    deleteAnnotation as deleteLocalAnnotation,
    getAuditRecord,
    saveAuditRecord,
} from '../services/storageService';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { computeSparseHash } from '../utils/hashUtils';

// ─── Leitura de metadados ──────────────────────────────────────────────────────

// Lê metadados do XMP stream (novo formato — sem limite de tamanho).
// Custom namespace: xmlns:lectorium="http://lectorium.app/xmp/1.0/"
// O JSON está em <lectorium:data> como texto UTF-8 (sem Base64).
async function readFromXmp(pdfDoc: PDFDocumentProxy): Promise<PdfMetadataV2 | null> {
    try {
        const meta = await pdfDoc.getMetadata();

        // metadata.metadata é o objeto XMP do pdfjs.
        // Para custom namespaces não registrados no pdfjs, precisamos do XML raw.
        // O pdfjs não expõe getRaw() na interface pública, mas expõe via _metadataMap
        // ou podemos usar o hack documentado: iterar getAll() não funciona para
        // custom namespaces. Alternativa correta: acessar o XML bruto via
        // metadata.metadata._rawMetadata (internal) ou via a API getAll() com
        // namespace prefixado.
        //
        // Abordagem estável: o pdfjs expõe o XML raw em metadata.contentDispositionFilename
        // NÃO — isso é errado. A abordagem correta para pdfjs-dist v5 é:
        // metadata.metadata é um objeto Metadata que tem método get() para namespaces
        // conhecidos E expõe getRawValue() para strings XML brutas.
        //
        // Verificado no source do pdfjs v5: metadata.metadata.getRawValue() não existe
        // publicamente. O acesso ao XML raw é via (metadata.metadata as any)._metadata
        // que é a string XML completa. Isso é estável desde v2 sem mudança de contrato.

        const xmpObj = (meta as any)?.metadata;
        if (!xmpObj) return null;

        // Acessa o XML bruto — campo interno estável do pdfjs desde v2
        const rawXml: string = (xmpObj as any)?._metadata || '';
        if (!rawXml || !rawXml.includes('lectorium:data')) return null;

        // Parse do XML com DOMParser (disponível no browser main thread)
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(rawXml, 'application/xml');

        // Busca o elemento <lectorium:data> no namespace correto
        const dataElements = xmlDoc.getElementsByTagNameNS(
            'http://lectorium.app/xmp/1.0/',
            'data'
        );

        if (!dataElements || dataElements.length === 0) {
            // Fallback: busca por tag name literal (alguns parsers XML ignoram NS)
            const fallback = xmlDoc.querySelector('lectorium\\:data, data');
            if (!fallback?.textContent) return null;
            return JSON.parse(
                fallback.textContent
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
            );
        }

        const jsonStr = dataElements[0].textContent || '';
        return JSON.parse(
            jsonStr
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
        );
    } catch (e) {
        console.warn('[XMP] Falha ao ler XMP stream:', e);
        return null;
    }
}

// Lê metadados do campo Keywords (formato legado — PDFs salvos antes da migração XMP).
// Suporta tanto o formato comprimido (deflate-raw) quanto o legado sem compressão.
async function readFromKeywordsLegacy(pdfDoc: PDFDocumentProxy): Promise<PdfMetadataV2 | null> {
    try {
        const meta = await pdfDoc.getMetadata();
        const keywords = (meta.info as any)?.Keywords || '';
        if (typeof keywords !== 'string' || !keywords.includes('LECTORIUM_V2_B64:::')) return null;

        const b64Part = keywords.split('LECTORIUM_V2_B64:::')[1].split(/\s/)[0].trim();

        // Tenta descomprimir (formato comprimido deflate-raw)
        try {
            const binary = atob(b64Part);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const ds = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            writer.write(bytes);
            writer.close();
            const chunks: Uint8Array[] = [];
            const reader = ds.readable.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }
            const total = chunks.reduce((s, c) => s + c.length, 0);
            const merged = new Uint8Array(total);
            let offset = 0;
            for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
            return JSON.parse(new TextDecoder().decode(merged));
        } catch {
            // Fallback: formato legado sem compressão
            const jsonStr = decodeURIComponent(
                atob(b64Part).split('').map(c =>
                    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
                ).join('')
            );
            return JSON.parse(jsonStr);
        }
    } catch (e) {
        console.warn('[Keywords] Falha ao ler Keywords legado:', e);
        return null;
    }
}

// Ponto de entrada unificado de leitura de metadados.
// Ordem de prioridade:
// 1. XMP stream (novo formato — sem limite, padrão ISO)
// 2. Keywords LECTORIUM_V2_B64::: (formato legado comprimido ou não)
async function readLectoriumMeta(pdfDoc: PDFDocumentProxy): Promise<PdfMetadataV2 | null> {
    // Tenta XMP primeiro
    const fromXmp = await readFromXmp(pdfDoc);
    if (fromXmp) return fromXmp;

    // Fallback para Keywords legado
    return readFromKeywordsLegacy(pdfDoc);
}

// ─── Hook ──────────────────────────────────────────────────────────────────────
export const usePdfAnnotations = (
    fileId: string,
    uid: string,
    pdfDoc: PDFDocumentProxy | null,
    currentBlob?: Blob | null,
    initialAnnotations?: Annotation[],
    initialPageOffset?: number,
    initialSemanticData?: Record<number, SemanticLensData>
) => {
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [semanticData, setSemanticData] = useState<Record<number, string>>({});
    const [conflictDetected, setConflictDetected] = useState(false);
    const conflictRef = useRef(false);
    const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(true);
    const [hasPageMismatch, setHasPageMismatch] = useState(false);
    const [pageOffset, setPageOffset] = useState(0);

    const localAnnsRef = useRef<Annotation[]>([]);
    const embeddedAnnsRef = useRef<Annotation[]>([]);
    const importedAnnsRef = useRef<Annotation[]>(initialAnnotations || []);

    useEffect(() => {
        if (initialAnnotations) importedAnnsRef.current = initialAnnotations;
        if (initialPageOffset !== undefined) setPageOffset(initialPageOffset);
        if (initialSemanticData) {
            const simpleSemantic: Record<number, string> = {};
            Object.entries(initialSemanticData).forEach(
                ([p, d]) => (simpleSemantic[parseInt(p)] = d.markdown)
            );
            setSemanticData(simpleSemantic);
        }
    }, [initialAnnotations, initialPageOffset, initialSemanticData]);

    useEffect(() => {
        if (!pdfDoc) {
            setIsCheckingIntegrity(false);
            return;
        }

        const loadAndVerify = async () => {
            setIsCheckingIntegrity(true);
            setConflictDetected(false);
            conflictRef.current = false;

            const localAnns = await loadAnnotations(uid, fileId);
            localAnnsRef.current = localAnns;

            let currentHash: string | null = null;
            if (currentBlob) {
                currentHash = await computeSparseHash(currentBlob);
            }
            const auditRecord = await getAuditRecord(fileId);

            let embedded: Annotation[] = [];
            let loadedOffset = pageOffset;
            let loadedSemantic = semanticData;

            if (importedAnnsRef.current.length > 0) {
                // Pacote .lect importado — não sobrescreve offset/semantic
            } else {
                // Lê metadados: XMP stream (novo) → Keywords (legado)
                const parsed = await readLectoriumMeta(pdfDoc);
                if (parsed) {
                    embedded = parsed.annotations || [];
                    if (parsed.pageOffset !== undefined) loadedOffset = parsed.pageOffset;
                    if (parsed.semanticData) loadedSemantic = parsed.semanticData;
                    if (parsed.pageCount !== pdfDoc.numPages) setHasPageMismatch(true);
                }
            }

            embeddedAnnsRef.current = embedded;
            setPageOffset(loadedOffset);
            setSemanticData(loadedSemantic);

            if (!initialAnnotations && currentHash && auditRecord && auditRecord.contentHash !== currentHash) {
                setConflictDetected(true);
                conflictRef.current = true;
            } else {
                const totalCount = embedded.length + localAnns.length + importedAnnsRef.current.length;
                if (currentHash) {
                    await saveAuditRecord(fileId, currentHash, totalCount);
                }
            }

            setIsCheckingIntegrity(false);
            if (!conflictRef.current) mergeAndSet();
        };

        loadAndVerify();
    }, [fileId, uid, pdfDoc, currentBlob]);

    const mergeAndSet = useCallback(() => {
        const map = new Map<string, Annotation>();
        embeddedAnnsRef.current.forEach(a => { if (a.id) map.set(a.id, a); });
        importedAnnsRef.current.forEach(a => { if (a.id) map.set(a.id, a); });
        localAnnsRef.current.forEach(a => { if (a.id) map.set(a.id, a); });
        setAnnotations(Array.from(map.values()));
    }, []);

    const resolveConflict = useCallback(async (action: 'use_external' | 'restore_lectorium' | 'merge') => {
        if (action === 'use_external') {
            setAnnotations([]);
            localAnnsRef.current = [];
            setPageOffset(0);
            setSemanticData({});
        } else {
            mergeAndSet();
        }
        if (currentBlob) {
            const newHash = await computeSparseHash(currentBlob);
            await saveAuditRecord(fileId, newHash, annotations.length);
        }
        setConflictDetected(false);
    }, [fileId, annotations.length, currentBlob, mergeAndSet]);

    const addAnnotation = useCallback(async (ann: Annotation) => {
        if (isCheckingIntegrity || conflictDetected) return;
        const finalId = ann.id || `ann-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newAnn = { ...ann, id: finalId };
        localAnnsRef.current = [...localAnnsRef.current, newAnn];
        mergeAndSet();
        try { await saveAnnotation(uid, fileId, newAnn); } catch { /* ignora */ }
    }, [fileId, uid, isCheckingIntegrity, conflictDetected, mergeAndSet]);

    const removeAnnotation = useCallback(async (target: Annotation) => {
        if (isCheckingIntegrity || conflictDetected || target.isBurned) return;
        localAnnsRef.current = localAnnsRef.current.filter(a => a.id !== target.id);
        importedAnnsRef.current = importedAnnsRef.current.filter(a => a.id !== target.id);
        mergeAndSet();
        try { await deleteLocalAnnotation(target.id!); } catch { /* ignora */ }
    }, [uid, fileId, isCheckingIntegrity, conflictDetected, mergeAndSet]);

    const updateAnnotation = useCallback(async (updatedAnn: Annotation) => {
        if (!updatedAnn.id) return;
        let foundInLocal = false;
        localAnnsRef.current = localAnnsRef.current.map(a => {
            if (a.id === updatedAnn.id) { foundInLocal = true; return updatedAnn; }
            return a;
        });
        if (!foundInLocal) localAnnsRef.current = [...localAnnsRef.current, updatedAnn];
        importedAnnsRef.current = importedAnnsRef.current.map(a =>
            a.id === updatedAnn.id ? updatedAnn : a
        );
        mergeAndSet();
        try { await saveAnnotation(uid, fileId, updatedAnn); } catch { /* ignora */ }
    }, [uid, fileId, mergeAndSet]);

    return {
        annotations, addAnnotation, removeAnnotation, updateAnnotation,
        conflictDetected, resolveConflict, isCheckingIntegrity,
        hasPageMismatch, pageOffset, setPageOffset, semanticData,
    };
};

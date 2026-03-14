
import { useState, useEffect, useCallback, useRef } from 'react';
import { Annotation, PdfMetadataV2, SemanticLensData } from '../types';
import {
  loadAnnotations,
  saveAnnotation,
  deleteAnnotation as deleteLocalAnnotation,
  getAuditRecord,
  saveAuditRecord
} from '../services/storageService';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { computeSparseHash } from '../utils/hashUtils';

function fromBase64(str: string) {
    return decodeURIComponent(atob(str).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

export const usePdfAnnotations = (
    fileId: string,
    uid: string, // mantido na assinatura para compatibilidade com callers existentes — não usado internamente
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
        Object.entries(initialSemanticData).forEach(([p, d]) => simpleSemantic[parseInt(p)] = d.markdown);
        setSemanticData(simpleSemantic);
    }
  }, [initialAnnotations, initialPageOffset, initialSemanticData]);

  useEffect(() => {
    if (!pdfDoc || !currentBlob) {
        setIsCheckingIntegrity(false);
        return;
    }

    const loadAndVerify = async () => {
      setIsCheckingIntegrity(true);
      setConflictDetected(false);
      conflictRef.current = false;

      // uid removido da chamada — fileId é chave suficiente
      const localAnns = await loadAnnotations(fileId);
      localAnnsRef.current = localAnns;

      const currentHash = await computeSparseHash(currentBlob);
      const auditRecord = await getAuditRecord(fileId);

      let embedded: Annotation[] = [];
      let loadedOffset = pageOffset;
      let loadedSemantic = semanticData;

      if (importedAnnsRef.current.length > 0) {
          // Pacote .lect tem prioridade — não sobrescreve offset/semantic já definidos
      } else {
          try {
            const metadata = await pdfDoc.getMetadata();
            const keywords = (metadata.info as any)?.Keywords || '';

            if (typeof keywords === 'string' && keywords.includes("LECTORIUM_V2_B64:::")) {
                const jsonStr = fromBase64(keywords.split("LECTORIUM_V2_B64:::")[1]);
                const parsed: PdfMetadataV2 = JSON.parse(jsonStr);
                embedded = parsed.annotations || [];
                if (parsed.pageOffset !== undefined) loadedOffset = parsed.pageOffset;
                if (parsed.semanticData) loadedSemantic = parsed.semanticData;

                if (parsed.pageCount !== pdfDoc.numPages) {
                    setHasPageMismatch(true);
                }
            }
          } catch (e) { console.warn("[Meta] Fail:", e); }
      }

      embeddedAnnsRef.current = embedded;
      setPageOffset(loadedOffset);
      setSemanticData(loadedSemantic);

      if (!initialAnnotations && auditRecord && auditRecord.contentHash !== currentHash) {
          setConflictDetected(true);
          conflictRef.current = true;
      } else {
          const totalCount = embedded.length + localAnns.length + importedAnnsRef.current.length;
          await saveAuditRecord(fileId, currentHash, totalCount);
      }

      setIsCheckingIntegrity(false);
      if (!conflictRef.current) mergeAndSet();
    };

    loadAndVerify();
  }, [fileId, uid, pdfDoc, currentBlob]);

  const mergeAndSet = useCallback(() => {
    const map = new Map<string, Annotation>();

    // Ordem de prioridade (último vence): Embutido -> Importado -> Local
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
    try { await saveAnnotation(fileId, newAnn); } catch (e) {}
  }, [fileId, isCheckingIntegrity, conflictDetected, mergeAndSet]);

  const removeAnnotation = useCallback(async (target: Annotation) => {
    if (isCheckingIntegrity || conflictDetected || target.isBurned) return;

    localAnnsRef.current = localAnnsRef.current.filter(a => a.id !== target.id);
    importedAnnsRef.current = importedAnnsRef.current.filter(a => a.id !== target.id);

    mergeAndSet();
    try { await deleteLocalAnnotation(target.id!); } catch (e) {}
  }, [fileId, isCheckingIntegrity, conflictDetected, mergeAndSet]);

  const updateAnnotation = useCallback(async (updatedAnn: Annotation) => {
    if (!updatedAnn.id) return;

    let foundInLocal = false;
    localAnnsRef.current = localAnnsRef.current.map(a => {
      if (a.id === updatedAnn.id) { foundInLocal = true; return updatedAnn; }
      return a;
    });

    if (!foundInLocal) {
      localAnnsRef.current = [...localAnnsRef.current, updatedAnn];
    }

    importedAnnsRef.current = importedAnnsRef.current.map(a => a.id === updatedAnn.id ? updatedAnn : a);

    mergeAndSet();
    try { await saveAnnotation(fileId, updatedAnn); } catch (e) {}
  }, [fileId, mergeAndSet]);

  return {
    annotations,
    addAnnotation,
    removeAnnotation,
    updateAnnotation,
    conflictDetected,
    resolveConflict,
    isCheckingIntegrity,
    hasPageMismatch,
    pageOffset,
    setPageOffset,
    semanticData
  };
};

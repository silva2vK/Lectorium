
import { useState, useEffect, useCallback, useRef } from 'react';
import { Annotation, PdfMetadataV2 } from '../types';
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

export const usePdfAnnotations = (fileId: string, uid: string, pdfDoc: PDFDocumentProxy | null, currentBlob?: Blob | null) => {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [semanticData, setSemanticData] = useState<Record<number, string>>({});
  const [conflictDetected, setConflictDetected] = useState(false);
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(true);
  const [hasPageMismatch, setHasPageMismatch] = useState(false);
  const [pageOffset, setPageOffset] = useState(0);
  
  const localAnnsRef = useRef<Annotation[]>([]);
  const embeddedAnnsRef = useRef<Annotation[]>([]);

  useEffect(() => {
    if (!pdfDoc || !currentBlob) {
        setIsCheckingIntegrity(false);
        return;
    }

    const loadAndVerify = async () => {
      setIsCheckingIntegrity(true);
      setConflictDetected(false);

      const localAnns = await loadAnnotations(uid, fileId);
      localAnnsRef.current = localAnns;

      const currentHash = await computeSparseHash(currentBlob);
      const auditRecord = await getAuditRecord(fileId);
      
      let embedded: Annotation[] = [];
      let loadedOffset = 0;
      let loadedSemantic: Record<number, string> = {};

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
      
      embeddedAnnsRef.current = embedded;
      setPageOffset(loadedOffset);
      setSemanticData(loadedSemantic);

      if (auditRecord && auditRecord.contentHash !== currentHash) {
          setConflictDetected(true);
      } else {
          await saveAuditRecord(fileId, currentHash, embedded.length);
      }

      setIsCheckingIntegrity(false);
      if (!conflictDetected) mergeAndSet();
    };

    loadAndVerify();
  }, [fileId, uid, pdfDoc, currentBlob]); 

  const mergeAndSet = useCallback(() => {
    const map = new Map<string, Annotation>();
    embeddedAnnsRef.current.forEach(a => { if (a.id) map.set(a.id, a); });
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
    try { await saveAnnotation(uid, fileId, newAnn); } catch (e) {}
  }, [fileId, uid, isCheckingIntegrity, conflictDetected, mergeAndSet]);

  const removeAnnotation = useCallback(async (target: Annotation) => {
    if (isCheckingIntegrity || conflictDetected || target.isBurned) return;
    localAnnsRef.current = localAnnsRef.current.filter(a => a.id !== target.id);
    mergeAndSet();
    try { await deleteLocalAnnotation(target.id!); } catch (e) {}
  }, [uid, fileId, isCheckingIntegrity, conflictDetected, mergeAndSet]);

  return { annotations, addAnnotation, removeAnnotation, conflictDetected, resolveConflict, isCheckingIntegrity, hasPageMismatch, pageOffset, setPageOffset, semanticData };
};

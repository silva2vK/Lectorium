
import { getDb, DocVersion, OcrRecord } from "../services/db";
import { Annotation, AuditRecord } from "../types";

// Versions
export async function saveDocVersion(fileId: string, content: any, author: string, name: string = "Salvamento Automático"): Promise<void> {
  const localDb = await getDb();
  const MAX_VERSIONS = 50;
  
  const version: DocVersion = {
    id: `ver-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    fileId,
    timestamp: Date.now(),
    author,
    content,
    name
  };

  await localDb.put("document_versions", version);

  const index = localDb.transaction("document_versions").store.index("fileId");
  let versions = await index.getAll(fileId);
  if (versions.length > MAX_VERSIONS) {
    versions.sort((a, b) => a.timestamp - b.timestamp);
    const toDelete = versions.slice(0, versions.length - MAX_VERSIONS);
    const tx = localDb.transaction("document_versions", "readwrite");
    for (const v of toDelete) {
      await tx.store.delete(v.id);
    }
    await tx.done;
  }
}

export async function getDocVersions(fileId: string): Promise<DocVersion[]> {
  const localDb = await getDb();
  const versions = await localDb.getAllFromIndex("document_versions", "fileId", fileId);
  return versions.sort((a, b) => b.timestamp - a.timestamp);
}

// Audit
export async function saveAuditRecord(fileId: string, contentHash: string, annotationCount: number): Promise<void> {
  const localDb = await getDb();
  const record: AuditRecord = {
    fileId,
    contentHash,
    lastModified: Date.now(),
    annotationCount
  };
  await localDb.put("audit_log", record);
}

export async function getAuditRecord(fileId: string): Promise<AuditRecord | undefined> {
  const localDb = await getDb();
  return await localDb.get("audit_log", fileId);
}

// OCR
export async function saveOcrData(fileId: string, page: number, words: any[], markdown?: string): Promise<void> {
    const localDb = await getDb();
    const existing = await localDb.get("ocrCache", `${fileId}-${page}`);
    
    await localDb.put("ocrCache", {
        id: `${fileId}-${page}`,
        fileId,
        page,
        words,
        markdown: markdown || existing?.markdown,
        updatedAt: Date.now()
    });
}

export async function loadOcrData(fileId: string): Promise<Record<number, { words: any[], markdown?: string }>> {
    const localDb = await getDb();
    const records: OcrRecord[] = await localDb.getAllFromIndex("ocrCache", "fileId", fileId);
    
    const map: Record<number, { words: any[], markdown?: string }> = {};
    records.forEach(rec => {
        map[rec.page] = {
            words: rec.words,
            markdown: rec.markdown
        };
    });
    return map;
}

// Annotations (Exclusively Local-First)
/**
 * Salva anotação no banco de dados local. 
 * A sincronização com a nuvem ocorre via 'burnAnnotationsToPdf' no ciclo de save do Drive.
 */
export async function saveAnnotation(uid: string, fileId: string, ann: Annotation): Promise<Annotation> {
  const localDb = await getDb();
  const finalId = ann.id || `ann-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const updatedAt = new Date().toISOString();
  const annotationToSave = { ...ann, id: finalId, fileId, userId: uid, updatedAt };
  
  await localDb.put("annotations", annotationToSave);
  return annotationToSave;
}

/**
 * Carrega anotações do IndexedDB local.
 */
export async function loadAnnotations(uid: string, fileId: string): Promise<Annotation[]> {
  const localDb = await getDb();
  return await localDb.getAllFromIndex("annotations", "fileId", fileId);
}

/**
 * Deleta uma anotação do banco local.
 */
export async function deleteAnnotation(id: string, uid?: string, fileId?: string): Promise<void> {
  const localDb = await getDb();
  await localDb.delete("annotations", id);
}

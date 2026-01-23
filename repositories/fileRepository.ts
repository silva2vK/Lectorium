
import { getDb, OfflineRecord } from "../services/db";
import { DriveFile } from "../types";
import { opfs } from "../services/opfs";

// Cache de detecção de suporte para evitar chamadas repetidas
let _opfsSupported: boolean | null = null;
async function checkOpfs() {
  if (_opfsSupported === null) {
    _opfsSupported = await opfs.isSupported();
    if (_opfsSupported) console.log("[Storage] OPFS Ativado (Chrome Native I/O)");
  }
  return _opfsSupported;
}

export async function saveOfflineFile(file: DriveFile, blob: Blob | null, pinned: boolean = false): Promise<void> {
  const db = await getDb();
  const hasOpfs = await checkOpfs();
  
  // Separa o blob dos metadados
  const { blob: _, ...metadata } = file;
  
  const record: OfflineRecord = { 
    ...metadata,
    id: file.id, 
    storedAt: Date.now(),
    lastAccessed: Date.now(),
    pinned: pinned || !!file.pinned,
    // Se tiver OPFS, não salvamos o blob no IDB
    blob: hasOpfs ? undefined : (blob || undefined)
  };

  // Transação Atômica Lógica: Salva blob primeiro (mais lento), depois metadado
  if (hasOpfs && blob) {
    await opfs.save(file.id, blob);
  }

  await db.put("offlineFiles", record);
}

export async function touchOfflineFile(fileId: string): Promise<void> {
  const db = await getDb();
  const record = await db.get("offlineFiles", fileId);
  if (record) {
    record.lastAccessed = Date.now();
    await db.put("offlineFiles", record);
  }
}

export async function getOfflineFile(fileId: string): Promise<Blob | undefined> {
  const db = await getDb();
  const record = await db.get("offlineFiles", fileId);
  
  if (record) {
    // Atualiza acesso
    record.lastAccessed = Date.now();
    db.put("offlineFiles", record);

    // Estratégia Híbrida: Tenta OPFS primeiro, fallback para IDB Blob
    if (await checkOpfs()) {
        const opfsBlob = await opfs.load(fileId);
        if (opfsBlob) return opfsBlob;
    }
    
    // Fallback legado ou se OPFS falhou/não existe
    return record.blob;
  }
  return undefined;
}

export async function toggleFilePin(fileId: string, pinned: boolean): Promise<void> {
  const db = await getDb();
  const record = await db.get("offlineFiles", fileId);
  if (record) {
    record.pinned = pinned;
    await db.put("offlineFiles", record);
  }
}

export async function isFilePinned(fileId: string): Promise<boolean> {
  const db = await getDb();
  const record = await db.get("offlineFiles", fileId);
  return !!record?.pinned;
}

export async function listOfflineFiles(): Promise<DriveFile[]> {
  const db = await getDb();
  // Retorna apenas metadados para listagem rápida (não carrega blobs)
  return await db.getAll("offlineFiles");
}

export async function deleteOfflineFile(fileId: string): Promise<void> {
  const db = await getDb();
  
  // Remove do IDB
  await db.delete("offlineFiles", fileId);
  await db.delete("documentCache", fileId);
  
  // Remove do OPFS se existir
  if (await checkOpfs()) {
    await opfs.delete(fileId);
  }
}

export async function isFileOffline(fileId: string): Promise<boolean> {
  const db = await getDb();
  const record = await db.get("offlineFiles", fileId);
  // Considera offline se o registro existe (assumindo que o blob está no IDB ou OPFS)
  return !!record;
}

export async function addRecentFile(file: DriveFile): Promise<void> {
  const db = await getDb();
  const { blob, handle, ...safeFile } = file; // Don't store blobs/handles in recent history metadata
  await db.put("recentFiles", { ...safeFile, lastOpened: new Date() });
}

export async function getRecentFiles(): Promise<(DriveFile & { lastOpened: Date })[]> {
  const db = await getDb();
  const files = await db.getAll("recentFiles");
  return files.sort((a, b) => (b.lastOpened as any) - (a.lastOpened as any));
}

export async function cacheDocumentData(id: string, data: any): Promise<void> {
  const db = await getDb();
  await db.put("documentCache", { id, ...data, cachedAt: Date.now() });
}

export async function getCachedDocumentData(id: string): Promise<any | undefined> {
  const db = await getDb();
  return await db.get("documentCache", id);
}

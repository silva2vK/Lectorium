
import { getDb, OfflineRecord } from "./db";
import { opfs } from "./opfs"; 
export type { DocVersion } from "./db";

// Re-export Repositories
export * from "../repositories/fileRepository";
export * from "../repositories/vectorRepository";
export * from "../repositories/settingsRepository";
export * from "../repositories/contentRepository";

export const APP_VERSION = '1.7.0'; 
const BLOB_CACHE_LIMIT = 500 * 1024 * 1024;

export interface StorageBreakdown {
  usage: number;
  quota: number;
  details: { offlineFiles: number; cache: number; system: number; }
}

export async function getStorageEstimate(): Promise<StorageBreakdown | null> {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  const estimate = await navigator.storage.estimate();
  const details = (estimate as any).usageDetails || {};
  return {
    usage: estimate.usage || 0,
    quota: estimate.quota || 0,
    details: {
      offlineFiles: details.indexedDB || 0,
      cache: details.caches || 0,
      // OPFS geralmente conta como 'fileSystem' ou entra no total usage
      system: (estimate.usage || 0) - (details.indexedDB || 0) - (details.caches || 0)
    }
  };
}

export async function performAppUpdateCleanup(): Promise<boolean> {
  const storedVersion = localStorage.getItem('app_version');
  if (storedVersion !== APP_VERSION) {
    localStorage.setItem('app_version', APP_VERSION);
    return true;
  }
  return false;
}

export async function runJanitor(): Promise<void> {
  try {
    const db = await getDb();
    const estimate = await navigator.storage.estimate();
    const currentUsage = estimate.usage || 0;

    // Se uso > Limite, começa a limpar
    if (currentUsage < BLOB_CACHE_LIMIT) return;

    const tx = db.transaction(["offlineFiles", "ocrCache", "vector_store", "document_versions"], "readwrite");
    const offlineStore = tx.objectStore("offlineFiles");
    const ocrStore = tx.objectStore("ocrCache");
    const vectorStore = tx.objectStore("vector_store");
    const versionStore = tx.objectStore("document_versions");
    
    // Itera pelos arquivos mais antigos
    const index = offlineStore.index("lastAccessed");
    let cursor = await index.openCursor();
    
    let deletedBytes = 0;
    const targetToDelete = currentUsage - (BLOB_CACHE_LIMIT * 0.7); 
    const hasOpfs = await opfs.isSupported();

    while (cursor && deletedBytes < targetToDelete) {
      const file: OfflineRecord = cursor.value;
      if (!file.pinned) {
        // Estima tamanho (se blob estiver no IDB) ou assume fixo se OPFS (já que OPFS é blob opaque muitas vezes)
        const size = file.blob?.size || 10 * 1024 * 1024; // 10MB estimate for remote files
        deletedBytes += size;
        
        // 1. Limpa Cache Local (OCR, Vetores, Versões)
        const ocrIndex = ocrStore.index("fileId");
        let ocrCursor = await ocrIndex.openCursor(IDBKeyRange.only(file.id));
        while (ocrCursor) { await ocrCursor.delete(); ocrCursor = await ocrCursor.continue(); }

        await vectorStore.delete(file.id);

        const verIndex = versionStore.index("fileId");
        let verCursor = await verIndex.openCursor(IDBKeyRange.only(file.id));
        while (verCursor) { await verCursor.delete(); verCursor = await verCursor.continue(); }

        // 2. Limpa Arquivo Físico (OPFS ou IDB)
        if (hasOpfs) {
            await opfs.delete(file.id);
        }
        
        // 3. Remove registro principal
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
    await tx.done;
    
    // OPFS Cleanup: Remove arquivos órfãos (que não estão no IDB)
    if (hasOpfs) {
        const allOpfsFiles = await opfs.list();
        const allDbKeys = await db.getAllKeys("offlineFiles");
        const dbKeySet = new Set(allDbKeys);
        
        for (const filename of allOpfsFiles) {
            if (!dbKeySet.has(filename)) {
                await opfs.delete(filename);
            }
        }
    }

  } catch (e) {
    console.warn("Janitor error:", e);
  }
}

export async function clearAppStorage(): Promise<void> {
  const db = await getDb();
  const stores = Array.from(db.objectStoreNames);
  const tx = db.transaction(stores, "readwrite");
  for (const name of stores) {
    await tx.objectStore(name).clear();
  }
  await tx.done;
  
  if (await opfs.isSupported()) {
      await opfs.clear();
  }
  
  localStorage.clear();
  window.location.reload();
}

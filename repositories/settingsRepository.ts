
import { getDb } from "../services/db";
import { SyncQueueItem } from "../types";

// Wallpaper
export async function saveWallpaper(orientation: 'landscape' | 'portrait', blob: Blob): Promise<void> {
  const db = await getDb();
  await db.put("settings", blob, `wallpaper_${orientation}`);
}

export async function getWallpaper(orientation: 'landscape' | 'portrait'): Promise<Blob | undefined> {
  const db = await getDb();
  return await db.get("settings", `wallpaper_${orientation}`);
}

export async function removeWallpaper(orientation: 'landscape' | 'portrait'): Promise<void> {
  const db = await getDb();
  await db.delete("settings", `wallpaper_${orientation}`);
}

// Local Directory Handle
export async function saveLocalDirectoryHandle(handle: any): Promise<void> {
  const db = await getDb();
  await db.put("settings", handle, "last_local_dir");
}

export async function getLocalDirectoryHandle(): Promise<any | undefined> {
  const db = await getDb();
  return await db.get("settings", "last_local_dir");
}

// Locks
export async function acquireFileLock(fileId: string): Promise<boolean> {
  const db = await getDb();
  const LOCK_TIMEOUT = 60 * 1000;
  
  const tx = db.transaction("active_locks", "readwrite");
  const store = tx.objectStore("active_locks");
  const existing = await store.get(fileId);

  if (existing && (Date.now() - existing.timestamp < LOCK_TIMEOUT)) {
    return false;
  }
  
  await store.put({ id: fileId, timestamp: Date.now() });
  await tx.done;
  return true;
}

export async function releaseFileLock(fileId: string): Promise<void> {
  const db = await getDb();
  await db.delete("active_locks", fileId);
}

// Sync Queue
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDb();
  return await db.getAll("syncQueue");
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("syncQueue", id);
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt'>): Promise<void> {
    const db = await getDb();
    await db.put("syncQueue", { ...item, createdAt: Date.now(), id: `sync-${Date.now()}` });
}

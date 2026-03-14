import { useState, useCallback, useEffect } from 'react';
import { getSyncQueue, removeSyncQueueItem, acquireFileLock, releaseFileLock } from '../services/storageService';
import { uploadFileToDrive, updateDriveFile } from '../services/driveService';
import { SyncStatus, SyncQueueItem } from '../types';

// Evento customário para notificar mudanças na syncQueue sem polling.
// Disparado pelo processSync após cada operação (add/remove).
// Instâncias com autoSync=false (Dashboard) escutam para atualizar a UI.
export const SYNC_QUEUE_EVENT = 'sync-queue-updated';

interface UseSyncProps {
  accessToken: string | null;
  onAuthError: () => void;
  autoSync?: boolean;
}

export const useSync = ({ accessToken, onAuthError, autoSync = true }: UseSyncProps) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ active: false, message: null });
  const [queue, setQueue] = useState<SyncQueueItem[]>([]);

  const refreshQueue = useCallback(async () => {
    try {
      const items = await getSyncQueue();
      setQueue(items);
    } catch (e) {
      console.warn("Error refreshing sync queue", e);
    }
  }, []);

  const processSync = useCallback(async () => {
    const currentQueue = await getSyncQueue();
    setQueue(currentQueue);

    if (!accessToken || syncStatus.active || !navigator.onLine || currentQueue.length === 0) return;

    setSyncStatus({ active: true, message: `Sincronizando ${currentQueue.length} itens...` });
    
    for (const item of currentQueue) {
        const hasLock = await acquireFileLock(item.fileId);
        if (!hasLock) {
            console.warn(`Skipping locked file: ${item.fileId}`);
            continue;
        }
        
        try {
            if (item.action === 'create') {
                await uploadFileToDrive(accessToken, item.blob, item.name, item.parents, item.mimeType);
            } else if (item.action === 'update') {
                await updateDriveFile(accessToken, item.fileId, item.blob, item.mimeType);
            }
            await removeSyncQueueItem(item.id);
            await refreshQueue();
            // Notifica outras instâncias (ex: Dashboard) que a fila mudou
            window.dispatchEvent(new Event(SYNC_QUEUE_EVENT));
        } catch (e: any) {
            console.error(`Sync failed for item ${item.id}`, e);
            if (e.message.includes('401')) { 
                onAuthError(); 
                break; 
            }
        } finally { 
            await releaseFileLock(item.fileId); 
        }
    }
    
    setSyncStatus({ active: false, message: "Sincronizado" });
    await refreshQueue();
    setTimeout(() => setSyncStatus({ active: false, message: null }), 3000);
  }, [accessToken, syncStatus.active, onAuthError, refreshQueue]);

  const removeItem = useCallback(async (id: string) => {
      await removeSyncQueueItem(id);
      await refreshQueue();
      window.dispatchEvent(new Event(SYNC_QUEUE_EVENT));
  }, [refreshQueue]);

  const clearQueue = useCallback(async () => {
      const items = await getSyncQueue();
      for (const item of items) {
          await removeSyncQueueItem(item.id);
      }
      await refreshQueue();
      window.dispatchEvent(new Event(SYNC_QUEUE_EVENT));
  }, [refreshQueue]);

  useEffect(() => {
    // Carga inicial
    refreshQueue();

    if (autoSync) {
        // Instância principal (App.tsx): processa sync quando volta online
        window.addEventListener('online', processSync);
        if (navigator.onLine) processSync();
    } else {
        // Instância observadora (Dashboard): escuta evento sem polling
        window.addEventListener(SYNC_QUEUE_EVENT, refreshQueue);
    }

    return () => {
        if (autoSync) {
            window.removeEventListener('online', processSync);
        } else {
            window.removeEventListener(SYNC_QUEUE_EVENT, refreshQueue);
        }
        // FIX: removido setInterval(refreshQueue, 5000) — polling proibido (BLACKBOX §18)
        // Substituído por evento SYNC_QUEUE_EVENT (event-driven, sem overhead)
    };
  }, [processSync, refreshQueue, autoSync]);

  return { 
      syncStatus, 
      triggerSync: processSync,
      queue,
      removeItem,
      clearQueue
  };
};

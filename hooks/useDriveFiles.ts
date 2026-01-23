
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DriveFile } from '../types';
import { 
  listDriveContents, 
  searchMindMaps, 
  renameDriveFile, 
  deleteDriveFile, 
  moveDriveFile 
} from '../services/driveService';
import { listOfflineFiles } from '../services/storageService';
import { listLocalFiles } from '../services/localFileService';

export function useDriveFiles(
  accessToken: string,
  mode: 'default' | 'mindmaps' | 'offline' | 'local' | 'shared',
  localDirectoryHandle: any,
  onAuthError: () => void
) {
  const queryClient = useQueryClient();
  
  // Se o modo for 'shared', começamos na pasta virtual 'shared-with-me'.
  const initialFolder = mode === 'shared' ? 'shared-with-me' : 'root';
  const initialHistory = mode === 'shared' 
    ? [{id: 'shared-with-me', name: 'Compartilhados comigo'}] 
    : [{id: 'root', name: 'Meu Drive'}];

  const [currentFolder, setCurrentFolder] = useState<string>(initialFolder);
  const [folderHistory, setFolderHistory] = useState<{id: string, name: string}[]>(initialHistory);

  // Query principal: Lista de Arquivos
  const { data: files = [], isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['drive-files', mode, currentFolder, accessToken],
    queryFn: async () => {
      // Modos Default/Shared exigem token
      if ((mode === 'default' || mode === 'shared') && !accessToken) {
        throw new Error("DRIVE_TOKEN_EXPIRED");
      }

      if (mode === 'offline') {
        return await listOfflineFiles();
      }
      
      if (mode === 'mindmaps') {
        // Estratégia Híbrida Local-First
        const allOffline = await listOfflineFiles();
        const localMaps = allOffline.filter(f => 
            f.name.endsWith('.mindmap') || 
            (f.mimeType === 'application/json' && f.name.includes('Map'))
        );

        let cloudMaps: DriveFile[] = [];
        if (accessToken && navigator.onLine) {
            try {
                cloudMaps = await searchMindMaps(accessToken);
            } catch (e) {
                console.warn("Cloud fetch skipped for mindmaps (offline or auth issue).");
            }
        }

        // Merge
        const fileMap = new Map<string, DriveFile>();
        localMaps.forEach(f => fileMap.set(f.id, f));
        cloudMaps.forEach(f => fileMap.set(f.id, f));
        
        const fetchedFiles = Array.from(fileMap.values());
        fetchedFiles.sort((a, b) => {
            const dateA = new Date(a.modifiedTime || 0).getTime();
            const dateB = new Date(b.modifiedTime || 0).getTime();
            return dateB - dateA;
        });
        return fetchedFiles;
      }
      
      if (mode === 'local' && localDirectoryHandle) {
        return await listLocalFiles(localDirectoryHandle);
      }
      
      // Default & Shared Mode usam a mesma API de listagem
      // Se mode === 'shared', o currentFolder já começa como 'shared-with-me'
      return await listDriveContents(accessToken, currentFolder);
    },
    // Se der erro de auth, dispara callback
    meta: {
      errorHandler: (err: any) => {
        if (err.message === 'DRIVE_TOKEN_EXPIRED' || err.message.includes('401')) {
          onAuthError();
        }
      }
    }
  });

  // Query Secundária: Status Offline (Rápida, apenas IDB)
  const { data: offlineStatus = { offlineIds: new Set<string>(), pinnedIds: new Set<string>() } } = useQuery({
    queryKey: ['offline-status'],
    queryFn: async () => {
      const offline = await listOfflineFiles();
      return {
        offlineIds: new Set(offline.map(f => f.id)),
        pinnedIds: new Set(offline.filter(f => f.pinned).map(f => f.id))
      };
    },
    staleTime: 5000 // Atualiza a cada 5s ou quando invalidado
  });

  // --- Mutations (Ações) ---

  const renameMutation = useMutation({
    mutationFn: async ({ fileId, newName }: { fileId: string, newName: string }) => {
      return await renameDriveFile(accessToken, fileId, newName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return await deleteDriveFile(accessToken, fileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
    }
  });

  const moveMutation = useMutation({
    mutationFn: async ({ fileId, parents, newParentId }: { fileId: string, parents: string[], newParentId: string }) => {
      return await moveDriveFile(accessToken, fileId, parents, newParentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
    }
  });

  // --- Navegação ---

  const handleFolderClick = useCallback((folder: DriveFile) => {
    setCurrentFolder(folder.id);
    setFolderHistory(prev => [...prev, { id: folder.id, name: folder.name }]);
  }, []);

  const handleNavigateUp = useCallback(() => {
    if (folderHistory.length <= 1) return;
    const newHistory = [...folderHistory];
    newHistory.pop();
    setCurrentFolder(newHistory[newHistory.length - 1].id);
    setFolderHistory(newHistory);
  }, [folderHistory]);

  // Função helper para forçar atualização do cache offline (usada após salvar)
  const updateCacheStatus = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['offline-status'] });
  }, [queryClient]);

  const authError = queryError?.message === 'DRIVE_TOKEN_EXPIRED';

  return {
    files,
    loading: isLoading,
    currentFolder,
    folderHistory,
    authError,
    offlineFileIds: offlineStatus.offlineIds,
    pinnedFileIds: offlineStatus.pinnedIds,
    updateCacheStatus,
    loadFiles: refetch, // Mantido nome para compatibilidade, agora é refetch do RQ
    handleFolderClick,
    handleNavigateUp,
    // Exposing Mutation Helpers
    renameFile: renameMutation.mutateAsync,
    deleteFile: deleteMutation.mutateAsync,
    moveFile: moveMutation.mutateAsync,
    isMutating: renameMutation.isPending || deleteMutation.isPending || moveMutation.isPending
  };
}

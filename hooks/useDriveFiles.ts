
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DriveFile } from '../types';
import { 
  listDriveContents, 
  searchMindMaps, 
  renameDriveFile, 
  deleteDriveFile, 
  moveDriveFile,
  searchDriveFiles 
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
  
  // Estado para busca
  const [searchQuery, setSearchQuery] = useState('');

  // Se o modo for 'shared', começamos na pasta virtual 'shared-with-me'.
  const initialFolder = mode === 'shared' ? 'shared-with-me' : 'root';
  const initialHistory = mode === 'shared' 
    ? [{id: 'shared-with-me', name: 'Compartilhados comigo'}] 
    : [{id: 'root', name: 'Meu Drive'}];

  const [currentFolder, setCurrentFolder] = useState<string>(initialFolder);
  const [folderHistory, setFolderHistory] = useState<{id: string, name: string}[]>(initialHistory);

  // Query principal: Lista de Arquivos
  const { data: files = [], isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['drive-files', mode, currentFolder, accessToken, searchQuery],
    queryFn: async () => {
      // --- MODO OFFLINE / FALLBACK LOGIC START ---
      const isOffline = !navigator.onLine;

      // Se houver busca e for modo Offline/Local/Mindmaps, fazemos a filtragem em memória
      if (mode === 'offline') {
        const offline = await listOfflineFiles();
        if (searchQuery) {
            return offline.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return offline;
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
        
        let fetchedFiles = Array.from(fileMap.values());
        fetchedFiles.sort((a, b) => {
            const dateA = new Date(a.modifiedTime || 0).getTime();
            const dateB = new Date(b.modifiedTime || 0).getTime();
            return dateB - dateA;
        });

        if (searchQuery) {
            fetchedFiles = fetchedFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return fetchedFiles;
      }
      
      if (mode === 'local' && localDirectoryHandle) {
        const local = await listLocalFiles(localDirectoryHandle);
        if (searchQuery) {
            return local.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return local;
      }
      
      // Default & Shared Mode (Hybrid Cloud/Local)
      if (mode === 'default' || mode === 'shared') {
          // 1. Se estiver offline, carrega do cache local imediatamente
          if (isOffline) {
              const localFiles = await listOfflineFiles();
              if (searchQuery) {
                  return localFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
              }
              return localFiles;
          }

          // 2. Se não tem token (Expirado/Logout), NÃO lança erro fatal.
          // Retorna arquivos locais para modo "Degradado" (Visualização Offline)
          if (!accessToken) {
             return await listOfflineFiles();
          }

          try {
              // 3. Tenta buscar na nuvem
              if (searchQuery) {
                  return await searchDriveFiles(accessToken, searchQuery);
              }
              return await listDriveContents(accessToken, currentFolder);
          } catch (e: any) {
              // 4. Fallback: Se a API falhar (ex: Token Expirado 401 ou Rede), carrega local
              // Dispara o callback de erro para a UI saber que precisa reautenticar
              if (e.message === 'DRIVE_TOKEN_EXPIRED' || e.message.includes('401')) {
                  onAuthError();
              }
              
              console.warn("[DriveHook] Falha na API Drive. Ativando fallback local.", e);
              const localFiles = await listOfflineFiles();
              if (searchQuery) {
                  return localFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
              }
              return localFiles;
          }
      }

      return [];
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
    if (searchQuery) setSearchQuery('');
    setCurrentFolder(folder.id);
    setFolderHistory(prev => [...prev, { id: folder.id, name: folder.name }]);
  }, [searchQuery]);

  const handleNavigateUp = useCallback(() => {
    if (searchQuery) setSearchQuery('');
    if (folderHistory.length <= 1) return;
    const newHistory = [...folderHistory];
    newHistory.pop();
    setCurrentFolder(newHistory[newHistory.length - 1].id);
    setFolderHistory(newHistory);
  }, [folderHistory, searchQuery]);

  const updateCacheStatus = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['offline-status'] });
  }, [queryClient]);

  // Auth Error agora é controlado pelo estado do token, já que a query não falha mais
  const authError = !accessToken && (mode === 'default' || mode === 'shared');

  return {
    files,
    loading: isLoading,
    currentFolder,
    folderHistory,
    authError,
    offlineFileIds: offlineStatus.offlineIds,
    pinnedFileIds: offlineStatus.pinnedIds,
    updateCacheStatus,
    loadFiles: refetch, 
    handleFolderClick,
    handleNavigateUp,
    searchQuery,
    setSearchQuery,
    renameFile: renameMutation.mutateAsync,
    deleteFile: deleteMutation.mutateAsync,
    moveFile: moveMutation.mutateAsync,
    isMutating: renameMutation.isPending || deleteMutation.isPending || moveMutation.isPending
  };
}

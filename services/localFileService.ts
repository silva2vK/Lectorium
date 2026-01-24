
import { DriveFile, MIME_TYPES } from "../types";

// Extensões suportadas para filtragem
const SUPPORTED_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.doc',
  '.mindmap',
  '.lect',
  '.json',
  '.txt',
  '.md',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
  '.tiff',
  '.tif',
  '.dcm',
  '.cbz',
  '.cbr'
]);

// Mapa para converter extensão em MIME type aproximado para a UI
const EXT_TO_MIME: Record<string, string> = {
  '.pdf': MIME_TYPES.PDF,
  '.docx': MIME_TYPES.DOCX,
  '.doc': MIME_TYPES.DOCX,
  '.mindmap': MIME_TYPES.MINDMAP,
  '.lect': MIME_TYPES.LECTORIUM,
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.tiff': 'image/tiff',
  '.dcm': 'application/dicom',
  '.cbz': MIME_TYPES.CBZ,
  '.cbr': MIME_TYPES.CBR
};

/**
 * Solicita ao usuário a seleção de um diretório local.
 */
export async function openDirectoryPicker(): Promise<any> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error("Seu navegador não suporta acesso a pastas locais.");
  }
  
  try {
    // @ts-ignore - API moderna pode não estar nos tipos padrão
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite'
    });
    return handle;
  } catch (e: any) {
    // CORREÇÃO CRÍTICA: Em WebViews Android, o cancelamento ou falta de permissão
    // pode vir com mensagens variadas. Normalizamos tudo para AbortError.
    // Isso impede que o App.tsx exiba o alert("Seleção cancelada").
    if (e.name === 'AbortError' || e.message?.includes('user aborted') || e.message?.includes('The user aborted a request')) {
        const silentError = new Error("Seleção cancelada pelo usuário.");
        silentError.name = 'AbortError'; // A flag mágica que o App.tsx ignora
        throw silentError;
    }
    
    // Se for outro erro (ex: SecurityError), repassa
    throw e;
  }
}

/**
 * Lista arquivos do diretório, filtrando apenas os suportados.
 * Retorna objetos compatíveis com a interface DriveFile.
 */
export async function listLocalFiles(dirHandle: any): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  
  try {
    // GARANTIA: Verifica permissão antes de começar
    const hasPermission = await verifyPermission(dirHandle, false);
    if (!hasPermission) {
        console.warn("[LocalFile] Permissão de leitura negada no handle.");
        return [];
    }

    // Itera sobre as entradas do diretório
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        try {
            const name = entry.name;
            const extIndex = name.lastIndexOf('.');
            if (extIndex === -1) continue; // Pula arquivos sem extensão

            const ext = name.substring(extIndex).toLowerCase();
            
            if (SUPPORTED_EXTENSIONS.has(ext)) {
              // Precisamos obter o arquivo real para metadados básicos (data, tamanho)
              const fileData = await entry.getFile();
              
              files.push({
                id: `native-${name}-${fileData.lastModified}`, // ID virtual estável
                name: name,
                mimeType: EXT_TO_MIME[ext] || fileData.type || 'application/octet-stream',
                size: fileData.size.toString(),
                modifiedTime: new Date(fileData.lastModified).toISOString(),
                handle: entry, // Guardamos o handle para leitura/escrita futura
                blob: fileData // Guardamos o blob inicial (cacheado)
              });
            }
        } catch (fileErr) {
            // Se falhar a leitura de um arquivo específico (ex: bloqueio de sistema), não quebra o loop
            console.warn(`[LocalFile] Erro ao ler arquivo individual: ${entry.name}`, fileErr);
        }
      }
      // TODO: Suporte a subpastas recursivas se necessário no futuro
    }
  } catch (e) {
    console.error("Erro ao listar arquivos locais:", e);
    throw new Error("Não foi possível ler o conteúdo da pasta. Verifique as permissões.");
  }
  
  return files;
}

/**
 * Verifica permissão de leitura/escrita em um handle
 */
export async function verifyPermission(fileHandle: any, withWrite = false): Promise<boolean> {
  const options: any = {};
  if (withWrite) {
    options.mode = 'readwrite';
  }
  
  // Check if permission was already granted. If so, return true.
  try {
      if ((await fileHandle.queryPermission(options)) === 'granted') {
        return true;
      }
      
      // Request permission. If the user grants permission, return true.
      if ((await fileHandle.requestPermission(options)) === 'granted') {
        return true;
      }
  } catch (e) {
      console.warn("Erro ao verificar permissão:", e);
  }
  
  return false;
}

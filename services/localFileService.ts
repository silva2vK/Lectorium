
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
  '.heif': 'image/heif',
  '.tiff': 'image/tiff',
  '.dcm': 'application/dicom'
};

/**
 * Cria um "Handle Virtual" compatível com a interface FileSystemDirectoryHandle
 * a partir de uma lista de arquivos (input type="file" webkitdirectory).
 * Isso permite usar a mesma lógica de UI sem exigir permissões de escrita nativas.
 */
export function createVirtualDirectoryHandle(fileList: FileList) {
  const entries: any[] = [];
  
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    entries.push({
      kind: 'file',
      name: file.name,
      getFile: async () => file
    });
  }

  return {
    kind: 'directory',
    name: 'Pasta Local (Upload)',
    values: async function* () {
      for (const entry of entries) {
        yield entry;
      }
    },
    queryPermission: async () => 'granted',
    requestPermission: async () => 'granted'
  };
}

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
    // Em WebViews Android, cancelamento ou falta de permissão pode vir com mensagens variadas.
    // Normalizamos tudo para AbortError — App.tsx ignora AbortError silenciosamente.
    if (e.name === 'AbortError' || e.message?.includes('user aborted') || e.message?.includes('The user aborted a request')) {
        const silentError = new Error("Seleção cancelada pelo usuário.");
        silentError.name = 'AbortError';
        throw silentError;
    }
    throw e;
  }
}

/**
 * Lista arquivos do diretório, filtrando apenas os suportados.
 * Retorna objetos compatíveis com a interface DriveFile.
 *
 * Performance: getFile() é chamado apenas para obter metadados de listagem (size, lastModified).
 * O blob NÃO é retido em memória — carregado on-demand pelo useFileManager via handle.getFile()
 * quando o arquivo for efetivamente aberto. Em pastas com 200+ PDFs, isso reduz o heap inicial
 * de potencial ~1GB para < 1MB de metadados.
 */
export async function listLocalFiles(dirHandle: any): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  
  try {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const name = entry.name;
        const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
        
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          // getFile() apenas para metadados — size, lastModified, mimeType fallback.
          // blob intencionalmente ausente: useFileManager lê via handle.getFile() on-demand.
          const fileData = await entry.getFile();
          
          files.push({
            id: `native-${name}-${fileData.lastModified}`,
            name: name,
            mimeType: EXT_TO_MIME[ext] || fileData.type || 'application/octet-stream',
            size: fileData.size.toString(),
            modifiedTime: new Date(fileData.lastModified).toISOString(),
            handle: entry,
            // blob ausente intencionalmente — carregado on-demand
          });
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
  // Handles virtuais (criados via input) sempre têm permissão 'granted' simulada
  if (!fileHandle.queryPermission) return true;

  const options: any = {};
  if (withWrite) {
    options.mode = 'readwrite';
  }
  
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  
  return false;
}

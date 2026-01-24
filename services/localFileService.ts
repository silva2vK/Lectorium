
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
 * Cria um "Handle Virtual" compatível com a interface FileSystemDirectoryHandle
 * a partir de uma lista de arquivos (input type="file" webkitdirectory).
 * Isso permite usar a mesma lógica de UI sem exigir permissões de escrita nativas.
 */
export function createVirtualDirectoryHandle(fileList: FileList) {
  const entries: any[] = [];
  
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    // Emula a estrutura de um FileSystemFileHandle
    entries.push({
      kind: 'file',
      name: file.name,
      // webkitRelativePath contém o caminho relativo se necessário no futuro
      getFile: async () => file
    });
  }

  return {
    kind: 'directory',
    name: 'Pasta Local (Upload)',
    // Emula o iterador .values()
    values: async function* () {
      for (const entry of entries) {
        yield entry;
      }
    },
    // Métodos stub para compatibilidade (não funcionam em modo virtual)
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
    // Itera sobre as entradas do diretório
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const name = entry.name;
        const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
        
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          // Precisamos obter o arquivo real para metadados básicos (data, tamanho)
          // Nota: Isso pode ser lento em pastas gigantes, então pegamos sob demanda se possível.
          // Aqui pegamos o File para exibir stats corretos.
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
  
  // Check if permission was already granted. If so, return true.
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  
  // Request permission. If the user grants permission, return true.
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  
  return false;
}

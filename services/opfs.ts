
/**
 * OPFS Adapter (Chrome Native I/O)
 * Gerencia o armazenamento de arquivos binários pesados (PDFs, Imagens)
 * diretamente no Origin Private File System, bypassando o overhead do IndexedDB.
 */

let rootHandle: FileSystemDirectoryHandle | null = null;

async function getRoot() {
  if (!rootHandle) {
    if (!navigator.storage || !navigator.storage.getDirectory) {
      throw new Error("OPFS não suportado neste navegador.");
    }
    rootHandle = await navigator.storage.getDirectory();
  }
  return rootHandle;
}

export const opfs = {
  isSupported: async () => {
    return 'storage' in navigator && 'getDirectory' in navigator.storage;
  },

  /**
   * Salva um Blob no OPFS usando Streams para evitar bloqueio da UI.
   */
  save: async (filename: string, blob: Blob) => {
    try {
      const root = await getRoot();
      // create: true garante que o arquivo seja criado se não existir
      const fileHandle = await root.getFileHandle(filename, { create: true });
      // @ts-ignore - Tipos do TS para FileSystemWritableFileStream ainda são instáveis
      const writable = await fileHandle.createWritable();
      
      // Escreve via stream (alta performance)
      await writable.write(blob);
      await writable.close();
      
      return true;
    } catch (e) {
      console.error("[OPFS] Erro ao salvar:", e);
      throw e;
    }
  },

  /**
   * Lê um arquivo do OPFS retornando um Blob.
   */
  load: async (filename: string): Promise<Blob | null> => {
    try {
      const root = await getRoot();
      const fileHandle = await root.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return file;
    } catch (e: any) {
      if (e.name === 'NotFoundError') return null;
      console.warn("[OPFS] Erro ao carregar:", e);
      return null;
    }
  },

  /**
   * Remove um arquivo do OPFS.
   */
  delete: async (filename: string) => {
    try {
      const root = await getRoot();
      await root.removeEntry(filename);
    } catch (e: any) {
      if (e.name !== 'NotFoundError') {
        console.warn("[OPFS] Erro ao deletar:", e);
      }
    }
  },

  /**
   * Lista todos os arquivos (para limpeza/debug).
   */
  list: async (): Promise<string[]> => {
    try {
      const root = await getRoot();
      const keys: string[] = [];
      // @ts-ignore - Iteração assíncrona de handles
      for await (const name of root.keys()) {
        keys.push(name);
      }
      return keys;
    } catch (e) {
      return [];
    }
  },

  /**
   * Limpa todo o armazenamento OPFS.
   */
  clear: async () => {
    try {
      const root = await getRoot();
      const files = await opfs.list();
      await Promise.all(files.map(f => root.removeEntry(f)));
    } catch (e) {
      console.error("[OPFS] Falha ao limpar:", e);
    }
  }
};


import { getDb, OfflineRecord } from "./db";
import { opfs } from "./opfs"; 
export type { DocVersion } from "./db";

// Re-export Repositories
export * from "../repositories/fileRepository";
export * from "../repositories/vectorRepository";
export * from "../repositories/settingsRepository";
export * from "../repositories/contentRepository";

export const APP_VERSION = '1.4.0'; 
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

const CACHE_NAME = 'lectorium-offline-v7';

// Categorias de Recursos Refinadas
export type ResourceCategory = 'core' | 'pdf_office' | 'math_science' | 'ai_assets';

export const ALL_CATEGORIES: ResourceCategory[] = ['core', 'pdf_office', 'math_science', 'ai_assets'];

interface ResourceGroup {
  id: ResourceCategory;
  label: string;
  description: string;
  urls: string[]; 
  keywords: string[]; 
  required?: boolean;
  estimatedSize: number; // Tamanho em bytes
}

// 1MB = 1048576 bytes
export const AVAILABLE_RESOURCES: ResourceGroup[] = [
  {
    id: 'core',
    label: 'Núcleo do Sistema',
    description: 'Interface, Fontes do Google e Lógica Principal.',
    required: true,
    estimatedSize: 5.5 * 1024 * 1024, // Ajustado para refletir chunks do React/Firebase
    keywords: ['react', 'firebase', 'lucide', 'tailwind', 'idb', 'zustand'], 
    urls: [
      '/',
      '/index.html',
      '/manifest.json',
      '/icons/icon.svg',
      '/icons/maskable-icon.svg',
      'https://cdn.tailwindcss.com',
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
    ]
  },
  {
    id: 'pdf_office',
    label: 'Motores de Documentos',
    description: 'Renderização de PDF e editor de DOCX (Native Canvas).',
    required: true,
    estimatedSize: 8.5 * 1024 * 1024, // Ajustado considerando Worker + Maps
    keywords: ['pdfjs-dist', 'pdf-lib', 'docx', 'jszip'],
    urls: [
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.50/web/pdf_viewer.css',
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.50/build/pdf.worker.min.mjs',
    ]
  },
  {
    id: 'math_science',
    label: 'Ciência e Dados',
    description: 'Suporte a fórmulas KaTeX, diagramas Mermaid e Gráficos.',
    required: false,
    estimatedSize: 4.8 * 1024 * 1024,
    keywords: ['katex', 'mermaid', 'recharts', 'qrcode'],
    urls: [
      'https://cdn.jsdelivr.net/npm/katex@0.16.27/dist/katex.min.css',
      'https://cdn.jsdelivr.net/npm/katex@0.16.27/dist/fonts/KaTeX_Main-Regular.woff2',
      'https://cdn.jsdelivr.net/npm/katex@0.16.27/dist/fonts/KaTeX_Math-Italic.woff2',
      'https://cdn.jsdelivr.net/npm/katex@0.16.27/dist/fonts/KaTeX_Size1-Regular.woff2',
      'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/atom-one-dark.min.css',
    ]
  },
  {
    id: 'ai_assets',
    label: 'Assets de IA',
    description: 'Prompts pré-compilados e lógica de processamento visual Gemini.',
    required: false,
    estimatedSize: 1.5 * 1024 * 1024,
    keywords: ['genai', 'vision'],
    urls: []
  }
];

function identifyCategory(url: string): ResourceCategory {
  const lowerUrl = url.toLowerCase();
  if (AVAILABLE_RESOURCES[2].keywords.some(k => lowerUrl.includes(k))) return 'math_science';
  if (AVAILABLE_RESOURCES[1].keywords.some(k => lowerUrl.includes(k))) return 'pdf_office';
  return 'core';
}

export function formatSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export async function deleteOfflineResources(): Promise<void> {
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
  }
}

export async function cacheAppResources(
  selectedCategories: ResourceCategory[], 
  onProgress?: (progress: number) => void
): Promise<string> {
  const cache = await caches.open(CACHE_NAME);
  const finalUrlsToCache = new Set<string>();

  AVAILABLE_RESOURCES.forEach(group => {
    if (group.required || selectedCategories.includes(group.id)) {
      group.urls.forEach(u => finalUrlsToCache.add(u));
    }
  });

  try {
     const res = await fetch('/index.html?t=' + Date.now());
     if (res.ok) {
         const html = await res.text();
         const doc = new DOMParser().parseFromString(html, 'text/html');
         
         const importMap = doc.querySelector('script[type="importmap"]');
         if (importMap?.textContent) {
            const json = JSON.parse(importMap.textContent);
            if (json.imports) {
               Object.values(json.imports).forEach((u: any) => {
                  if (typeof u === 'string') {
                      const cat = identifyCategory(u);
                      if (selectedCategories.includes(cat) || AVAILABLE_RESOURCES.find(r => r.id === cat)?.required) {
                          finalUrlsToCache.add(u);
                      }
                  }
               });
            }
         }
     }
  } catch (e) {}

  const urlsArray = Array.from(finalUrlsToCache);
  let completed = 0;
  
  // Limite de concorrência para evitar erros de rede em lote
  const CONCURRENCY = 6;
  
  for (let i = 0; i < urlsArray.length; i += CONCURRENCY) {
      const chunk = urlsArray.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async (url) => {
          try {
              // Tenta fetch com CORS para garantir que o blob seja válido e mensurável
              // Se falhar (alguns CDNs), tenta sem CORS (opaque), mas armazena igual.
              let res;
              try {
                  res = await fetch(url, { cache: 'reload', mode: 'cors' });
              } catch (corsErr) {
                  res = await fetch(url, { cache: 'reload', mode: 'no-cors' });
              }
              
              if (res && (res.ok || res.type === 'opaque')) {
                  await cache.put(url, res);
              }
          } catch (e) {
              console.warn(`[Offline] Falha ao cachear: ${url}`, e);
          } finally {
              completed++;
              if (onProgress) onProgress(Math.round((completed / urlsArray.length) * 100));
          }
      }));
  }

  // Retorna o tamanho total real usando a API de Storage, que é mais precisa para opacos
  const total = await getOfflineCacheSize();
  return total || "Desconhecido";
}

export async function getOfflineCacheSize(): Promise<string | null> {
  // Estratégia Prioritária: Storage Manager (Chrome/Edge/Firefox Modernos)
  // Isso retorna o uso REAL em disco de toda a origem (Cache + IDB)
  if (navigator.storage && navigator.storage.estimate) {
      try {
          const estimate = await navigator.storage.estimate();
          // Retornamos o uso total, pois é o que importa para "Em uso" no contexto PWA
          if (estimate.usage) return formatSize(estimate.usage);
      } catch (e) {
          console.warn("Storage estimate failed", e);
      }
  }

  // Fallback: Iteração manual (Menos preciso para Opaque Responses)
  if (!('caches' in window)) return null;
  const keys = await caches.keys();
  let totalBytes = 0;
  for (const key of keys) {
    const cache = await caches.open(key);
    const requests = await cache.keys();
    for (const req of requests) {
      const res = await cache.match(req);
      if (res) {
          try {
            const blob = await res.clone().blob();
            totalBytes += blob.size;
          } catch(e) {}
      }
    }
  }
  return totalBytes > 0 ? formatSize(totalBytes) : null;
}

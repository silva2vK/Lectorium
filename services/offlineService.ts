
const CACHE_NAME = 'lectorium-offline-v6';

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
}

export const AVAILABLE_RESOURCES: ResourceGroup[] = [
  {
    id: 'core',
    label: 'Núcleo do Sistema',
    description: 'Interface, Fontes do Google e Lógica Principal. (~2.5MB)',
    required: true,
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
    description: 'Renderização de PDF e editor de DOCX (Native Canvas). (~4.2MB)',
    required: true,
    keywords: ['pdfjs-dist', 'pdf-lib', 'docx', 'jszip'],
    urls: [
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/web/pdf_viewer.css',
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs',
    ]
  },
  {
    id: 'math_science',
    label: 'Ciência e Dados',
    description: 'Suporte a fórmulas KaTeX, diagramas Mermaid e Gráficos. (~3.8MB)',
    required: false,
    keywords: ['katex', 'mermaid', 'recharts', 'qrcode'],
    urls: [
      'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
      'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/fonts/KaTeX_Main-Regular.woff2',
      'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/fonts/KaTeX_Math-Italic.woff2',
      'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/fonts/KaTeX_Size1-Regular.woff2',
      'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css',
    ]
  },
  {
    id: 'ai_assets',
    label: 'Assets de IA',
    description: 'Prompts pré-compilados e lógica de processamento visual Gemini. (~1MB)',
    required: false,
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

function formatSize(bytes: number): string {
    if (bytes === 0) return "0 KB";
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`;
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
  let totalBytesActual = 0;
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
  
  for (let i = 0; i < urlsArray.length; i += 4) {
      const chunk = urlsArray.slice(i, i + 4);
      await Promise.all(chunk.map(async (url) => {
          try {
              const res = await fetch(url, { cache: 'reload' });
              if (res.ok) {
                  const blob = await res.clone().blob();
                  totalBytesActual += blob.size;
                  await cache.put(url, res);
              }
          } catch (e) {} finally {
              completed++;
              if (onProgress) onProgress(Math.round((completed / urlsArray.length) * 100));
          }
      }));
  }

  return formatSize(totalBytesActual);
}

export async function getOfflineCacheSize(): Promise<string | null> {
  if (!('caches' in window)) return null;
  const keys = await caches.keys();
  let totalBytes = 0;
  for (const key of keys) {
    const cache = await caches.open(key);
    const requests = await cache.keys();
    for (const req of requests) {
      const res = await cache.match(req);
      if (res) totalBytes += (await res.clone().blob()).size;
    }
  }
  return totalBytes > 0 ? formatSize(totalBytes) : null;
}

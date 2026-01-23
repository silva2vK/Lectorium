/**
 * Lectorium PWA Service Worker (Native Core)
 * Identidade: dev.lectorium.app
 * Versão: v7.0 (Ironclad)
 */

const CACHE_NAME = 'lectorium-core-v7.0';
const KNOWLEDGE_CACHE = 'lectorium-knowledge-v1';

// Assets críticos para o "App Shell"
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// --- INSTALAÇÃO ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Tenta cachear o essencial, mas não falha se algo não crítico falhar
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[SW] Alguns assets de precache falharam, continuando...', err);
      });
    })
  );
  // Força ativação imediata
  self.skipWaiting();
});

// --- ATIVAÇÃO & LIMPEZA ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME && name !== KNOWLEDGE_CACHE) {
            console.log('[SW] Limpando cache antigo:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// --- INTERCEPTAÇÃO DE REDE ---
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Ignorar requisições não-GET, esquemas chrome-extension, ou API do Google Drive/Gemini (que devem ser live)
  if (event.request.method !== 'GET' || 
      url.protocol === 'chrome-extension:' || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('google-analytics')) {
    return;
  }

  // 2. Estratégia: Stale-While-Revalidate para Assets Estáticos (JS, CSS, Fontes, Imagens Locais)
  if (
    event.request.destination === 'script' ||
    event.request.destination === 'style' ||
    event.request.destination === 'font' ||
    event.request.destination === 'image' ||
    url.pathname.endsWith('.json')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        
        // Dispara atualização em background
        const networkFetch = fetch(event.request).then((response) => {
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => {/* offline, silêncio */});

        // Retorna cache se existir, senão espera a rede
        return cachedResponse || networkFetch;
      })
    );
    return;
  }

  // 3. Estratégia: Cache First para Conhecimento Externo (Wikipedia, Dicionários)
  // Isso economiza banda e acelera consultas repetidas
  if (url.hostname.includes('wikipedia.org') || url.hostname.includes('dicionario-aberto.net')) {
    event.respondWith(
      caches.open(KNOWLEDGE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        } catch {
          return new Response('Offline', { status: 503 });
        }
      })
    );
    return;
  }

  // 4. Estratégia: Network First para Navegação (HTML)
  // Garante que o usuário receba a nova versão do App se estiver online
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => {
          return caches.match(event.request).then((response) => {
            if (response) return response;
            // Se tudo falhar, retorna o index.html do cache como fallback (SPA)
            return caches.match('/index.html');
          });
        })
    );
    return;
  }
});

// --- COMUNICAÇÃO COM A PÁGINA ---
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
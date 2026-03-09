/**
 * Lectorium PWA Service Worker (Native Core)
 * Identidade: dev.lectorium.app
 * Versão: v7.1 (Ironclad)
 */

const CACHE_NAME = 'lectorium-core-v7.1';
const KNOWLEDGE_CACHE = 'lectorium-knowledge-v1';

// Assets críticos para o "App Shell"
// Nota: chunks JS/CSS com hash são cobertos pelo Stale-While-Revalidate na primeira visita.
// O precache aqui garante funcionamento offline do shell antes de qualquer visita.
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Hostnames que NUNCA devem ser interceptados (live only)
const BYPASS_HOSTNAMES = [
  'googleapis.com',
  'accounts.google.com',
  'firebase.googleapis.com',
  'firebaseapp.com',
  'google-analytics.com',
  'gstatic.com',
];

const shouldBypass = (hostname) =>
  BYPASS_HOSTNAMES.some(h => hostname === h || hostname.endsWith('.' + h));

// --- INSTALAÇÃO ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[SW] Alguns assets de precache falharam, continuando...', err);
      });
    })
  );
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

  // 1. Ignora não-GET, chrome-extension, e serviços externos live
  if (
    event.request.method !== 'GET' ||
    url.protocol === 'chrome-extension:' ||
    shouldBypass(url.hostname)
  ) {
    return;
  }

  // 2. Estratégia: Cache First para Conhecimento Externo (Wikipedia, Dicionários)
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

  // 3. Estratégia: Network First para Navegação (HTML / SPA fallback)
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
            return response || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 4. Estratégia: Stale-While-Revalidate para Assets Estáticos (JS, CSS, fontes, imagens, JSON local)
  // Nota: .json captura manifest e chunks de dados locais.
  // APIs externas já foram descartadas pelo shouldBypass acima.
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

        const networkFetch = fetch(event.request).then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        }).catch(() => {/* offline, silêncio */});

        return cachedResponse || networkFetch;
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

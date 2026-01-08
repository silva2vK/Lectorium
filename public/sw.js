/**
 * Lectorium PWA Service Worker
 * Identidade: dev.lectorium.app
 * Versão: v6.1
 */

const CACHE_NAME = 'lectorium-offline-v6.1';

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

try {
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');
} catch (e) {
  console.error('[Lectorium SW] Workbox falhou ao carregar:', e);
}

if (typeof workbox !== 'undefined') {
  // Identifica o app para ferramentas de auditoria
  workbox.core.setCacheNameDetails({
    prefix: 'lectorium',
    suffix: 'v6.1',
    precache: 'precache',
    runtime: 'runtime'
  });

  // Estratégia Principal: Navegação
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({ 
      cacheName: 'pages-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({ maxEntries: 10 })
      ]
    })
  );

  // Cache de Conhecimento (Wikipedia/Dicionários)
  workbox.routing.registerRoute(
    ({ url }) => url.hostname.includes('wikipedia.org') || url.hostname.includes('dicionario-aberto.net'),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'knowledge-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({ 
          maxEntries: 50, 
          maxAgeSeconds: 30 * 24 * 60 * 60 
        })
      ]
    })
  );

  // Assets Estáticos
  workbox.routing.registerRoute(
    ({ request }) => ['script', 'style', 'font', 'image'].includes(request.destination),
    new workbox.strategies.StaleWhileRevalidate({ 
      cacheName: 'assets-cache' 
    })
  );
}

// Limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter(n => !n.includes(CACHE_NAME)).map(n => caches.delete(n))
    ))
  );
  // Garante que o SW assuma o controle de todas as abas imediatamente
  self.clients.claim();
});
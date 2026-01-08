/**
 * Lectorium PWA Service Worker
 * Identidade: lectorium-c43.pages.dev
 * Versão: v6.3
 */

const CACHE_NAME = 'lectorium-offline-v6.3';

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Import Workbox
try {
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');
} catch (e) {
  console.error('[Lectorium SW] Workbox falhou ao carregar:', e);
}

if (typeof workbox !== 'undefined') {
  // Configuração Workbox
  workbox.core.setCacheNameDetails({
    prefix: 'lectorium',
    suffix: 'v6.3',
    precache: 'precache',
    runtime: 'runtime'
  });

  // 1. Navegação (Offline Fallback Strategy)
  // NetworkFirst garante que tentamos pegar a versão mais nova, 
  // mas se falhar, o cache da página responde.
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({ 
      cacheName: 'pages-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({ maxEntries: 10 })
      ]
    })
  );

  // 2. Cache de Conhecimento (Wikipedia/Dicionários)
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

  // 3. Assets Estáticos (CSS, JS, Fonts, Images)
  workbox.routing.registerRoute(
    ({ request }) => 
      ['script', 'style', 'font', 'image'].includes(request.destination) ||
      request.url.endsWith('.worker.min.mjs'), // PDF.js Workers
    new workbox.strategies.StaleWhileRevalidate({ 
      cacheName: 'assets-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({ maxEntries: 100 })
      ]
    })
  );
}

// Handler de Instalação (Precache manual mínimo para garantir detecção do PWA Builder)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        '/icons/icon.svg'
      ]);
    })
  );
});

// Handler de Ativação (Limpeza)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter(n => !n.includes(CACHE_NAME) && !n.includes('workbox')).map(n => caches.delete(n))
    ))
  );
  self.clients.claim();
});

// Handler de Fetch Genérico (Fallback final)
// Necessário para o PWA Builder validar "Offline Support" se o Workbox falhar na detecção estática
self.addEventListener('fetch', (event) => {
  // Apenas intervem se não for handled pelo Workbox ou se falhar
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/') || caches.match('/index.html');
      })
    );
  }
});
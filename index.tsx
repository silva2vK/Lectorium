import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
    console.log(`[Lectorium Core] Iniciando em modo Mobile`);
}

const params = new URLSearchParams(window.location.search);
if (params.get('debug') === 'true') {
  const script = document.createElement('script');
  script.src = "https://cdn.jsdelivr.net/npm/eruda";
  script.onload = () => {
    const w = window as any;
    if (w.eruda) w.eruda.init({ theme: 'Dracula' });
  };
  document.body.appendChild(script);
}

// Configuração do React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // Dados considerados frescos por 1 minuto
      gcTime: 1000 * 60 * 10, // Cache mantido por 10 minutos
      retry: 1,
      refetchOnWindowFocus: false, // Evita recargas agressivas em PWA
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root element missing");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);

// Service Worker Registration (Enhanced)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.debug('[Lectorium PWA] SW Registrado:', reg.scope);
        
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[Lectorium PWA] Nova versão disponível. Por favor, recarregue.');
              }
            });
          }
        });
      })
      .catch(err => console.warn('[Lectorium PWA] Falha no registro do SW:', err));
  });
}
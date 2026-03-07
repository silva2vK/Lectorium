import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [
      react(),
      nodePolyfills({
        include: ['process', 'buffer', 'stream', 'util'],
        globals: { process: true, Buffer: true },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
        'react-is': path.resolve(__dirname, './node_modules/react-is'),
      },
    },
    optimizeDeps: {
      include: [
        'pdfjs-dist', 
        'react', 
        'react-dom', 
        'lucide-react', 
        '@tiptap/react',
        '@tiptap/extension-bubble-menu'
      ],
      exclude: ['pdfjs-dist'],
      needsInterop: ['lucide-react'],
      esbuildOptions: {
        target: 'esnext',
        supported: {
          'top-level-await': true
        }
      },
    },
    build: {
      outDir: 'dist',
      target: 'esnext',
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        external: ['unrar-js'],
        output: {
          manualChunks(id) {
            // React core — carregado primeiro, sempre em cache
            if (id.includes('node_modules/react') ||
                id.includes('node_modules/react-dom') ||
                id.includes('node_modules/scheduler')) {
              return 'vendor-react';
            }

            // Motor 3D pesado
            if (id.includes('node_modules/three')) {
              return 'three-vendor';
            }

            // Bindings do React para o 3D
            if (id.includes('node_modules/@react-three/fiber') ||
                id.includes('node_modules/@react-three/drei')) {
              return 'r3f-vendor';
            }

            // Firebase — isolado pois muda pouco
            if (id.includes('node_modules/firebase') ||
                id.includes('node_modules/@firebase')) {
              return 'vendor-firebase';
            }

            // SDK da IA Gemini — grande, carregado apenas quando IA é usada
            if (id.includes('node_modules/@google/genai')) {
              return 'vendor-ai-sdk';
            }

            // TipTap + ProseMirror — apenas no DocEditor (já é lazy)
            if (id.includes('node_modules/@tiptap') ||
                id.includes('node_modules/prosemirror') ||
                id.includes('node_modules/@prosemirror') ||
                id.includes('node_modules/y-prosemirror')) {
              return 'vendor-editor';
            }

            // Yjs + colaboração — separado do editor
            if (id.includes('node_modules/yjs') ||
                id.includes('node_modules/y-webrtc') ||
                id.includes('node_modules/lib0')) {
              return 'vendor-yjs';
            }

            // PDF engine — já é worker, mas isolar o engine principal
            if (id.includes('node_modules/pdfjs-dist') ||
                id.includes('node_modules/pdf-lib')) {
              return 'vendor-pdf';
            }

            // Mermaid — diagramas, carregado sob demanda
            if (id.includes('node_modules/mermaid') ||
                id.includes('node_modules/@mermaid-js')) {
              return 'vendor-mermaid';
            }

            // KaTeX — fórmulas matemáticas
            if (id.includes('node_modules/katex')) {
              return 'vendor-katex';
            }

            // Daikon (DICOM) + UTIF (TIFF) — raramente usados
            // Serão isolados para lazy load posterior
            if (id.includes('node_modules/daikon') ||
                id.includes('node_modules/utif')) {
              return 'vendor-medical-formats';
            }

            // Recharts + D3 derivados
            if (id.includes('node_modules/recharts') ||
                id.includes('node_modules/d3-')) {
              return 'vendor-charts';
            }

            // JSZip, uuid, idb e outras utils genéricas
            if (id.includes('node_modules/jszip') ||
                id.includes('node_modules/uuid') ||
                id.includes('node_modules/idb') ||
                id.includes('node_modules/clsx') ||
                id.includes('node_modules/tailwind-merge')) {
              return 'vendor-utils-light';
            }

            // Lucide icons — grande coleção de SVGs
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }

            // Zustand + TanStack Query — estado global
            if (id.includes('node_modules/zustand') ||
                id.includes('node_modules/@tanstack')) {
              return 'vendor-state';
            }
          }
        },
      },
    },
    server: {
      port: 3000
    },
    define: {
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY || env.API_KEY),
      'global': 'window',
    }
  };
});
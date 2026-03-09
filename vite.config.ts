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
        // Suprime warnings conhecidos e insolúveis de dependências legadas
        onwarn(warning, warn) {
          // daikon usa eval internamente (charLS WASM fallback) — insolúvel sem fork
          if (warning.code === 'EVAL' && warning.id?.includes('daikon')) return;
          // pdfjs-dist/web/pdf_viewer.css contém seletores CSS inválidos (-:|)
          // que o esbuild não aceita — bug upstream do pdfjs v5
          if (warning.code === 'PLUGIN_WARNING' && warning.message?.includes('-:|')) return;
          // Módulos Node.js (fs, process) externalizados em dependências browser-only
          if (warning.code === 'MISSING_NODE_BUILTINS') return;
          warn(warning);
        },
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

            // FIX CIRCULAR: y-prosemirror vai junto com o editor (ProseMirror)
            // pois importa de @prosemirror/* que está neste chunk.
            // Manter y-prosemirror em vendor-yjs criava ciclo:
            //   vendor-yjs -> @prosemirror (vendor-editor) -> yjs (vendor-yjs)
            if (id.includes('node_modules/@tiptap') ||
                id.includes('node_modules/prosemirror') ||
                id.includes('node_modules/@prosemirror') ||
                id.includes('node_modules/y-prosemirror')) {
              return 'vendor-editor';
            }

            // Yjs core + transporte — sem y-prosemirror (ver acima)
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

            // Daikon (DICOM) + UTIF (TIFF) — dynamic import em mediaAdapterService,
            // isolados aqui para não contaminar o bundle principal com eval/fs warnings
            if (id.includes('node_modules/daikon') ||
                id.includes('node_modules/utif')) {
              return 'vendor-medical-formats';
            }

            // FIX CIRCULAR: recharts importa clsx/tailwind-merge internamente.
            // Manter clsx/tailwind-merge em vendor-utils-light criava ciclo:
            //   vendor-charts -> vendor-utils-light -> vendor-charts
            // Solução: clsx e tailwind-merge saem do chunk utils e ficam no index.
            if (id.includes('node_modules/recharts')) {
              return 'vendor-charts';
            }

            // Utils genéricas leves — sem clsx/tailwind-merge (ver acima)
            if (id.includes('node_modules/jszip') ||
                id.includes('node_modules/uuid') ||
                id.includes('node_modules/idb')) {
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
      'global': 'window',
    }
  };
});

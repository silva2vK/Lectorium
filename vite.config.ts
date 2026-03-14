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
        onwarn(warning, warn) {
          if (warning.code === 'EVAL' && warning.id?.includes('daikon')) return;
          if (warning.code === 'PLUGIN_WARNING' && warning.message?.includes('-:|')) return;
          if (warning.code === 'MISSING_NODE_BUILTINS') return;
          warn(warning);
        },
        output: {
          manualChunks(id) {
            // React core
            if (id.includes('node_modules/react') ||
                id.includes('node_modules/react-dom') ||
                id.includes('node_modules/scheduler')) {
              return 'vendor-react';
            }

            // Motor 3D pesado
            if (id.includes('node_modules/three')) {
              return 'three-vendor';
            }

            // Bindings React para 3D
            if (id.includes('node_modules/@react-three/fiber') ||
                id.includes('node_modules/@react-three/drei')) {
              return 'r3f-vendor';
            }

            // vendor-firebase REMOVIDO em 2026-03-13 (Sessão 1 — remoção Firebase)
            // Firebase substituído por GIS puro em services/authService.ts

            // SDK Gemini
            if (id.includes('node_modules/@google/genai')) {
              return 'vendor-ai-sdk';
            }

            // Editor TipTap + ProseMirror
            // CRÍTICO: y-prosemirror DEVE ficar aqui, antes de vendor-yjs
            if (id.includes('node_modules/@tiptap') ||
                id.includes('node_modules/prosemirror') ||
                id.includes('node_modules/@prosemirror') ||
                id.includes('node_modules/y-prosemirror')) {
              return 'vendor-editor';
            }

            // Yjs core + transporte — sem y-prosemirror
            if (id.includes('node_modules/yjs') ||
                id.includes('node_modules/y-webrtc') ||
                id.includes('node_modules/lib0')) {
              return 'vendor-yjs';
            }

            // PDF engine
            if (id.includes('node_modules/pdfjs-dist') ||
                id.includes('node_modules/pdf-lib')) {
              return 'vendor-pdf';
            }

            // Mermaid — diagramas sob demanda
            if (id.includes('node_modules/mermaid') ||
                id.includes('node_modules/@mermaid-js')) {
              return 'vendor-mermaid';
            }

            // KaTeX
            if (id.includes('node_modules/katex')) {
              return 'vendor-katex';
            }

            // DICOM + TIFF — lazy-load
            if (id.includes('node_modules/daikon') ||
                id.includes('node_modules/utif')) {
              return 'vendor-medical-formats';
            }

            // Recharts
            if (id.includes('node_modules/recharts')) {
              return 'vendor-charts';
            }

            // Motion (Framer Motion fork)
            if (id.includes('node_modules/motion')) {
              return 'vendor-motion';
            }

            // Utils leves
            if (id.includes('node_modules/jszip') ||
                id.includes('node_modules/uuid') ||
                id.includes('node_modules/idb')) {
              return 'vendor-utils-light';
            }

            // Lucide icons
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }

            // Estado global
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

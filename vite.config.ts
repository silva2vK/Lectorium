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
        // Cobertura para utilitários de sistema operacional emulados no browser
        include: ['fs', 'path', 'process', 'buffer', 'util', 'stream'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
        // Resolução para evitar falhas do Recharts no React 19
        'react-is': path.resolve(__dirname, './node_modules/react-is'),
      },
    },
    optimizeDeps: {
      include: [
        'react', 
        'react-dom', 
        'mermaid', 
        'lucide-react', 
        '@tiptap/react',
        '@tiptap/extension-bubble-menu'
      ],
      // Exclusão mandatória: impede corrupção do worker v5 pelo Vite
      exclude: ['pdfjs-dist'],
      needsInterop: ['lucide-react'],
      esbuildOptions: {
        target: 'esnext',
        supported: {
          'top-level-await': true // Exigido pelo motor moderno do PDF.js
        }
      },
    },
    build: {
      outDir: 'dist',
      target: 'esnext',
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        external: ['unrar-js', 'y-prosemirror'], // y-prosemirror externalizado para evitar erros de build
        output: {
          manualChunks(id) {
            // Isolamento do motor PDF para carregamento sob demanda
            if (id.includes('pdfjs-dist')) {
              return 'pdf-engine';
            }
            if (id.includes('@tiptap') || id.includes('lucide-react')) {
              return 'vendor-ui';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('mermaid') || id.includes('pdf-lib') || id.includes('jszip') || id.includes('docx')) {
              return 'vendor-utils';
            }
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('@google/genai')) {
              return 'ai-sdk';
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
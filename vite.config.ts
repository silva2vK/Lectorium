
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
        include: ['fs', 'path'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    resolve: {
      alias: {
        'import { defineConfig, loadEnv } from 'vite';
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
        // Cobertura total para utilitários de sistema operacional emulados no browser
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
        // Resolução explícita para evitar falhas do Recharts no React 19
        'react-is': path.resolve(__dirname, './node_modules/react-is'),
      },
    },
    optimizeDeps: {
      // Injeção de dependências críticas na fase de pré-bundle
      include: [
        'pdfjs-dist', 
        'react', 
        'react-dom', 
        'mermaid', 
        'lucide-react', 
        '@tiptap/react',
        '@tiptap/extension-bubble-menu'
      ],
      // Exclusão cirúrgica: impede o Vite de corromper o worker do PDF.js processando-o como CJS
      exclude: ['pdfjs-dist'],
      // Força a compatibilidade CommonJS/ESM para o Lucide (resolve erro de construtor)
      needsInterop: ['lucide-react'],
      esbuildOptions: {
        target: 'esnext',
        // Liberação de escopo global para o PDF.js v4+ (Top-level Await)
        supported: {
          'top-level-await': true
        }
      },
    },
    build: {
      outDir: 'dist',
      target: 'esnext',
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        external: ['unrar-js'],
        output: {
          // Roteamento dinâmico de Chunks: preserva a integridade de instâncias co-dependentes
          manualChunks(id) {
            // Isolamento estrutural do motor de renderização de PDFs
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
      // Mapeamento global para neutralizar "process is not defined" no escopo global
      'global': 'window',
    }
  };
});@': path.resolve(__dirname, './'),
      },
    },
    optimizeDeps: {
      include: ['pdfjs-dist', 'react', 'react-dom'],
      esbuildOptions: {
        target: 'esnext',
      },
    },
    build: {
      outDir: 'dist',
      target: 'esnext',
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        external: ['unrar-js'],
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'ai-sdk': ['@google/genai'],
          },
        },
      },
    },
    server: {
      port: 3000
    },
    define: {
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY || env.API_KEY),
    }
  };
});